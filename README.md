# vLLM 学习笔记与交互演示

按学习主题整理的 Transformer / vLLM 可视化项目。每个项目独立存放，包含可在浏览器中打开的 HTML 页面与使用说明。

## 项目目录

| 项目 | 内容 | 说明 | HTML 入口 |
| --- | --- | --- | --- |
| Transformer 结构与矩阵 | 模型结构、注意力、MLP、逐步矩阵计算 | [transform](transform/README.md) | [transform/index.html](transform/index.html) |
| Decoder 残差连接：HC 与 mHC | 三层 Pre-Norm Decoder、Attention / FFN 残差更新、多流混合与双随机约束 | [hyper-connections](hyper-connections/README.md) | [hyper-connections/index.html](hyper-connections/index.html) |
| 注意力机制逐步演算 | 在 16 幅图上单步追踪头共享、滑动窗口、分块计算、状态递推、压缩 KV 与 CSA2 跨层复用 | [attention-mechanisms](attention-mechanisms/README.md) | [attention-mechanisms/index.html](attention-mechanisms/index.html) |
| 模型架构图谱：七模型 Forward | Llama、DeepSeek V2 等七个模型 Sheet，可点击组件、显式输入输出与 DSpark 草稿验证 | [model-architecture](model-architecture/README.md) | [model-architecture/index.html](model-architecture/index.html) |
| vLLM-Ascend 启动流程 | 组件初始化清单、26 步启动流程、TP 分片、物理 KV 与调度器 | [vllm-ascend-startup](vllm-ascend-startup/README.md) | [vllm-ascend-startup/index.html](vllm-ascend-startup/index.html) |
| vLLM-Ascend 图优化 | 首次捕获与后续回放、逐算子底层调用、FIA 动态参数更新与条件性融合 | [vllm-ascend-graph](vllm-ascend-graph/README.md) | [vllm-ascend-graph/index.html](vllm-ascend-graph/index.html) |
| 权重 CPU Offload / Prefetch | 四份 CPU 权重轮用两个 NPU 静态槽，追踪层输入、输出和预取依赖 | [weight-offload-prefetch](weight-offload-prefetch/README.md) | [weight-offload-prefetch/index.html](weight-offload-prefetch/index.html) |
| 投机解码 | 对照草稿方法的权重、token 与隐藏状态输入，跟踪候选如何生成以及目标模型如何验证 | [speculative-decoding](speculative-decoding/README.md) | [speculative-decoding/index.html](speculative-decoding/index.html) |
| 静态批处理与连续批处理 | 同一组请求的组批、排队、Prefill / Decode、退出与 KV 释放，附逐轮对比 | [batching](batching/README.md) | [batching/index.html](batching/index.html) |
| vLLM 请求完整生命周期 | V1 单卡流式请求的 20 步流程、Prefill / Decode、KV 块与结束清理 | [request-lifecycle](request-lifecycle/README.md) | [request-lifecycle/index.html](request-lifecycle/index.html) |
| Scheduler.schedule() 调度流程 | 四个本轮请求列表、两项 token 预算、KV 抢占回滚与恢复 | [scheduler](scheduler/README.md) | [scheduler/index.html](scheduler/index.html) |
| PagedAttention 的上下游数据流 | 对照首次 Prefill 和跨页 Decode，逐步追踪块号、写槽与 Attention 的读取范围 | [paged-attention](paged-attention/README.md) | [paged-attention/index.html](paged-attention/index.html) |
| 前缀 KV 缓存 | 对同一对请求单步模拟 vLLM 哈希表与 SGLang 前缀树的查找、分配和 KV 读写 | [prefix-kv-cache](prefix-kv-cache/README.md) | [prefix-kv-cache/index.html](prefix-kv-cache/index.html) |
| KV Offloading 的设备结构 | 用同一组 K/V 数值对照 NPU 源块、CPU 槽位和回载目标块 | [kv-offloading](kv-offloading/README.md) | [kv-offloading/index.html](kv-offloading/index.html) |
| vLLM PD 分离 | V0 / V1、P / D、Scheduler / Worker、Mooncake 缓存匹配与传输 | [pd-disaggregation](pd-disaggregation/README.md) | [pd-disaggregation/index.html](pd-disaggregation/index.html) |
| Chunked prefill | 分块与整段 prefill 对照、四轮状态、CPU / GPU 调用、KV 与输出变化 | [chunked-prefill](chunked-prefill/README.md) | [chunked-prefill/index.html](chunked-prefill/index.html) |
| vLLM 并行流程 | 六种单项并行与 TP+SP、DP+EP、DP+TP+PP 三种组合，默认 TP+SP，附训练 DP 对照 | [parallelism](parallelism/README.md) | [parallelism/index.html](parallelism/index.html) |
| vLLM DPLB 与 EPLB | 请求分流、队列反馈、专家副本与放置，以及请求执行中的同步权重迁移 | [eplb-dplb](eplb-dplb/README.md) | [eplb-dplb/index.html](eplb-dplb/index.html) |
| 通信原语 | 具体数组的发送、归约、汇集、散布与交换，以及 Ring Attention 的 K/V 环传 | [communication-primitives](communication-primitives/README.md) | [communication-primitives/index.html](communication-primitives/index.html) |

