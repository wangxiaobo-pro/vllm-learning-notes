# vLLM 请求完整生命周期

用浏览器打开 [index.html](index.html)，跟随一个流式聊天请求，从 HTTP 接入走到最后一段 SSE、KV 块引用释放与 Worker 清理。点击“全局关系”查看完整路径，用“上一步 / 下一步”检查每一步的输入、动作、结果与源码依据，也可从完整编号流程直接跳转。

[index.html](index.html) 是可离线打开的独立页面，无需安装依赖；[source.html](source.html) 保留可编辑的可视化源片段。GitHub 的文件链接通常显示 HTML 源码，下载后请使用浏览器打开。

源片段由可视化工具的 `render.py` 封装为独立页面。重新导出时，保留外层 iframe 的 `max-width:736px` 与居中样式，并将页面语言设为 `zh-CN`。本页未使用图标或浮动提示，导出文件已移除对应的可选 CDN 脚本；样式、流程数据和交互脚本均已内嵌。

## 示例与流程

固定 **vLLM v0.11.0、V1、单卡、UniProcExecutor、同步调度、流式聊天**。模型权重与 GPU KV 池已在服务启动阶段准备好，本页从收到请求开始。

- 教学请求 `R1` 的 prompt 为 `[p1, p2, p3, p4]`，`max_tokens=3`，依次生成 `t1、t2、t3`。
- 一轮 Prefill 输入 4 个 prompt tokens 并生成 `t1`；随后两轮 Decode 分别输入 `t1` 和 `t2`，生成 `t2` 和 `t3`。
- 教学块 `B7` 有 16 个槽位。调度器先分配块与槽位，GPU 前向才写入物理 K/V；结束时释放请求对块的引用，不表示销毁启动阶段创建的 GPU KV 池。
- 总计生成 3 个 tokens，但前向实际输入为 4 + 2 = 6 个 tokens；最后采样得到的 `t3` 未进入下一轮前向，因此没有为它计算 KV。

| 步骤 | 查看内容 |
| --- | --- |
| 1–5 | HTTP 接入、聊天模板与分词、前端注册、ADD 跨进程发送、进入 WAITING |
| 6–10 | Prefill 调度与块分配、设备输入准备、GPU 前向与采样、结果回传和判停 |
| 11–12 | 前端增量解码、首段 SSE 返回客户端 |
| 13–17 | 两轮 Decode、已有 KV 复用、输出 token 与实际 KV 覆盖范围的变化 |
| 18–20 | 长度终止、释放 KV 引用、最终 SSE 与 Worker 状态清理 |

页面区分调用 / 调度、输入数据、结果 / 完成通知；全局图的箭头编号与 20 步列表对应。KV 槽位和三轮计算摘要随当前步骤更新。

## 适用范围与分支

- 主线为纯文本、decoder-only full attention，单请求展示、token 预算充足、前缀缓存无命中；不包含投机解码或 PD 分离。
- “等待、中断与缓存分支”补充预算或块不足、抢占、分块 Prefill、前缀缓存命中、EOS / stop token、字符串 stop 和客户端断连的处理位置。
- 请求结束后释放的是请求占用和引用；完整缓存块的复用、空闲块队列与物理 KV 池的生命周期需要分别理解。
- 编号用于教学，表示一种合法交错顺序。前端发送与引擎后续计算可以重叠；步骤 19 与 20 都依赖步骤 18，彼此没有固定先后。
- token、可输出文本片段和 SSE chunk 不保证一一对应。`p/t`、`R1`、`B7` 与 16 槽均为教学标识，未运行真实模型或测量推理性能。

## 源码基线

流程固定于 [vLLM v0.11.0](https://github.com/vllm-project/vllm/tree/v0.11.0)，不随仓库主分支变化。页面各步骤保留对应源码链接，主要入口包括：

- [HTTP 与 SSE 入口](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/entrypoints/openai/api_server.py#L583-L621)
- [AsyncLLM 请求注册与提交](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/engine/async_llm.py#L261-L313)
- [EngineCore：schedule → execute → update](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/engine/core.py#L272-L291)
- [Scheduler：调度与 KV 块分配](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/core/sched/scheduler.py#L379-L529)
- [GPUModelRunner：前向与采样](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/worker/gpu_model_runner.py#L2231-L2367)
- [Scheduler：释放请求与 KV 引用](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/core/sched/scheduler.py#L1147-L1165)
- [Worker：清理 finished_req_ids](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/worker/gpu_model_runner.py#L526-L546)

已在阻断网络时检查首页导航、全部 20 个步骤、首尾按钮、展开分支与源码依据、刷新后的步骤恢复，以及 736px、352px、320px 内容宽度和明暗主题。验证对象是页面与交互，不代表实际模型推理。

返回[项目导航](../index.html)。

### 深入调用链的阅读边界

调用链已展开到 `_add_request()`、执行器/Worker/Runner、持久批次准备、采样、判停与 KV 释放。节点的父子关系表示实际调用或注明的任务提交；EngineCore、前端输出任务和后续 Worker 清理保留为独立执行入口。collector 只传递数据并唤醒生成器，不表示同步调用 SSE。

子调用复用原图中对应阶段的入口；没有独立快照时，节点注明只定位所属阶段。调用编号可随展开调整，原节点 ID 保持稳定；源码证据的调用点与实现均以场景声明的完整 commit 为准。

## 连线可读性

双列布局中，HTTP/SSE、ADD/IPC 及设备输入/结果采用不同方向的独立通道，标签位于横线之上，保留完整箭身和箭头。窄屏继续使用上下两条分离通道。全局及 20 个步骤在 320、736、1440px 暗色布局验证通过。
