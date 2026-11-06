# 静态批处理与连续批处理

[打开交互页面](index.html) · [返回项目目录](../README.md)

同一组 A、B、C、D 请求，分别演示固定成员的静态批处理和每轮重新调度的连续批处理。默认打开对比视图，也可切换到任一模式，用“全局关系”“上一步 / 下一步”和播放控件跟踪完整过程。

## 打开方式

下载 `index.html` 后用浏览器直接打开。页面包含所需样式和脚本，无 CDN、字体或图片依赖，主要交互可离线使用；点击源码依据链接才会访问外网。GitHub 上的 HTML 链接通常显示源码。

`source.html` 是保留的可编辑可视化片段；`index.html` 是补齐样式与运行环境后的独立页面。

## 具体例子

| 请求 | 进入等待队列 | Prompt tokens | 输出 tokens |
| --- | --- | ---: | ---: |
| A | 第 1 轮前 | 4 | 3 |
| B | 第 1 轮前 | 2 | 2 |
| C | 第 2 轮前 | 4 | 3 |
| D | 第 3 轮前 | 2 | 2 |

到达轮次分别使用各模式自己的逻辑轮次，不代表同一条真实时间轴。`P4` 表示本轮处理 4 个 prompt tokens；`D1` 表示本轮处理 1 个 decode 输入 token。Prefill 完成后可采样出首个输出 token，输入 tokens 与新输出 tokens 分开计数。

- 静态批处理：A、B 构成第一批；B 先结束后释放 KV，但它留下的空位不接入新请求。A 结束后，C、D 才组成下一批，共 6 轮。
- 连续批处理：每轮检查等待队列；C 在第 2 轮加入，D 在第 3 轮加入，结束的请求退出并释放 KV，共 4 轮。
- 两侧均处理 18 个有效输入 tokens，生成 10 个输出 tokens。静态侧空位不计入有效输入量，实际 padding 或无效计算成本没有模拟。

每轮按四步展开：① 请求准入与调度 → ② Worker 执行模型并采样 → ③ 更新结果、判断结束并释放 KV → ④ 流式输出并进入下一轮。KV 数字表示已计算 token 的逻辑位置数量，不是显存字节或物理块数。

## 实现范围与依据

连续批处理流程以 **vLLM v0.11.0 的 V1 同步路径**为依据；静态批处理是用于比较的算法教学模型，不是该版本中的另一个实现分支。

例子采用 FCFS、足够的 KV 容量与调度预算、完整注意力；不展开推测解码、前缀缓存、抢占、流水线并行或提前 EOS。图中的 Prefill / Decode 是讲解标签，V1 调度器以待计算 token 数统一调度。示例每次完整处理 prompt，不拆分 prefill。

- [EngineCore.step：调度、执行与结果更新](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/engine/core.py#L250-L267)
- [Scheduler.schedule：按 token 预算调度](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/core/sched/scheduler.py#L164-L201)
- [结果更新与请求结束处理](https://github.com/vllm-project/vllm/blob/v0.11.0/vllm/v1/core/sched/scheduler.py#L837-L893)
- [官方 Chunked prefill 说明](https://docs.vllm.ai/en/v0.11.0/configuration/optimization.html#chunked-prefill)

轮次用于说明调度差异；各轮计算量不同，**6 轮与 4 轮不能换算为实测耗时或加速比**。页面是教学模拟，未运行模型或硬件性能测试。

### 深入调用链的阅读边界

连续侧的调用链展开了 KV 分组分配、执行器到 Worker 的分派、InputBatch 压紧与输入打包、采样和结束释放。静态侧仍是 `provenance: teaching` 的算法对照，不绑定伪造的 vLLM 函数。复用已有 KV 槽时，每组分配函数可以返回空的新块列表；不表示每轮都从块池申请新块。

子调用复用原图中对应阶段的入口；没有独立快照时，节点注明只定位所属阶段。调用编号可随展开调整，原节点 ID 保持稳定；源码证据的调用点与实现均以场景声明的完整 commit 为准。
