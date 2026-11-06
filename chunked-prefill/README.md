# Chunked prefill

用浏览器打开 [index.html](index.html)，切换两种历史调度策略，通过“全局关系”和“上一步 / 下一步”查看流程。每种策略包含 12 个讲解步骤，展示 CPU 调度、GPU 执行、各请求的 KV 与输出 token 变化。两侧始终用 A 表示长 prompt，B / C 表示已有 Decode 请求。

[index.html](index.html) 是可离线打开的独立页面；[source.html](source.html) 保留原流程图的可编辑 HTML 片段。默认展示第二项“不分块：prefill 优先”。

## 两种调度策略

| 策略 | 初始请求 | Prefill 阶段 | 后续 Decode |
| --- | --- | --- | --- |
| V1 分块混合，预算 8 | A 有 18 个 prompt token；B / C 已在 decode | 调度 1–3：每次 A 处理 6 个 prompt token；B / C 各处理 1 个 decode 输入 | 调度 4：A 首次执行 decode，B / C 继续推进 |
| V0 整段优先，预算 32 | 同样的 A、B、C | 调度 1：一次 A 整段 prefill；三个内部观察点中 B / C 等待，token 与 KV 不增长 | 调度 2：A / B / C 各执行一次 decode |

分块示例中，A 的累计 prompt 处理量为 6 → 12 → 18，首 token `y1` 在第 3 轮末产生；第 4 轮将 `y1` 作为输入并生成 `y2`。B / C 则分别从 `b0 / c0` 连续推进到 `b4 / c4`。

不分块示例中，A 的 18 个 token 在调度 1 一次提交。观察点 1–3 属于这同一次执行，**不是三次调度，也不是三块各 6 个 token**。A 在观察点 3 完成 prefill 并返回 `y1`；调度 2 才处理 `y1 / b0 / c0`，返回 `y2 / b1 / c1`。观察点不表示固定耗时或性能比例。

## 示例条件与源码基线

- 分块策略对应 vLLM **v0.11.0 / V1**。每轮总输入预算为 8，RUNNING 顺序为 B → C → A，B / C 各占 1，留给 A 的 prefill 配额为 6。
- 不分块策略对应 vLLM **v0.6.6 / V0** 的历史 prefill-first 策略。输入预算为 32，`max_model_len = 32`，能够一次接收 A 的 18 个 prompt token。两个示例的预算和版本不同，不能视为同一 V1 配置的开关对比；这些差异也直接标在选择器与说明中。
- 使用普通自回归文本生成、全因果注意力与单 GPU 示意；无前缀命中、推测解码或抢占，KV 容量充足。已采样的 token 到下一次作为模型输入执行时，才写入自己的 KV。
- 图中的等待在 A 完成后结束；持续到来的高优先级 prefill 可能进一步延长等待。页面是源码语义的教学演示，未运行模型或进行硬件性能测量。

参考：[V1 chunked prefill 说明](https://docs.vllm.ai/en/v0.11.0/configuration/optimization.html#chunked-prefill)、[V1 Scheduler](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/core/sched/scheduler.py#L179-L224)、[V0 prefill 优先说明](https://docs.vllm.ai/en/v0.6.6/usage/performance.html#chunked-prefill)、[V0 完整 prefill 时跳过 decode](https://github.com/vllm-project/vllm/blob/v0.6.6/vllm/core/scheduler.py#L1072-L1088)。页面内还保留输出判定和 KV / attention 的源码链接。

返回[项目导航](../index.html)。
