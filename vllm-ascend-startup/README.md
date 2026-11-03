# vLLM-Ascend 启动流程

用浏览器打开 [index.html](index.html)，从 `vllm serve` 走到 HTTP 服务就绪。页面保留全局关系、组件启动清单、26 步切换和完整编号流程中的源码位置。

这是单文件 HTML，所需样式和脚本已内嵌，可离线打开，无需启动服务或安装依赖。

- 全局关系按 API Server、EngineCore、Worker 0、Worker 1 划分进程边界。
- 每个组件框内列出初始化事项；小序号与全局步骤一致，同号表示同一步中的多个初始化项。
- “上一步 / 下一步”切换当前动作、相关箭头和各组件状态；展开“完整编号流程与源码”可直接选择步骤。
- 最大阅读宽度为 736px，水平居中；窄屏纵向排列，明暗主题跟随系统。

## 场景与边界

固定双卡 TP=2、PP=1、DP=1、ModelRunner V1、同步调度、eager。教学模型采用 Llama：32 层、hidden size 4096、32 个 Q heads、8 个 KV heads、head dim 128、BF16、block size 128。

- 每个 rank 构造并加载自己的 TP 参数分片，保留全部 32 层；本例每卡有 16 个 Q heads、4 个 KV heads。
- Worker READY 位于模型加载之后、物理 KV 初始化之前；EngineCore READY 要等物理 KV、预热和调度器初始化完成。
- EngineCore 获取各 rank 的 KV 规格与内存预算，规划容量；Worker 分配、reshape 并绑定各卡的物理 KV。
- 物理 KV 与 warmup 完成后，EngineCore 才创建 BalanceScheduler、KVCacheManager、coordinator 和 BlockPool。逻辑 block ID 不代表跨 NPU 共享物理地址。
- 两个 Worker 并行初始化；编号用于表达讲解顺序和必要依赖，不代表测量的时间线。eager 跳过 graph capture。

## 源码基线

- vLLM：[`295c062db8`](https://github.com/vllm-project/vllm/tree/295c062db8)。
- vLLM-Ascend：[`94e3e25f8`](https://github.com/vllm-project/vllm-ascend/tree/94e3e25f8)。

页面源自静态源码走读，保留原图的教学配置与源码定位。本项目的页面检查不代表模型运行或 Ascend NPU 推理验证。

已检查断网打开、26 步切换、首尾按钮、步骤跳转、刷新后状态恢复和首页入口；在 1440px、1920px 大屏及窄屏下检查居中、换行与明暗主题。

返回[项目导航](../index.html)。
