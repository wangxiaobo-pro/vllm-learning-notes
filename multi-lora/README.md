# Multi-LoRA：同批请求按行选择适配器

三个请求共四行输入：R1 两行使用 α/101，R2 一行使用 β/202，R3 一行使用 base/0。所有行共享同一 base 权重，两套 LoRA 根据 token 行映射提供不同增量。

## 固定范围

GPU MRV1、同步调度、TP=PP=DP=1、单层 `ReplicatedLinearWithLoRA`，无量化、bias=0；`enable_lora`、`max_loras=2`、`max_cpu_loras≥2`。CPU adapter cache 与 GPU active slots 是不同资源。本页首次加载两套 adapter，不模拟 LRU 驱逐；CPU 与 GPU 管理器的实际 LRU 覆盖方法仍在源码链中标明。

rank=1、in=out=2 只表示有效教学矩阵；真实 slots 可以按 `max_lora_rank` 补齐，kernel 也有 dtype/布局要求，不能将这里的矩阵字节数或算术量视为实际显存/性能。

## 同源数值

存储方向为 `A[r,in]`、`B[out,r]`、`W[out,in]`：

- `X=[[1,2],[2,0],[0,1],[1,-1]]`，`W=[[1,0],[0,2]]`。
- α：`A=[[1,1]]`，`B=[[2],[-1]]`，`alpha/r=1`。
- β：`A=[[1,-1]]`，`B=[[1],[2]]`，`alpha/r=2`，注册时折进 `B_scaled=[[2],[4]]`，运行时 Punica scale=1。
- 最终 `Y=[[7,1],[6,-2],[-2,-2],[1,-2]]`；base 行增量为零。

槽布局 `[101,202]` 对应 token indices `[0,0,1,-1]`；交换槽为 `[202,101]` 时 indices 改成 `[1,1,0,-1]`，最终输出完全相同。该顺序是两个合法布局，不声称集合遍历或 LRU 固定分配某个槽号。`prompt_mapping` 按采样位置展开，不能与四行 `token_mapping` 混同。

九步覆盖 CPU 加载/注册缩放、GPU 激活、Punica mapping、base linear、shrink、expand、逐行合并及下游消费。图将增量和相加拆开观察，真实 `add_expand(add_inputs=True)` 可直接原位累加到 base 输出。base 行的低秩 0 表示数学贡献为零，不声称未使用的 empty buffer 字节被清零。

调用链区分输入准备和模型线性层两棵入口树；`ReplicatedLinearWithLoRA.apply → _apply_base_forward → _apply_lora_to_output → Punica.add_lora_linear` 保持真实父子调用。独立验证使用另外构造的稠密有效权重 `W+(alpha/r)BA` 作参考，检查缩放一次、base 行不变和槽置换等价。

## 文件与复现

- `lesson.js`：同一份计算结果驱动节点状态、箭头、表格和九步观察点。
- `call-chain.json`：实际调用树，含调用位置/实现、输入/状态/输出/返回续点及精确步骤跳转。
- `call-chain-adapter.js`：调用公共工作台的 `lessonController.openTarget`；参数恢复与目标验证由公共控制器处理。
- `verify.mjs`：独立数值/状态校验，运行 `node <本目录>/verify.mjs`。
- `index.html`：由根目录 `scripts/build_lessons.py` 生成；不直接编辑生成页。

固定源码为 [vLLM `295c062db8a48ea73bbd05d1174cb37d24bf86f9`](https://github.com/vllm-project/vllm/tree/295c062db8a48ea73bbd05d1174cb37d24bf86f9)。证据引用的是该 Git 对象的实际行号，不依赖工作区当前行号。这里完成了静态源码核对和 JavaScript 教学演算；未执行 GPU、外部语法库或性能测试。共享 UI 校验由整站构建后执行。
