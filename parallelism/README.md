# 并行设备结构与矩阵数据流

用浏览器打开 [index.html](index.html)，默认展示 **TP+SP**。可切换 TP、EP、SP、PP、CP、DP 六种单项并行，以及 TP+SP、DP+EP、DP+TP+PP 三种组合；DP 保留训练与 vLLM 推理的对照。

- “设备结构”用虚线框标出每个 GPU，框内直接显示输入、常驻权重、计算和输出，框间箭头表示通信。
- “逐层数值”保留六种 vLLM 算例的逐层展开；两种视图使用相同数值和步骤编号。
- 独立页面最大宽度 960px，水平居中；左右保留 16px，小屏重新布局。1440px 和 1920px 屏幕只增加两边留白，不拉长图形。

- 全局关系显示完整连通图：每层的输出通过箭头进入下一层，每条箭头附步骤序号。
- “上一步 / 下一步”保持所有节点与连线的位置，只高亮当前步骤；尚未产生的数据用 `·` 表示。
- “播放流程”沿箭头移动张量或控制信息，并走到末步停止。动画时长不代表实际性能；遵循系统减少动态效果设置。
- 蓝色为本地激活/计算，橙色为跨 rank 张量，绿色标出常驻权重/KV，控制虚线为请求、调度或 token。图中只表示逻辑数据依赖，不指定 collective 的 ring/tree 网络算法。
- 节点展示实际数值矩阵；下方“数值输入、权重与验算”可查看完整权重与参考结果。“完整流程”列出所有编号步骤。

## 节点属于哪一层

设备结构图用独立的层标签说明输入、权重、计算、输出和通信所属的模型部分；标签与步骤编号、GPU 所有权分别表达不同信息。10 个场景的输出边界如下：

| 场景 | 所属层与输出含义 |
| --- | --- |
| TP | 教学 FFN：第一投影 → ReLU → 第二投影；All-Reduce 前是部分和，之后才是完整 FFN 输出。 |
| EP | MoE-FFN 的路由、专家与归并；Combine 后得到源 token 顺序的 MoE 输出，专家本身简化为 Linear+ReLU。 |
| SP | Attention 与 `o_proj`；Reduce-Scatter 求和后得到完整 Attention 输出的 token 分片。 |
| PP | 每个 stage 仅含一个教学 Linear+ReLU，输出是该教学层的 hidden，不代表完整 Decoder 或 FFN。 |
| CP | 从已投影 Q/K/V 开始的 Attention core；LSE merge 后的 O 是单 head 输出，仍在 `o_proj` 之前。 |
| 推理 DP | Embedding → 教学 FFN → LM head → 采样；Y 是 FFN 输出，logits 是 LM head 输出。 |
| 训练 DP | 单个教学 Linear 产生预测 Y；Loss/BWD、梯度平均和 SGD 属于训练过程。 |
| TP+SP | 与 SP 同一 Attention 数值链；head/权重按 TP 切分，最终 Attention 输出按 token 分片。 |
| DP+EP | 教学前置 Linear → MoE-FFN → 教学后置 Linear；最终 Y 是后置 Linear 输出，前后 dense 不代表 Attention。 |
| DP+TP+PP | 两阶段教学 MLP；stage 内 TP 归约得到该 stage 的完整输出，PP 传递 hidden，最终为第二 stage 的输出。 |

未计算的 Norm、残差相加不补造数值，也不把输入 X 称为 Norm 输出。SP/TP+SP 的后续 Norm/MoE 仅标为“入口（未计算）”；CP 的 O 未经过 `o_proj` 或 Norm，不能与 SP 的投影后输出混称。Host 调度、执行计划和结果返回属于控制/结果路径，不是模型层。

## 六种连续算例