```text
vllm-learning-notes/
├── README.md                          # 项目说明与维护指南
├── index.html                         # 按模块组织的紧凑流程目录
├── assets/                            # 首页样式、搜索与模块导航脚本
├── transform/                         # Transformer 结构讲解与矩阵计算
├── hyper-connections/                 # Decoder 残差连接、HC 与 mHC 对比
├── attention-mechanisms/              # 注意力机制的逐步演算与动画
├── model-architecture/                # 七模型架构、组件展开与输入输出追踪
├── vllm-ascend-startup/                # Ascend 服务启动与组件初始化
├── request-lifecycle/                 # 请求接入、推理输出与结束清理
├── scheduler/                         # V1 单轮调度、请求分类与 token 记账
├── batching/                          # 静态批处理与连续批处理对照
├── chunked-prefill/                   # 分块 prefill 与历史整段调度对照
├── speculative-decoding/              # 起草方法、输入依赖与目标模型验证
├── weight-offload-prefetch/           # CPU 权重、NPU 静态槽与层间激活
├── parallelism/                       # 单项与组合并行的计算、分片和通信
├── communication-primitives/          # 通信原语与 Ring Attention 数值演示
├── eplb-dplb/                         # 请求负载均衡与专家放置、权重迁移
├── paged-attention/                   # Scheduler 分配块号与 Worker 按页读写 KV
├── prefix-kv-cache/                   # vLLM 块哈希与 SGLang 前缀树的单步模拟
├── kv-offloading/                     # NPU 与 CPU 之间的 KV 块映射
├── pd-disaggregation/                 # Prefill / Decode 分离与 KV 传输
└── vllm-ascend-graph/                 # Ascend 图捕获、回放与底层调用
```

各项目目录中的 `index.html` 是浏览器入口，`README.md` 说明使用方式、源码基线与适用范围。部分项目还保留可编辑的 `source.html`、数值算例 `*.json` 和独立验算脚本 `verify_*.py`，具体用途见对应项目说明。

## 打开方式

下载或克隆整个仓库，保持目录结构，使用浏览器打开根目录的 `index.html`，再选择项目。也可以直接打开各子目录中的 `index.html`。

GitHub 仓库中的 HTML 链接通常显示源码；本地演示需要用浏览器打开下载后的文件。

学习内容对应各项目说明中注明的教学模型或源码版本。

各入口顶部统一提供「本页范围与源码版本」，区分源码快照、历史版本对照和算法教学，并列出后端、配置、流程范围与教学假设。首页也显示对应类型，可以搜索「历史版本」「算法教学」等关键词。

这些说明统一维护在 [assets/topic-scopes.json](assets/topic-scopes.json)。修改后运行 `python scripts/update_scope_headers.py`，将说明内联到各独立 HTML；运行 `python scripts/update_scope_headers.py --check` 可检查是否同步。生成内容不依赖网络、JavaScript 或额外运行服务。更新图源与导出页后，再运行此生成器保留统一说明。

## 首页目录维护

首页按「模型基础」「引擎与调度」「并行与通信」「KV 缓存与传输」「性能优化」组织流程，支持模块筛选、关键词搜索和模块折叠。每个流程使用紧凑列表入口；小屏幕会将侧栏切换为模块筛选按钮。

新增流程时，在 `index.html` 对应模块的 `.flow-list` 中添加一个 `<li>`，沿用已有 `.flow` 链接结构，填写相对路径、名称、简短介绍和 `data-keywords`。导航和流程数量会自动统计，无需修改 JavaScript。

新增模块时，复制一个 `details.module`，设置唯一的 `id`、`data-label`、模块序号和标题，再填入流程。模块导航同样会自动生成。新增项目后，请同步更新上方项目表格。

首页不依赖网络或构建工具；请保留 `assets` 目录。即使禁用 JavaScript，仍可按模块浏览、折叠并打开全部流程。
