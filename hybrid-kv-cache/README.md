# FullAttention + SWA 混合 KV

这页解释两组请求块表怎样共享一个 BlockPool，以及 prefix 命中为何需要共同可恢复边界。固定源码为 [vLLM 295c062db8a48ea73bbd05d1174cb37d24bf86f9](https://github.com/vllm-project/vllm/tree/295c062db8a48ea73bbd05d1174cb37d24bf86f9)。

- `allocate`：APC 关闭，实际实例为 `KVCacheCoordinatorNoPrefixCache`，继承公共分配/释放方法。A 已处理 12 token，window=5；SWA 释放旧块 5/4，随后 Full 获得块 5，SWA 获得块 4。请求完成后全部有效引用归零。
- `prefix`：APC 开启，使用 `HybridKVCacheCoordinator`。Full 候选命中 16，SWA 只支持恢复到 12；返回实际命中 12、`shared_prefix_boundary=16`，剩余 5 token 需要 prefill。查询本身不增加引用。

每个场景 8 步。Full/SWA 各一层，block=4 tokens、window=5、1 KV head、head dim=2、FP16；每层页大小 32 B，此例共享池每块也为 32 B。这些是缩放教学数值，不是可直接运行的 GPU backend 配置。一般的池每块字节数按最大 group 的页字节和及布局对齐约束确定，不能简单乘以 group 数。

单卡、无 CP、无 connector、无推测解码、无在途 token，`extra_retained_tokens=0`。普通 SWA 与 FullAttention 的组合有注册及分派证据；不扩展到 Mamba、R-SWA、环形缓存或任意混合页尺寸。分配场景的有效池容量为 8 个块，另有 ID 0 的保留 NULL；NULL 只是逻辑占位。Prefix 缓存可用性是给定快照，没有伪造完整的驱逐历史。

调用链分别展开分配/释放与 prefix 查找，关键深度为 5–6 层；每个节点含固定 SHA 的调用位置、实现、输入输出及返回续点。`shared_prefix_boundary` 是后续保留提示，不是已经计算的 token 数。

运行 `node hybrid-kv-cache/verify.mjs` 验证块所有权、引用/空闲守恒、队列顺序、两组 slot、窗口需求与 prefix 返回值，以及节点/边/跳转。未运行 GPU/NPU 推理或性能测试；共享构建器生成离线 HTML 与锁。
