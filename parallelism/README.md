# 并行设备结构与矩阵数据流

用浏览器打开 [index.html](index.html)，切换 TP、EP、SP、PP、CP、DP。默认展示训练 DP 的设备结构示例；DP 可切换到 vLLM 推理。

- “设备结构”用虚线框标出每个 GPU，框内直接显示输入、常驻权重、计算和输出，框间箭头表示通信。
- “逐层数值”保留六种 vLLM 算例的逐层展开；两种视图使用相同数值和步骤编号。
- 独立页面最大宽度 960px，水平居中；左右保留 16px，小屏重新布局。1440px 和 1920px 屏幕只增加两边留白，不拉长图形。

- 全局关系显示完整连通图：每层的输出通过箭头进入下一层，每条箭头附步骤序号。
- “上一步 / 下一步”保持所有节点与连线的位置，只高亮当前步骤；尚未产生的数据用 `·` 表示。
- “播放流程”沿箭头移动张量或控制信息，并走到末步停止。动画时长不代表实际性能；遵循系统减少动态效果设置。
- 蓝色为本地激活/计算，橙色为跨 rank 张量，绿色标出常驻权重/KV，控制虚线为请求、调度或 token。图中只表示逻辑数据依赖，不指定 collective 的 ring/tree 网络算法。
- 节点展示实际数值矩阵；下方“数值输入、权重与验算”可查看完整权重与参考结果。“完整流程”列出所有编号步骤。

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

这是实际执行并独立验算的小型教学网络，不是从预训练模型或 GPU/NPU 运行中采集的激活。所有数值、权重和维度可在 [matrix-examples.json](matrix-examples.json) 中查看；图内嵌同一份数据，离线打开不发起网络请求。

- TP/DP 使用行向量 `X @ W`，权重为 `[in,out]`，与 PyTorch `Linear.weight` 存储互为转置；第二层后不再做 ReLU，Y 可为负。
- EP/PP 的专家/阶段使用 `ReLU(X @ W.T)`，W 为 `[out,in]`。它们是教学 Linear，不冒充完整 Qwen/DeepSeek decoder。
- EP 固定 2 ranks、4 experts、top-2、无 EPLB、`apply_router_weight_on_input=False`；采用 DeepEP LL combine 内部加权归并语义。图中打包行序是逻辑示意，不是后端固定物理布局。
- SP 固定 TP/SP=2、PP=1，借用 DeepSeek activation/MoE SP 的 AG→Attention→RS 布局。数值例为 4 tokens、两头各 1 维、Q/K/V=X、causal mask；省略 Norm、residual、RoPE、MoE 数值。它不是 Ulysses，也不定义历史 KV 的分片。
- PP 传输前后矩阵保持相同；模型/Runner 本地返回与 Worker 真正发送分开标示。算例结束于 hidden，不伪造 logits、residual 或 KV。
- CP 固定 FlashAttention DCP `ag_rs`、PCP=1、TP=DCP=2、interleave=1：4 个历史 tokens，加当前 token 4。Q 每头 2 维，采用 `QK.T / sqrt(2)`；先校正历史输出，再在 RS 内求和，并按 LSE 合并当前 chunk。DCP 复用此 TP 组；PCP、a2a、MLA 有其他实现。
- DP 固定 dense、DP=2、TP=PP=1。Scheduler 下发元数据，激活在 Worker 内生成；结果先经 `update_from_output` 才进入客户端输出。两个完整模型副本不交换 hidden；MoE+EP 可跨 DP ranks 通信，需要另看 EP。

所有权和调用边界按 upstream vLLM [`295c062db8`](https://github.com/vllm-project/vllm/tree/295c062db8a48ea73bbd05d1174cb37d24bf86f9) 静态核对。页面“适用边界与源码”提供各模式的精确入口。

## 可重复验算

在本目录运行：

```sh
python verify_matrices.py
python verify_training_dp.py
```

[verify_matrices.py](verify_matrices.py) 仅使用 Python 标准库，从输入重新计算六种模式，检查形状、分片轴、payload、归并、完整网络/attention 参考和 4 位展示数据。它不读取 JSON 中的验证成功标志作为结论，也不声称验证了 NCCL 或设备执行。

当前验算全部通过：TP/DP/PP/SP 最大误差为 0，EP 为 `4.44e-16`，CP 为 `2.22e-16`。页面会将小数展示到最多 4 位，原始精度保留在 JSON 中。

训练 DP 的独立梯度、平均梯度和更新检查通过；全批次有限差分误差为 `2.76e-10`。页面布局检查范围与结果见 [LAYOUT-CHECKS.md](LAYOUT-CHECKS.md)。
