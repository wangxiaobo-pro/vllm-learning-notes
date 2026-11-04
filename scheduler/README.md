# Scheduler.schedule() 调度流程

用浏览器打开 [交互流程图](index.html)。默认的「上下游数据流」沿用[并行机制图](../parallelism/index.html)的画法。节点显示具体输入和输出，编号箭头连接消费这些数据的下游。切到「队列与计数」能查看同一步的请求清单、token 配额和剩余预算。样式、步骤数据与交互脚本都在这一个可编辑的 HTML 文件中。

## 怎么读这张图

例如在普通调度的第 8 步，`SchedulerOutput` 携带 C 的原起点 0 和配额 6。调度器先将 C 的计算游标推进到 6，随后 Worker 仍按计划中的原起点读取 C 的第 0–5 个位置。执行器返回后，`update_from_output()` 用同一份计划扣回在途量。全局图展示这条路径经过哪些组件，点「下一步」可展开当前边上的具体数据。 [EngineCore 调度与结果回流](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/engine/core.py#L644-L673)

| 场景 | 跟踪的问题 |
| --- | --- |
| 普通调度 | 先扫描 `running`，A、B 各续跑一个位置。再追踪 C 首次准入、暂跳的 S 回到 `waiting`。 |
| KV 抢占 | B 申请新块失败，`PRIORITY` 策略选中已经获得配额的 A，撤回其计划并退还两项预算。本轮跳过等待队列，下一轮 A 以 `PREEMPTED` 身份重新准入。 |

**请求放在哪里。** `running`、`waiting` 和 `kv_holding_waiting` 跨轮保留。每次进入 `schedule()` 都新建 `scheduled_running_reqs`、`scheduled_new_reqs`、`scheduled_resumed_reqs`、`preempted_reqs` 四个列表。等待阶段还可以把暂跳请求存入两个局部 deque，扫描结束时分别放回对应的等待队列。 [队列定义](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L218-L235) · [本轮列表与预算](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L580-L605) · [暂跳](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L889-L901) · [回队](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L1381-L1384)

**预算如何对账。** `num_new_tokens` 是当前请求经过限制后的本轮计算量，成功分配后写入 `num_scheduled_tokens[req_id]`。`token_budget` 记录剩余可调度 token 数，`input_budget` 还需容纳请求的草稿预留槽。抢占一个已排入本轮的请求时，两项预算分别退回对应额度。`total_num_scheduled_tokens` 对最终保留的请求配额求和。 [RUNNING 计算与扣账](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L692-L849) · [本轮汇总](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L1393-L1401)

## 源码范围

基线为 vLLM `295c062db8` 的 V1 `Scheduler`。图中采用同步文本生成、`PRIORITY` 策略和 ModelRunner V1 的输出格式。调度器先构造 `SchedulerOutput`，再按配额推进请求的 `num_computed_tokens`。设备随后才执行该计划。图中数值是按这些规则构造的教学算例。 [请求计数定义](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/request.py#L294-L305) · [输出分类](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L1417-L1451) · [抢占与游标更新](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L1571-L1635)

返回[项目导航](../index.html)。
