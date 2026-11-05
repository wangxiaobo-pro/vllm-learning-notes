# 注意力机制逐步演算

用浏览器打开 [index.html](index.html)，选择机制，点「执行下一步」跟踪输入、中间值和输出。「自动执行」支持暂停并从同一帧继续。完整图上的每个步骤都可以点击重播。

| 想观察的计算 | 可选演示 |
| --- | --- |
| 一个查询如何得到输出，多个查询头如何读取 KV | 普通因果注意力、MHA、MQA、GQA |
| 哪些历史位置参与本次计算 | SWA、StreamingLLM、Block-Sparse |
| KV 怎样分块计算或分页寻址 | FlashAttention、PagedAttention |
| 状态怎样跨 token 更新，再传给下一层 | SSM 混合架构、KDA |
| 如何压缩 KV、加入位置信息、筛选历史记录 | MLA、DSA、DeepSeek V4 的 CSA 与 HCA |
| 如何跨层共享 KV，在候选池内重选或沿用位置 | DeepSeek V4.1 的 CSA2，含 Full、Reindex 与 Reuse |

例如，选择 PagedAttention，把跟踪位置设为 `t₄`。每页存两个 token，其零基位置 3 对应逻辑块 1、偏移 1。块表将逻辑块 1 映射到物理块 2，最终从槽 `2 × 2 + 1 = 5` 读出 K 和 V。下一步可以看到当前查询如何给四个位置分配权重。

图内矩阵、窗口和块大小采用可手算的教学值。每幅图下方附有对应论文或模型配置。[可编辑图源](source.html)

CSA2 默认展示 8 步。首段独立演示编码器的非重叠压缩，之后用解码器的六条主 KV 跟踪 Full 的 Top-2、块候选池、Reindex 重选及 Reuse 读出。每层的主查询和局部 KV 都由图中的本层输入生成。教学设 RoPE 与输出投影为单位映射、忽略量化，完整流程的来源见图下方链接。[技术报告](https://arxiv.org/html/2609.19969v1#S2.SS3)