| 方式 | 展示的数据链 | 数值结果 |
| --- | --- | --- |
| TP | 同一 X → 分片 W1 → ReLU → 分片 W2 的部分和 → All-Reduce → 下一层 | 两端部分输出相加为 `[[2,7],[1,2]]` |
| EP | 源 hidden → Router → Dispatch → 专家 → Combine → 源端下一层 | 按 t0–t3 归并为 `[[0.7,3.7],[2.4,2.8],[0.4,2.4],[0.5,2]]` |
| SP | token 分片 → All-Gather → 各 head 的 Attention 贡献 → Reduce-Scatter → 本地下一子层 | 真正计算双头 causal softmax 与输出投影，再按 token 分回 |
| PP | Stage 0 输入/输出 → Worker 发送 → Stage 1 → Worker 发送 → Stage 2 → 最终 hidden | 末段输出 `[[15,3],[8,0]]`，等于串行三层结果 |
| CP | Q 汇集 → 本地历史 attention → LSE 校正 → Reduce-Scatter → 与当前 token 的 O/LSE 合并 | 两头输出约为 `[[1.6143,1.0675],[1.0675,1.6143]]` |
| DP | 请求 → Scheduler → Worker → embedding → 两层网络 → LM head → host → Scheduler 更新 → 请求输出流 | A 输入“甲乙”选“乙”；B 输入“丙”选“丙” |

通信操作的单独说明见 [通信原语项目](../communication-primitives/index.html)。

## 三种组合算例

组合入口把同一请求的计算接到实际通信边界，数值、权重、通信组和 payload 存放在 [combo-examples.json](combo-examples.json)。下表中的小数最多显示 4 位，完整精度保留在数据文件中。

| 组合 | 设备、所有权与数据链 | 最终 hidden |
| --- | --- | --- |
| TP+SP（默认） | 同 2 GPU 复用 TP 组；activation 按 token 分片 → All-Gather → 分 head 的 TP Attention 与输出投影部分和 → SUM Reduce-Scatter | GPU 0：`[[1,2],[2.6932,1.7311]]`；GPU 1：`[[3.3786,2.5339],[4.4339,4.414]]` |
| DP+EP | 同 2 GPU 各处理请求 A/B，复制非专家 dense 权重；MoE 经 dispatch → 本地专家 → combine 回源，再进入源 DP 的 dense 层 | A：`[[4.4,3.7],[5.2,2.8]]`；B：`[[2.8,2.4],[2.5,2]]` |
| DP+TP+PP | 8 个物理 GPU；两套独立的 4-rank world，每套 PP=2、各 stage TP=2；stage 内 SUM All-Reduce → PP 分片发送 → 目的 stage 的 TP All-Gather → 下一 stage | A：`[[9,5],[3,1]]`；B：`[[13,17]]` |

- **TP+SP** 的两种切分使用同一组两卡，不是 `TP2 × SP2 = 4 GPU`。Attention 前汇集完整 token 行，再按 head 计算；RS 求和后重新按 token 分配 activation。这里沿用 DeepSeek activation/MoE SP 的通信布局，固定 PP=1；它不表示历史 KV 被分到两卡。
- **DP+EP** 固定 TP=PP=1、4 experts、top-2、linear placement、EPLB 关闭。GPU 0 拥有 E0/E1，GPU 1 拥有 E2/E3；复制的是非专家 dense 权重，每个 DP 没有独立的完整专家集合。专家执行位置不改变请求或 Scheduler 的归属。各 DP 的逻辑 token 数可以不同，但仍须协调同轮 MoE collectives；本地空闲而其他 DP 运行时，按需用 dummy batch 参与，图模式还可能要求 padding。
- **DP+TP+PP** 的 GPU 0–7 是教学设备编号，不是统一 world 的全局 rank。每个 DP 的本地 rank 都为 0–3，TP 组为 `[0,1]`、`[2,3]`，PP 组为 `[0,2]`、`[1,3]`；两套 dense DP 各有请求与 Scheduler，互不交换模型 activation。
- 本例 PP 源 hidden 在同一 stage 的两 TP rank 上完整复制，且 `numel` 可被 TP=2 整除；各 rank 实际发送 `hidden.reshape(2, -1)[tp_rank]`，接收 stage 的 TP 组 All-Gather 后恢复原 shape。A 的 `[2,2]` 恰好每次发送一行，B 的 `[1,2]` 每次发送一个标量，因此这是 flattened 切片，不是固定按 token 行切分。图中将本地计算、Worker 发送与对端收到分片（第 4 步）、All-Gather 还原（第 5 步）分开；模型本地 return 本身不表示跨卡，下一 stage 消费恢复后的完整矩阵。

三个组合都是独立验算的教学网络，不是完整预训练模型或 GPU/NPU 实测。TP+SP 省略 Norm、residual 和 MoE 数值；DP+EP 的 dense/专家为小型教学算子；DP+TP+PP 为两阶段 MLP，仅展示一份 hidden 的 PP 传输，未启用 SP。真实模型可能还传 residual 等其他张量，不能把本例的 PP 分片优化套到非复制的源 tensor。

