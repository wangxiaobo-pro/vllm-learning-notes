# 投机解码

用浏览器打开 [index.html](index.html)。在“全局关系”中查看 Scheduler、Ascend Worker 和采样器如何配合，再用“上一步 / 下一步”跟随同一个请求。切换验证结果，可以比较首个不匹配位置如何影响输出和下一轮输入。`index.html` 是可离线打开、可直接编辑的独立页面。

## 一轮能多生成几个 token？

示例采用 vLLM V1 同步调度、Ascend Model Runner V1 和普通 DeepSeek MTP。单请求使用贪心采样，提议器逐个生成候选。`K=3`，本轮预算足以验证三个候选，请求尚未触发停止条件。所有 token ID 均为教学设定。

1. Prefill 计算 4 个 prompt token，目标模型采样得到 `20`。此时请求的正式序列长度为 5，目标模型已计算前 4 个位置的 KV。
2. MTP 提议器先给出 `21`，再依次以上一步的候选作为输入，生成 `22`、`23`。调度器收到候选后，安排下一轮计算 `5 + 3 − 4 = 4` 个输入位置，先把 `num_computed_tokens` 从 4 预记到 8。
3. 目标模型在一次前向中处理 `[20, 21, 22, 23]`。前三个位置产生的 logits 分别检验 `21`、`22`、`23`，最后一个位置产生 bonus token 的 logits。

| 验证结果 | 本轮新增的正式 token | 接受 / 拒绝候选数 | 更新后 `num_computed_tokens` | 正式序列长度 | 下一轮首个输入 |
| --- | --- | --- | --- | --- | --- |
| 第二个候选不匹配，目标模型选 `29` | `[21, 29]` | 1 / 2 | `8 − 2 = 6` | 7 | `29` |
| 三个候选全部匹配，bonus 为 `24` | `[21, 22, 23, 24]` | 3 / 0 | `8 − 0 = 8` | 9 | `24` |
| 首个候选不匹配，目标模型选 `28` | `[28]` | 0 / 3 | `8 − 3 = 5` | 6 | `28` |

第二个候选不匹配时，后续 logits 已经用 `22` 作为上下文，不能用于接在 `29` 后面。调度器把有效计算长度回退到 6，下一轮从位置 6 输入 `29`。这个回退描述的是请求接下来可以复用的前缀长度，物理 KV 块仍由 KV 缓存管理器管理。

## 对照源码

- **MTP 逐个生成候选**。提议器工厂为普通 DeepSeek MTP 选择 `AscendEagleProposer`。Runner 传入目标模型状态和最新采样 token，提议器先生成第一个候选，再循环 `K − 1` 次，把每个候选喂回下一步。[选择提议器](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/__init__.py#L52-L60) · [首个候选](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/llm_base_proposer.py#L1616-L1625) · [输入上一候选](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/llm_base_proposer.py#L1672-L1683) · [返回整批候选](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/llm_base_proposer.py#L1762-L1777)
- **计划进入 Worker**。`EngineCore.step()` 先调用 `schedule()`。Scheduler 把本轮实际安排的候选写入 `scheduled_spec_decode_tokens`，引擎把这份计划交给 `execute_model()`，需要单独采样时再调用 `sample_tokens()`。[引擎执行入口](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/engine/core.py#L644-L670) · [调度器打包候选](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L839-L865)
- **目标模型验证候选**。Ascend Runner 运行目标前向并计算 logits。有投机元数据时，`_sample()` 调用 `AscendRejectionSampler`。贪心验证保留首处不匹配之前的连续前缀，在该位置输出目标模型选中的 token。全中时追加 bonus。[目标模型前向与 logits](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/worker/model_runner_v1.py#L2681-L2744) · [采样分发](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/worker/model_runner_v1.py#L3058-L3081) · [贪心验证与 bonus](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/sample/rejection_sampler.py#L850-L894)
- **正式输出与下一轮草稿**。Runner 调用 `propose_draft_token_ids()` 准备下一轮候选。EngineCore 先用 `update_from_output()` 按拒绝数回退计数、逐 token 追加并检查停止条件，然后在 `post_step()` 获取草稿，把候选写入仍在运行的请求。[Worker 生成候选](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/worker/model_runner_v1.py#L2913-L2934) · [更新计数](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L2104-L2127) · [追加并判停](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L2492-L2509) · [引擎取草稿](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/engine/core.py#L675-L682) · [Scheduler 登记草稿](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L2549-L2568)

图中结果用于讲解源码行为，未运行真实模型或测量 NPU 性能。

返回[项目导航](../index.html)。
