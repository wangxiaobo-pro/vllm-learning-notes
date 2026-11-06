# 前缀 KV 缓存

打开[单步执行器](index.html)，选择 vLLM 或 SGLang，点「下一步」推进一个动作，点「上一步」回到此前的缓存状态。「播放一次查找」从 R2 入队演示到调度器收到匹配结果。两页分别保留当前步数。

全局图、当前步骤和下方「完整编号流程」共用 1–8 的动作编号。vLLM 的查表边为③·④、返回⑤、分配登记⑥、下发⑦、Worker 读写⑧；同一动作涉及多条边时使用相同编号。点击流程列表可直接跳到任一步。

R1 的输入是 `ABCDEF`，随后到来的 R2 是 `ABCXEF`。每个字母代表一个 token。在 vLLM 页，每块两个 token，第二块从 `CD` 变成 `CX`，因此 R2 只能复用第一块 `AB`。在 SGLang 页，每页一个 token，查询会在 `ABC` 后拆开旧节点。第 7 步 Worker 写入 `XEF` 的 KV，第 8 步才把它登记为新叶。

图采用本地全注意力场景。vLLM 使用单缓存组并按整块查找，SGLang 使用 `UnifiedRadixCache`。块号、槽位和哈希符号均为教学取值。[vLLM 查表源码](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/kv_cache_manager.py#L264-L321) · [SGLang 匹配源码](https://github.com/sgl-project/sglang/blob/17e94c4677d7beb58a89b104fd61b3768994e45e/python/sglang/srt/mem_cache/unified_radix_cache.py#L639-L652)

[双工作表 Excel 图解](Prefix-KV-Cache.xlsx) · [可编辑图源](source.html)