## 矩阵到底怎么切

图中行、列的含义与公式一起标注。`X` 通常是 `[token,hidden]`；训练 DP 的行表示独立样本。TP/DP 的权重采用 `X @ W` 的 `[in,out]` 约定，与 PyTorch `Linear.weight` 存储互为转置。

| 方式 | 本例切分方法 | 完整保留的部分 |
| --- | --- | --- |
| TP | `W1[2,4]` 按列切成两个 `[2,2]`；`W2[4,2]` 按对应行切成两个 `[2,2]` | X 的全部 token 行；两个 Y 都是完整形状的部分和，需相加 |
| EP | GPU 0 持有 E0/E1，GPU 1 持有 E2/E3；token 按路由去专家 | 每个专家的完整权重，归并后恢复源 token 行序 |
| SP | `X[4,2]` 按 token 行切：GPU 0 取行 0,1，GPU 1 取行 2,3 | 每个 token 的完整 hidden 特征；Attention 前 AG，之后 SUM RS |
| PP | 完整层按 Stage 0、1、2 分配 | 各 stage 自己的完整 W；传给下一 stage 的完整 activation |
| CP | 历史 K/V 的 token 位置交错分配：GPU 0 取 0,2，GPU 1 取 1,3 | 本地 KV 行的 head 维度；本例 Q 的行代表 head，不能与 KV 的 token 行混淆 |
| 推理 DP | 完整请求 A 给 GPU 0，B 给 GPU 1 | 每端全部权重；A 的两个 token 不拆给不同 DP 副本 |
| 训练 DP | `X[3,2]` 按样本行拆成三个 `[1,2]` | 每端完整 `W[2,2]` 与梯度 `G[2,2]`；梯度平均后本地更新 |

## 训练 DP 与推理 DP

训练图对应“输入分片 → 每端相同 W → FWD/BWD → 梯度 All-Reduce → 各端更新 W”。每个 GPU 处理一个样本，局部 loss 为 `0.5 * sum((X_i @ W - T_i)^2)`，局部梯度为 `G_i = X_i.T @ (X_i @ W - T_i)`；All-Reduce SUM 后除以 3，得到平均梯度，各端用学习率 0.1 更新。

