# 通信原语交互演示

打开 [index.html](index.html)，选择一种通信操作，再用“上一步 / 下一步”查看输入、数据流和输出。第 0 步是全局关系图，底部列出完整流程；箭头小序号与流程编号对应。

包括 Send / Recv、Broadcast、Reduce、All-Reduce、All-Gather、Reduce-Scatter、All-to-All、Scatter、Gather，以及 Ring Attention 通信机制。页面可离线打开，支持窄屏、系统浅色 / 深色主题；浏览器允许时会在本机保存当前选择、掩码与步骤。

阶段颜色同时应用于节点背景、侧边色条和箭头：绿色表示已完成，蓝色表示当前执行，灰色表示未执行，并配状态文字。第 0 步使用橙色展示全局路径，不表示所有阶段已执行。Ring Attention 按本轮着色：新 K/V 到达后，计算与累计节点回到“本轮待执行”，节点内仍保留上一轮的累计数值。

## 示例与边界

- 固定 3 个 ranks，使用小数组和等长分块；归约算子固定为 SUM。root 类操作选 rank 1；点对点示例为 rank 0 向 rank 1 发送，rank 2 不参与。
- Reduce / All-Reduce 输入为 `[1,2]`、`[3,4]`、`[5,6]`，逐位置求和为 `[9,12]`。Reduce 只有 root 接收结果有效，All-Reduce 的所有 ranks 获得同一结果。
- Reduce-Scatter 输入为 `[1,2,3]`、`[4,5,6]`、`[7,8,9]`；逻辑归约结果为 `[12,15,18]`，各 rank 分别得到 `[12]`、`[15]`、`[18]`。
- Gather / All-Gather 按来源 rank 顺序拼接，不做加法；Scatter 分发不同分块，Broadcast 分发相同数据。
- All-to-All 每个输入的第 j 段发给目标 rank j；每个输出按来源 rank 排列。例如输入 `[0,1,2]`、`[10,11,12]`、`[20,21,22]`，输出为 `[0,10,20]`、`[1,11,21]`、`[2,12,22]`。
- 图中的 SUM 框是语义运算，不是物理中转 rank。All-Reduce 的“归约后分发”、Reduce-Scatter 的“归约后分片”只是解释其结果，不指定 root、临时完整数组或 NCCL 的具体 ring / tree 算法。
- 按来源或目标逐步展示是教学顺序，不要求实际通信串行。虚线表示本地贡献或复制；图中的输出列是同一组 ranks 的接收缓冲，不是另外三个设备。
- Send / Recv 需要两侧匹配；图中“结果可用”表示通信操作完成后，不代表主机 API 返回就等于 GPU 完成。原始发送输入不会因为发送而被删除。未展示非等长 Alltoallv、原地缓冲别名、stream/event 同步或底层网络路径。
- 依据官方操作语义制作，未进行 NCCL / GPU / NPU 运行或性能测试。原语 API 可用性及算法选择随 NCCL 版本和配置变化。

## Ring Attention：固定 Q，沿环传 K/V

在“通信操作”中选择 **Ring Attention**，可对照 Causal 与 Full 两种掩码，逐步查看 3 轮来源遍历与块计算、2 次 K/V 交换及最终输出。“全局关系”可随时回到完整编号流程。

- 同一序列沿 token 轴切到 3 个 ranks，每卡 1 个 token；Q/K/V 均为 `1×2`，属于已投影后的 Attention core 输入。K/V 沿 `0 → 1 → 2 → 0` 传递，Q 始终本地保留。
- 第 t 轮 rank r 使用来源 `(r−t+3)%3` 的 K/V。发送当前块给后继，同时从前驱接收下一块；接收完成后才能消费，发送完成后才能重用发送缓冲。原始数据不会因发送而被删除。
- 本地累计 `m`（最大 score）、`l`（稳定指数和）、`u`（未归一化加权和）；合并新块时按新的最大值重缩放，最后 `O=u/l`。不能直接相加或平均各块的局部 softmax 输出，也不需要对最终 O 做 All-Reduce。
- Causal 使用全局 token 位置 `key≤query`。全 mask 块跳过累计、保持 m/l/u；本例仍转发该块，供后续 rank 使用。3 轮是来源遍历次数，不保证每 rank 都执行 3 次有效计算。
- 计算当前 K/V 与预取下一块可以重叠，图中分步只用于说明依赖。每个接收缓冲被消费前需要完成依赖，异步提交不等于 GPU/网络操作完成。动画没有模拟真实耗时。
- 最终 O 是本地 query 对应的 head 输出，位于 `o_proj` 之前；未计算 Norm、FFN、输出投影及反向传播。这是 Ring Attention 算法教学，不代表本仓库另一页所选 vLLM DCP 路径使用 Ring Attention。
- 本例省略最后一次无用轮转，因此是 P 轮遍历与 P−1 次交换。作者 JAX 实现的循环体含无条件 `ppermute`，源码调用次数不应直接等同于本教学步骤，也不代表编译后的真实网络次数。

完整精度输入、逐轮状态与串行参考在 [ring-attention-example.json](ring-attention-example.json)。运行 `python communication-primitives/verify_ring_attention.py`，用独立的稳定 softmax 前缀计算检查每轮状态与最终结果，并检查因果跳过、大 score 数值稳定性和环覆盖。验证不代表 GPU/NPU 执行或性能测试。

例如 rank 0 的最终 O：Full 为 `[1.6893, 0.7330]`，Causal 为 `[1, 0]`。后者只能看位置 0，两个未来 K/V 块虽经过该 rank，却不改变其累计状态。

## 与并行流程的对应

配合 [vLLM 并行流程](../parallelism/index.html) 查看：

| 通信原语 | 在本仓库并行示例中的作用 |
| --- | --- |
| Send / Recv | PP Worker 传输相邻 stage 之间的中间激活 |
| All-Reduce | TP MLP 合并输出部分和，每个 rank 得到完整输出 |
| All-Gather | SP 汇集 token 行；所选 DCP 路径汇集 Q heads 或 LSE |
| Reduce-Scatter | SP 求和后按 token 分片；DCP 对校正后输出求和并恢复 head 分片 |
| All-to-All | EP dispatch / combine 的逻辑交换模式；实际通信、加权与归并由后端决定 |
| Ring Attention | Context/sequence 分片的一种 Attention 算法；使用点对点 K/V 环传，不是同名 NCCL 集合原语 |
| Broadcast / Reduce / Gather / Scatter | 展示通用操作语义，不表示六种并行示例都直接调用这些原语 |

## 参考来源

- [NVIDIA NCCL：Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
- [NVIDIA NCCL：Point-to-point communication](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/p2p.html)
- [Ring Attention 论文](https://arxiv.org/abs/2310.01889)
- [作者实现：Q 固定与 K/V 轮转，基线 d2ea1af](https://github.com/haoliuhl/ringattention/blob/d2ea1af9a288f85ea2fd74690ece1c16d2eebc83/ringattention/ringattention_jax.py#L25)
- [作者实现：在线 softmax 修正与 causal 跳过](https://github.com/haoliuhl/ringattention/blob/d2ea1af9a288f85ea2fd74690ece1c16d2eebc83/ringattention/ringattention_jax.py#L125)

核查日期：2026-11-03。基础原语展示操作语义，Ring Attention 展示算法机制，均不对应某个 vLLM commit 的具体通信后端。
