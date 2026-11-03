# 通信原语交互演示

打开 [index.html](index.html)，选择一种通信操作，再用“上一步 / 下一步”查看输入、数据流和输出。第 0 步是全局关系图，底部列出完整流程；箭头小序号与流程编号对应。

包括 Send / Recv、Broadcast、Reduce、All-Reduce、All-Gather、Reduce-Scatter、All-to-All、Scatter 和 Gather。页面可离线打开，支持窄屏、系统浅色 / 深色主题；浏览器允许时会在本机保存当前选择与步骤。

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

## 与并行流程的对应

配合 [vLLM 并行流程](../parallelism/index.html) 查看：

| 通信原语 | 在本仓库并行示例中的作用 |
| --- | --- |
| Send / Recv | PP Worker 传输相邻 stage 之间的中间激活 |
| All-Reduce | TP MLP 合并输出部分和，每个 rank 得到完整输出 |
| All-Gather | SP 汇集 token 行；所选 DCP 路径汇集 Q heads 或 LSE |
| Reduce-Scatter | SP 求和后按 token 分片；DCP 对校正后输出求和并恢复 head 分片 |
| All-to-All | EP dispatch / combine 的逻辑交换模式；实际通信、加权与归并由后端决定 |
| Broadcast / Reduce / Gather / Scatter | 展示通用操作语义，不表示六种并行示例都直接调用这些原语 |

## 参考来源

- [NVIDIA NCCL：Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
- [NVIDIA NCCL：Point-to-point communication](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/p2p.html)

核查日期：2026-11-03。此页面展示通信语义，不对应某个 vLLM commit 的具体通信后端。