All-Reduce 图形节点代表集合操作，不是一个中心服务器；汇入与返回箭头是逻辑数据贡献和结果就绪，不指定 Push/Pull API 或 ring/tree 实现。训练例是算法教学，不是 vLLM 的执行路径。vLLM 普通 dense 推理按请求分配完整副本，不计算反向梯度，也没有这条训练梯度同步链。参见 [PyTorch DDP 文档](https://docs.pytorch.org/docs/stable/generated/torch.nn.parallel.DistributedDataParallel.html)。

## 数值的真实性与范围

这是实际执行并独立验算的小型教学网络，不是从预训练模型或 GPU/NPU 运行中采集的激活。六种单项算例的数值、权重和维度可在 [matrix-examples.json](matrix-examples.json) 中查看，三种组合见 [combo-examples.json](combo-examples.json)；图内嵌对应数据，离线打开不发起网络请求。

- TP/DP 使用行向量 `X @ W`，权重为 `[in,out]`，与 PyTorch `Linear.weight` 存储互为转置；第二层后不再做 ReLU，Y 可为负。
- EP/PP 的专家/阶段使用 `ReLU(X @ W.T)`，W 为 `[out,in]`。它们是教学 Linear，不冒充完整 Qwen/DeepSeek decoder。
- EP 固定 2 ranks、4 experts、top-2、无 EPLB、`apply_router_weight_on_input=False`；采用 DeepEP LL combine 内部加权归并语义。图中打包行序是逻辑示意，不是后端固定物理布局。
- SP 固定 TP/SP=2、PP=1，借用 DeepSeek activation/MoE SP 的 AG→Attention→RS 布局。数值例为 4 tokens、两头各 1 维、Q/K/V=X、causal mask；省略 Norm、residual、RoPE、MoE 数值。它不是 Ulysses，也不定义历史 KV 的分片。
- PP 传输前后矩阵保持相同；模型/Runner 本地返回与 Worker 真正发送分开标示。算例结束于 hidden，不伪造 logits、residual 或 KV。
- CP 固定 FlashAttention DCP `ag_rs`、PCP=1、TP=DCP=2、interleave=1：4 个历史 tokens，加当前 token 4。Q 每头 2 维，采用 `QK.T / sqrt(2)`；先校正历史输出，再在 RS 内求和，并按 LSE 合并当前 chunk。DCP 复用此 TP 组；PCP、a2a、MLA 有其他实现。
- DP 固定 dense、DP=2、TP=PP=1。Scheduler 下发元数据，激活在 Worker 内生成；结果先经 `update_from_output` 才进入客户端输出。两个完整模型副本不交换 hidden；MoE+EP 可跨 DP ranks 通信，见上面的 DP+EP 组合。

所有权和调用边界按 upstream vLLM [`295c062db8`](https://github.com/vllm-project/vllm/tree/295c062db8a48ea73bbd05d1174cb37d24bf86f9) 静态核对。页面“适用边界与源码”提供各模式的精确入口。

## 可重复验算

在本目录运行：

```sh
python verify_matrices.py
python verify_training_dp.py
python verify_combinations.py
```

[verify_matrices.py](verify_matrices.py) 仅使用 Python 标准库，从输入重新计算六种模式，检查形状、分片轴、payload、归并、完整网络/attention 参考和 4 位展示数据。它不读取 JSON 中的验证成功标志作为结论，也不声称验证了 NCCL 或设备执行。

当前验算全部通过：TP/DP/PP/SP 最大误差为 0，EP 为 `4.44e-16`，CP 为 `2.22e-16`。页面会将小数展示到最多 4 位，原始精度保留在 JSON 中。

训练 DP 的独立梯度、平均梯度和更新检查通过；全批次有限差分误差为 `2.76e-10`。页面布局检查范围与结果见 [LAYOUT-CHECKS.md](LAYOUT-CHECKS.md)。

[verify_combinations.py](verify_combinations.py) 同样仅使用 Python 标准库，从 [combo-examples.json](combo-examples.json) 的输入重新计算三种组合，检查 Attention/专家/MLP 算术、请求与专家所有权、通信组、PP flattened payload、目的 TP All-Gather 恢复及未切分参考结果。它忽略存储的验证成功标志，不声称验证了通信后端或硬件执行。当前三种组合全部通过：TP+SP 最大误差为 0，DP+EP 为 `8.88e-16`，DP+TP+PP 为 0。

## 真实调用链

[call-chain.json](call-chain.json) 保存 9 条实现路径：TP、SP、TP+SP、EP、DP+EP、CP、PP、推理 DP、DP+TP+PP，共 126 个节点。每个节点记录输入、状态变化、输出消费者、返回续点和固定 commit 的源码范围；跨 Worker、DP 实例或设备库的边界单独标出。

- TP 的源码例子是 Llama SwiGLU；图中的小型 ReLU 网络用于展示切片与求和，不代表实际模型参数。
- SP/TP+SP 固定 DeepSeek activation/MoE SP、PP=1。EP/DP+EP 固定模块化 DeepEP low latency 后端，外部 `deep_ep` 库内部不展开。
- CP 固定 FlashAttention DCP 的 `ag_rs`、历史 context 非空分支；历史 KV 保留分片，先合并 LSE 再校正输出。
- 推理 DP 从客户端路由到独立 EngineCore；PP 的异步发送与对端接收分属不同进程。训练 DP 是算法对照，没有虚构 vLLM 训练实现链。

[call-chain-adapter.js](call-chain-adapter.js) 按目标切换实际模式、设备/数值视图及步骤，并读取页面状态确认定位成功。数据基线为 vLLM `295c062db8a48ea73bbd05d1174cb37d24bf86f9`。页面示例与源码静态走读均不代表设备实测。

新增子调用追踪 TP/SP 到 GroupCoordinator、CUDA communicator 和条件性 PyNccl 路径，EP 到 DeepEP 库边界，PP/DP 到实际 Runner/模型调用。DP+TP+PP 的 Linear 父节点改为真正的 LlamaMLP，经过 Worker、Runner 与 Decoder；页面小型 ReLU 算例仍只解释通信布局。

新增子调用复用已有图的适用输入/输出边界，入口明确标为“原图未单列此调用”，不声称每个 Python/C++ 函数都有独立动画。旧节点 ID 保持不变，编号随真实父子关系更新；跨进程消费者与后续独立采样继续保留为独立根。
