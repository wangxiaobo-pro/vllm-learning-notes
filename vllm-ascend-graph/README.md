# vLLM-Ascend 图优化

用浏览器打开 [index.html](index.html)，对照“第一次：逐算子调用来录图”和“第二次及以后：整图提交”，查看图捕获与 replay 中的 Python、C++、ACLNN 和设备任务调用关系。

[index.html](index.html) 是浏览器入口；[source.html](source.html) 保留可编辑的原图 HTML 片段，供后续修改和重新封装。

浏览器入口已内嵌所需样式与脚本，可离线打开。源片段由可视化工具的 `render.py` 封装为独立页面；重新导出时，保留外层 iframe 的 `max-width:736px` 与居中样式。本页未使用图标或浮动提示，导出文件已移除对应的可选 CDN 脚本。

- 左栏从 Host 逐算子调用走到图里待执行的设备任务；右栏从整图提交和动态 FIA 参数更新走到 NPU 任务执行。
- 保留原图的两栏结构，并区分已有算子融合、条件性 FX 图改写与 ACL Graph replay 各自改变的执行过程。
- 从 Qwen2 的 Norm、QKV、RoPE、Attention、输出投影和 MLP 追踪数据；逻辑张量操作与设备任务分别标明。
- 展开单层时，先用两阶段输入图区分 K/V 与 slot_mapping 写缓存、Q 与持久 KV 及 block_table/lengths 进入 FIA；算子长图以点线表示执行先后，并保留 Q、V、residual 的数据旁路。
- 以 AddRMSNorm 为例，展开 Python CustomOp、Dispatcher、C++ 适配、`GetWorkspaceSize`、`OpCommand` 和 ACLNN 执行入口；与普通 replay 的运行时入口对照。
- 最大阅读宽度为 736px，水平居中。

## 场景与边界

主线固定普通 Qwen2 dense decoder、单卡 TP=1、BF16、未量化、FULL 图模式，且 `qk_norm=False`。示例用于解释源码中的调用关系，不代表某个部署环境的实际运行结果。

- QKV 合并线性、gate/up 合并线性来自模型结构；Ascend 的 AddRMSNorm 与 SiLU-and-multiply 已使用融合算子，eager 路径也具备这些实现，不能全部归因于 FX pass。
- 未量化主线没有 Norm+Quant 子图，普通 Qwen2 没有 QKNorm 子图，TP=1 没有跨 rank reduce-scatter；这些条件性融合不能画成主线中必然发生的优化。
- Norm+Quant 的融合前后关系作为独立 W8A8 动态量化分支说明，仍须满足算子模式、dtype、epsilon、硬件和 stream 等条件。注册融合规则不等于已证明实际运行时命中。
- Capture 录制设备任务及其依赖，不表示这些捕获任务立即执行；预热、捕获和 replay 是不同阶段。
- 普通 replay 复用已捕获任务，省去相应算子每轮的 Python 分派、C++ 参数适配、workspace 查询和逐算子 ACLNN 提交；设备计算仍会执行。
- FULL 图仍有图外输入准备和参数更新。FIA（Fused Infer Attention）的参数更新属于需要单独说明的 Host 路径，不能将“普通算子省去 Host 链”推广成“replay 完全没有 Host 工作”。
- 一个 Python/FX 算子不保证对应一个设备 kernel。ACLNN 动态库内部的提交细节、实际 kernel 数量和选中的 tiling 分支，需要结合部署库与 NPU 运行结果确认。

## 源码基线

- vLLM：[`295c062db8`](https://github.com/vllm-project/vllm/tree/295c062db8)。
- vLLM-Ascend：[`94e3e25f8`](https://github.com/vllm-project/vllm-ascend/tree/94e3e25f8)。
- torch_npu：`62b9115`，用于核对 `OpCommand`、`NPUGraph::replay()` 和运行时接口。

页面源自静态源码走读，保留原图的教学场景与源码定位。页面展示或交互检查不代表模型运行、融合命中、性能测量或 Ascend NPU 推理验证。

已检查阻断网络后的首页入口、7 步捕获与回放、12 组算子的 Capture/Replay 切换、展开补充视图、首尾按钮以及刷新后的状态恢复。在 1440px、1920px 窗口及 352px、320px 内容宽度下检查了居中、换行、明暗主题与文本边界。

## 真实捕获与回放调用链

[call-chain.json](call-chain.json) 分为首次捕获和命中图后回放，共 44 个节点。捕获链从已完成预热的 `ACLGraphWrapper.__call__` 进入模型，追踪 Attention 的 custom-op 分派、`forward_impl` 的互斥选择、FIA 任务注册及图保存。固定 FIA、`sinks=None`，不把 PagedAttention 或 FIA-v2 混入同一次执行。

回放链固定非 ENPU FULL updatable graph：解析本轮参数，提交 `replay`，再提交更新并记录 event。ENPU 的 update→replay 是另一分支。函数返回输出 buffer 引用、ACL 异步提交与设备计算完成分别说明；没有从静态代码推断实际 kernel 数量或性能。

[call-chain-adapter.js](call-chain-adapter.js) 实际切换 Capture/Replay、阶段步骤和展开算子，读取计数器验证状态。完整固定基线：vLLM `295c062db8a48ea73bbd05d1174cb37d24bf86f9`、vLLM-Ascend `94e3e25f836d79b5ee5c1aed257999ee61d10875`、torch_npu `62b9115da8019f002da386f8866839121aff89af`。

返回[项目导航](../index.html)。

新增子调用展开 Python/C++ capture begin/end、Attention 层与 backend 分派、FIA task group 登记、Ascend 未量化 Linear，以及 replay 参数 provider/bind/update。捕获、参数更新、异步提交和设备完成仍分别说明；配套 op-plugin/CANN 内部保持明确边界。

新增子调用复用已有图的适用输入/输出边界，入口明确标为“原图未单列此调用”，不声称每个 Python/C++ 函数都有独立动画。旧节点 ID 保持不变，编号随真实父子关系更新；跨进程消费者与后续独立采样继续保留为独立根。
