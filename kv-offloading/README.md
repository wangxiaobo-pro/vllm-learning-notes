# KV Offloading 的设备结构

用浏览器打开 [index.html](index.html)。在「全局关系」中沿橙色箭头对照同一段 KV 在两次请求中的位置。点击「下一步」或「播放流程」，可以看到 CPU 副本何时可命中，以及请求 B 何时可以读取新设备块。

| 前缀 token | A 的 NPU 源块 | CPU 槽 H3 | B 的 NPU 目标块 | 示例 K / V |
| --- | --- | --- | --- | --- |
| 1–128 | D7 | 子块 0 | D4 | 1 / 2 |
| 129–256 | D11 | 子块 1 | D9 | 3 / 4 |

图中使用 Ascend V1 的原生 `OffloadingConnector`、单 Worker 和单层 CPU 缓存。每个 NPU 块覆盖 128 个 token，`blocks_per_chunk=2`。假设 A 结束后原设备块已被复用，B 的前 256 个 token 在主存命中。回载完成后，B 复用这些 KV，只计算第 257–260 个 token 的 prefill。

每行数值只取该块首个 token 在同一个 head 上的一个 BF16 分量。实际拷贝涵盖整块 KV。块号与数值用于教学，流程依据源码静态核对。

## 源码与维护

- 调度器生成写出作业、匹配前缀并为回载作业绑定目标块。[vLLM 调度端实现](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py)
- Worker 把设备块与 CPU 子块转换为拷贝描述符，通过 NPU 流提交传输并查询完成事件。[Ascend CPU/NPU 搬运实现](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py)
- [source.html](source.html) 是可编辑的图源。[index.html](index.html) 是可直接打开的独立页面，最大阅读宽度为 736px。

[返回项目导航](../index.html)
