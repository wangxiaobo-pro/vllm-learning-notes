# vLLM 并行流程

用浏览器打开 [index.html](index.html)，切换 TP、EP、SP、PP、CP、DP，再选择“全局关系”或“下一步”。全局视图下方有完整编号流程；步骤视图展示此步完成后各 rank 的状态。箭头小序号表示通信步骤，节点内序号表示本地动作。

## 覆盖范围

| 方式 | 连续示例 | 主要通信 |
| --- | --- | --- |
| TP | 同一批 4 tokens，两层 MLP 的特征分片与输出部分和 | All-Reduce |
| EP | 同一 MoE 层，2 ranks、4 experts、top-2 | Dispatch / Combine，All-to-All 语义 |
| SP | DeepSeek 连续 MoE 层，8 tokens 的 activation 分片 | All-Gather / Reduce-Scatter |
| PP | 6 层分到 3 stages，本地返回与真正发送 | Send / Recv |
| CP | FlashAttention DCP，历史 KV 按位置分片 | Q / LSE All-Gather，校正后 Reduce-Scatter |
| DP | Dense 推理中两个不同请求进入独立 EngineCore | 请求路由与负载协调 |

PP 额外包含三个 batch 在三个 stage 上重叠推进的等时示意；时间槽不代表实测耗时，也未计通信成本。

对应的通信原语操作可在 [通信原语项目](../communication-primitives/index.html) 单独查看。

## 源码基线与边界

静态核对 upstream vLLM commit [`295c062db8`](https://github.com/vllm-project/vllm/tree/295c062db8a48ea73bbd05d1174cb37d24bf86f9)。示例尺寸、token、专家权重分数均为教学数据，未运行分布式 GPU/NPU 性能实验，不承诺加速比。

- TP 固定 ColumnParallelLinear → 激活 → RowParallelLinear，关闭 bias，`gather_output=False`、`input_is_parallel=True`、`reduce_results=True`。权重形状采用 PyTorch 的 `[out,in]`。
- EP 固定 DeepEP LL、top-2、无 EPLB、`apply_router_weight_on_input=False`；该路径在 combine kernel 中加权归并，其他后端的位置可不同。
- SP 固定 `use_sequence_parallel_moe`、TP=2、PP=1。它是 activation/token 分片，不等同于 Ulysses，也不定义历史 KV 的所有权。
- PP 固定普通 V1 Runner、Qwen2、`broadcast_pp_output=False`。`irecv_tensor_dict` 先接收元数据，再分配缓冲并提交 tensor 接收；模型返回 `IntermediateTensors` 与 Worker 提交发送明确分开。
- CP 选用 DCP `ag_rs` 分支，PCP=1、TP=DCP=2、interleave=1。它复用此 TP 组；PCP、`a2a` 与 MLA 专用分支另有实现。历史 context 不包括当前 query chunk；两部分各算 attention 后按 LSE 合并。
- DP 选择 dense、DP=2、TP=PP=1。MoE+EP 可跨 DP ranks 进行专家通信，不能套用 dense 的独立 hidden 计算假设。
- 图中的双向 collective 箭头仅表达参与者与数据依赖，不指定 NCCL/HCCL 的底层 ring/tree 拓扑。并行维度也不能一概相乘来计算设备数。

## 源码入口

- [TP Linear](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/model_executor/layers/linear.py#L603)
- [EP DeepEP LL dispatch / combine](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/model_executor/layers/fused_moe/prepare_finalize/deepep_ll.py#L286)
- [SP DeepSeek decoder layer](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/model_executor/models/deepseek_v2.py#L1352)
- [PP Worker 接收与发送](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/worker/gpu_worker.py#L1277)
- [CP DCP FlashAttention](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/attention/backends/flash_attn.py#L1595)
- [CP LSE 校正 / Reduce-Scatter](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/attention/ops/dcp.py#L438)
- [DP 路由选择](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/engine/core_client.py#L1642)

页面为自包含离线 HTML，源码链接需要联网。各步骤里的“实现边界与源码”可展开查看该模式的精确入口。
