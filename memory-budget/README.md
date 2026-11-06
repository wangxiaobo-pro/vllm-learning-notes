# 推理显存预算

打开 `index.html`，选择 MHA、GQA 或压缩 MLA 教学布局，再修改参数量、权重位数、层数、缓存长度、并发和设备容量。七步追踪权重、KV 单位开销、块对齐、并发放大、预留、总量与理想并发上界。

默认算例是 7B / 16 bit 权重，32 层、8 KV heads、head dimension 128、16 bit KV、4 × 4096 tokens。权重为 14,000,000,000 bytes（约 13.0385 GiB），KV 为 2 GiB。MLA 算例仅存 `(512 + 64) × 2 bytes`，不再乘一份 V。

这是单设备容量基础知识，不是某个模型配置或部署承诺。没有 TP/PP 切分、前缀共享、量化元数据及 allocator 测量。预留是人工输入；KV pool 预分配量不再次加入请求需求。源代码链接固定到 vLLM `295c062db8a48ea73bbd05d1174cb37d24bf86f9`，只用于说明布局定义，不伪造框架执行链。

编辑 `lesson.js` 后运行仓库的 `scripts/build_lessons.py`、`scripts/update_scope_headers.py`、`scripts/build_learning_ui.py`。独立验算：`node memory-budget/verify.mjs`。
