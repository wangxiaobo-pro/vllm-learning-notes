# 异步调度：计划先行，token 稍后回报

对照同步和异步配置，观察请求 A 的 `[7,8,9]` 经两轮前向生成教学输出 `[11,22]`。两模式都有九个观察点；它们不是九轮调度，也不代表等间隔时间或性能比值。

## 固定范围

GPU MRV1、UniProcExecutor、TP=PP=DP=1、普通文本生成；KV 充足，无抢占、推测解码、结构化输出或 LoRA。异步为 `async_scheduling=True`、队列容量 2；同步为 `False`，实际源码不建立 `batch_queue`。同步图中的“待消费轮次”只是便于对照的逻辑量。

## 需要区分的状态

1. Scheduler 的 `num_output_placeholders` 是预期输出数量，不保存未知 token ID。
2. Worker 的 CPU 输出影子可在 host 派发时先写 `-1`，GPU 真实采样结果尚未产生；`-1` 不作为模型输入。
3. 下一轮输入依赖 GPU 的 `prev_sampled_token_ids`。允许 CPU 先安排位置，不允许 GPU 越过前轮采样的数据依赖。
4. 异步输出的 D2H 完成事件经 `get_output()` 同步后，Scheduler 才能读取并追加真实 token。
5. `computed` 是调度前沿；`in_flight` 是已计划未回报输入。两者之差是回报已确认输入数，仍须与教学观察到的实际 GPU 完成量区别。

第 4 步异步模式已计划两轮：`known=3, computed=4, in_flight=4, placeholders=2`，真实输出均未知。第 6 步回报 11 后占位减到 1；第 8 步回报 22 后归零。实际前向输入是 3+1=4 个位置，最后输出 22 没有自身 KV。第 9 步汇总 Scheduler 释放和后续 Worker 清理，逻辑释放不要求擦除旧物理字节。

调用链保留 `EngineCore → UniProcExecutor → Worker → GPUModelRunner` 与输入准备子调用；采样 future、事件等待和 Scheduler 回写各有独立节点。同步变体的 `sample_tokens` 是 `execute_model` 返回 `None` 后的条件分支，不能扩展为所有配置必走。独立验证覆盖 18 个快照、计数守恒、未知值时序、最终 KV/输出差异及输出上限抑制多余轮次。

## 文件与复现

- `lesson.js`：同一份计算结果驱动节点状态、箭头、表格和九步观察点。
- `call-chain.json`：实际调用树，含调用位置/实现、输入/状态/输出/返回续点及精确步骤跳转。
- `call-chain-adapter.js`：调用公共工作台的 `lessonController.openTarget`；参数恢复与目标验证由公共控制器处理。
- `verify.mjs`：独立数值/状态校验，运行 `node <本目录>/verify.mjs`。
- `index.html`：由根目录 `scripts/build_lessons.py` 生成；不直接编辑生成页。

固定源码为 [vLLM `295c062db8a48ea73bbd05d1174cb37d24bf86f9`](https://github.com/vllm-project/vllm/tree/295c062db8a48ea73bbd05d1174cb37d24bf86f9)。证据引用的是该 Git 对象的实际行号，不依赖工作区当前行号。这里完成了静态源码核对和 JavaScript 教学演算；未执行 GPU、外部语法库或性能测试。共享 UI 校验由整站构建后执行。
