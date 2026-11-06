# Scheduler.schedule() 调度流程

用浏览器打开 [交互流程图](index.html)，默认先看「整体调用链」。按 `code-flow-walkthrough` 的流程与数据流模式，从 `EngineCore.step()` 沿真实调用顺序定位接口；每个节点给出输入、状态变化、输出、返回续点，以及调用行和实现的源码链接。

默认展开三层，支持继续逐层展开、全部展开及沿详情中的调用路径返回父接口。关键 KV 分配深入到 coordinator → FullAttentionManager 的继承实现 → BlockPool → 空闲块链表；抢占释放深入到各组账本与引用计数归还。固定单一 FullAttention KV group、关闭前缀缓存、无外部 KV connector；这些内部节点跳转到原图的块计数快照，不把元数据更新描述成设备 KV 已计算完成。

点击节点下的「数据流」或「队列与计数」，可直接进入对应场景与步骤。例如选中抢占节点，会进入「KV 紧张与恢复」第 4 步；点「返回调用链」回到刚才的节点。地址栏保存节点、场景、视图与步骤，可复制深链接，也可使用浏览器后退。没有深链接时始终从调用链开始，保留上次算例设置。

「上下游数据流」沿用[并行机制图](../parallelism/index.html)的画法。节点显示具体输入和输出，编号箭头连接消费这些数据的下游。「队列与计数」查看同一步的请求清单、token 配额和剩余预算。样式、调用树、步骤数据与交互脚本都在这一个可编辑的 HTML 文件中，离线可用。

## 怎么读这张图

例如在普通调度的第 8 步，`SchedulerOutput` 携带 C 的原起点 0 和配额 6。调度器先将 C 的计算游标推进到 6，随后 Worker 仍按计划中的原起点读取 C 的第 0–5 个位置。执行器返回后，`update_from_output()` 用同一份计划扣回在途量。全局图展示这条路径经过哪些组件，点「下一步」可展开当前边上的具体数据。 [EngineCore 调度与结果回流](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/engine/core.py#L644-L673)

| 场景 | 跟踪的问题 |
| --- | --- |
| 普通调度 | 先扫描 `running`，A、B 各续跑一个位置。再追踪 C 首次准入、暂跳的 S 回到 `waiting`。 |
| KV 抢占 | B 申请新块失败，`PRIORITY` 策略选中已经获得配额的 A，撤回其计划并退还两项预算。本轮跳过等待队列，下一轮 A 以 `PREEMPTED` 身份重新准入。 |

**请求放在哪里。** `running`、`waiting` 和 `kv_holding_waiting` 跨轮保留。每次进入 `schedule()` 都新建 `scheduled_running_reqs`、`scheduled_new_reqs`、`scheduled_resumed_reqs`、`preempted_reqs` 四个列表。等待阶段还可以把暂跳请求存入两个局部 deque，扫描结束时分别放回对应的等待队列。 [队列定义](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L218-L235) · [本轮列表与预算](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L580-L605) · [暂跳](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L889-L901) · [回队](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L1381-L1384)

**预算如何对账。** `num_new_tokens` 是当前请求经过限制后的本轮计算量，成功分配后写入 `num_scheduled_tokens[req_id]`。`token_budget` 记录剩余可调度 token 数，`input_budget` 还需容纳请求的草稿预留槽。抢占一个已排入本轮的请求时，两项预算分别退回对应额度。`total_num_scheduled_tokens` 对最终保留的请求配额求和。 [RUNNING 计算与扣账](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L692-L849) · [本轮汇总](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L1393-L1401)

## 源码范围

基线为 vLLM `295c062db8` 的 V1 `Scheduler`。图中采用同步文本生成、`PRIORITY` 策略和 ModelRunner V1 的输出格式，固定 `batch_queue=None` 的 `EngineCore.step()`；其他执行入口不在本调用链范围内。调度器先构造 `SchedulerOutput`，再按配额推进请求的 `num_computed_tokens`。设备随后才执行该计划。图中数值是按这些规则构造的教学算例。 [入口选择](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/engine/core.py#L237-L239) · [请求计数定义](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/request.py#L294-L305) · [输出分类](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L1417-L1451) · [抢占与游标更新](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/core/sched/scheduler.py#L1571-L1635)

调用树中的「动作」「循环」「分支」是控制块，不能当成新增的函数。尤其是撤销本轮计划、退还预算发生在 `schedule()` 内，随后才调用 `_preempt_request()` 释放块并重置请求。执行器内部按接口契约止步，不假定具体 Worker/RPC 路径。外层顺序为 `execute_model(non_block=True)` → `get_grammar_bitmask()` → `future.result()` → **仅在结果为 None 时** `sample_tokens()` → `update_from_output()`。执行器内部没有独立教学快照，这些节点只链接派发前或回报后状态，不代表实际运行了模型。

## 调用位置与提交一致性

源码仓库为 `https://github.com/vllm-project/vllm`，完整基线 commit 为 `295c062db8a48ea73bbd05d1174cb37d24bf86f9`。这是 **vLLM 源码仓库**的提交，与学习笔记仓库自身的提交分开。页面的 `sourceSnapshot` 统一生成调用行、定义行及步骤的源码链接；节点旁显示所属版本。行号取自该 commit 的 Git 对象，不随本地切换分支或修改文件改变。

在学习笔记仓库根目录运行：

```powershell
node scheduler/verify-source.mjs --repo E:/code/vllm
```

脚本用 `git show <commit>:<path>` 检查调用链、步骤引用与静态链接，核对完整 commit、Git 文件对象及引用片段的 SHA-256；已有指纹保存在 `source-lock.json`。因此只改 commit、路径或行号会校验失败。若本地 HEAD 或源码工作树与基线不同，会明确报告，校验仍针对固定提交，不会把当前文件行号冒充基线行号。无需网络或切换源码仓库分支。

升级版本时，需要重新走读并核对调用关系、步骤含义和行号，更新 `sourceSnapshot`、静态链接、版本说明及公共范围元数据，再使用同一命令加 `--write-lock` 刷新指纹，最后运行默认校验。指纹校验负责发现版本与内容漂移，不代替调用语义的人工核对。

返回[项目导航](../index.html)。
