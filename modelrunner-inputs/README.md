# GPU ModelRunner 输入打包

这页沿 GPU MRV1 的真实调用关系，解释持久请求状态如何变成本轮紧凑输入，以及采样后哪些状态写回。固定源码为 [vLLM 295c062db8a48ea73bbd05d1174cb37d24bf86f9](https://github.com/vllm-project/vllm/tree/295c062db8a48ea73bbd05d1174cb37d24bf86f9)。

- `normal`：A/B 常驻，C 加入；本轮 packed IDs 为 `[13,14,25,31,32,33]`。
- `change`：下一轮 B 结束，C 从行 2 压紧到行 1；packed IDs 为 `[15,34]`。
- 两种场景各 9 步；位置、query offsets、逻辑块、物理 slot、输出表使用同一计算结果。

范围为单 GPU、同步调度、eager、普通文本、一个 FullAttention 组、TP/PP/CP=1，无推测解码、连接器、LoRA。固定本例未触发后端重排的行顺序；这不是所有后端的默认排序保证。`block=4` 是缩放教学尺寸，不能据此断言 GPU attention kernel 支持该运行配置。采样 ID 是给定教学输出，没有计算真实 logits 或运行 GPU/NPU。

调用链的关键层级达到 6 层，区分 `execute_model` 和独立的 `sample_tokens` 阶段。采样只追加已知 token 和输出 IDs，`num_computed_tokens_cpu` 由下一轮调度增量更新。InputBatch 删除/压紧块表行也不等于 Scheduler 释放 KV 物理块。

图按数据依赖组织；第 5 步合并展示设备缓冲准备。源码的 block table commit 在 `_prepare_inputs` 开头，`_prepare_input_ids` 的调用在 slot mapping 调用之后；图不是逐 Python 语句执行记录。

运行 `node modelrunner-inputs/verify.mjs` 验证独立枚举的 token、offset、slot、压紧与回写结果，以及节点/边/跳转一致性。共享构建器生成 HTML 和源码锁；`lesson.js` 不访问 DOM 或网络。
