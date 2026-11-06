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
| RoPE 与位置编码 | 从二维旋转、多频率到位置插值，验算相对位置怎样进入 Q/K 点积。 | [rope-position](rope-position/README.md) | [rope-position/index.html](rope-position/index.html) |
| 从 logits 到采样 token | 逐步调整温度、top-k、top-p 和随机数，查看候选与概率如何变化。 | [sampling](sampling/README.md) | [sampling/index.html](sampling/index.html) |
| 量化：scale、zero-point 与误差 | 从范围和分组生成量化参数，观察整数编码、反量化与裁剪误差。 | [quantization](quantization/README.md) | [quantization/index.html](quantization/index.html) |
| 推理显存预算 | 计算权重、块对齐后的 KV、运行空间与理想并发上界。 | [memory-budget](memory-budget/README.md) | [memory-budget/index.html](memory-budget/index.html) |
| 推理性能指标与理论下界 | 用时间戳算 TTFT、TPOT 和吞吐，再比较单个 GEMM 的计算与带宽约束。 | [inference-performance](inference-performance/README.md) | [inference-performance/index.html](inference-performance/index.html) |
| 异步调度：计划与完成分开 | 对照同步与异步两轮执行，追踪输出占位、在途批次和真实 token 回报。 | [async-scheduling](async-scheduling/README.md) | [async-scheduling/index.html](async-scheduling/index.html) |
| ModelRunner 输入打包 | 从请求加入、退出和压紧到 packed tokens、positions、块表和写入槽。 | [modelrunner-inputs](modelrunner-inputs/README.md) | [modelrunner-inputs/index.html](modelrunner-inputs/index.html) |
| 结构化输出：语法约束与采样 | 从 schema 与合法 token 集合到 logits mask，再由真实输出推进语法状态。 | [structured-output](structured-output/README.md) | [structured-output/index.html](structured-output/index.html) |
| Multi-LoRA：按 token 行选择适配器 | 追踪 CPU 权重、GPU 槽位、行映射，以及 shrink/expand 产生的增量。 | [multi-lora](multi-lora/README.md) | [multi-lora/index.html](multi-lora/index.html) |
| 混合 KV：多组块表与共享块池 | 对照 Full/SWA 分配、窗口释放和前缀查询，查看共同可恢复边界。 | [hybrid-kv-cache](hybrid-kv-cache/README.md) | [hybrid-kv-cache/index.html](hybrid-kv-cache/index.html) |

```text
vllm-learning-notes/
├── README.md                          # 项目说明与维护指南
├── index.html                         # 按模块组织的紧凑流程目录
├── assets/                            # 统一主题、调用链界面、首页与范围元数据
├── scripts/                           # 离线页面生成、源码版本与引用校验
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
├── rope-position/                       # RoPE 与位置编码
├── sampling/                            # 从 logits 到采样 token
├── quantization/                        # 量化：scale、zero-point 与误差
├── memory-budget/                       # 推理显存预算
├── inference-performance/               # 推理性能指标与理论下界
├── async-scheduling/                    # 异步调度：计划与完成分开
├── modelrunner-inputs/                  # ModelRunner 输入打包
├── structured-output/                   # 结构化输出：语法约束与采样
├── multi-lora/                          # Multi-LoRA：按 token 行选择适配器
├── hybrid-kv-cache/                     # 混合 KV：多组块表与共享块池
└── vllm-ascend-graph/                 # Ascend 图捕获、回放与底层调用
```

各项目目录中的 `index.html` 是浏览器入口，`README.md` 说明使用方式、源码基线与适用范围。部分项目还保留可编辑的 `source.html`、数值算例 `*.json` 和独立验算脚本 `verify_*.py`，具体用途见对应项目说明。

## 打开方式

下载或克隆整个仓库，保持目录结构，使用浏览器打开根目录的 `index.html`，再选择项目。也可以直接打开各子目录中的 `index.html`。

GitHub 仓库中的 HTML 链接通常显示源码；本地演示需要用浏览器打开下载后的文件。

学习内容对应各项目说明中注明的教学模型或源码版本。

各入口顶部统一提供「本页范围与源码版本」，区分源码快照、历史版本对照和算法教学，并列出后端、配置、流程范围与教学假设。首页也显示对应类型，可以搜索「历史版本」「算法教学」等关键词。

这些说明统一维护在 [assets/topic-scopes.json](assets/topic-scopes.json)。修改后运行 `python scripts/update_scope_headers.py`，将说明内联到各独立 HTML；运行 `python scripts/update_scope_headers.py --check` 可检查是否同步。生成内容不依赖网络、JavaScript 或额外运行服务。更新图源与导出页后，再运行此生成器保留统一说明。

## 从调用链进入可视化

Scheduler 和其余 19 个涉及框架实现的主题，默认先展示整体调用链并展开三层。关键路径继续追到实际子调用、注册分派、缓存管理器或通信边界；可逐层展开、全部展开，也可沿详情中的调用路径返回父接口。选择实现或场景，再点节点查看输入、状态变化、输出消费者和返回续点；节点下的入口会定位原图中的模式与步骤。点击「返回调用链」回到刚才的节点，地址栏支持复制深链接与浏览器前进、后退。直接选择「可视化执行」仍可自由探索原图；手动切换图中模式或步骤后，会解除与源码节点的定位绑定。

覆盖请求生命周期、批处理、Chunked Prefill、DPLB/EPLB、PD 分离、启动、PagedAttention、前缀缓存、KV Offloading、权重卸载与预取、并行机制、投机解码、Ascend 图优化及模型架构，以及异步调度、ModelRunner 输入打包、结构化输出、Multi-LoRA 和混合 KV 管理。历史 V0/V1、GPU/Ascend 和 SGLang 路径按场景分开，不能把它们串成同一次运行。静态批处理对照明确标为算法教学；训练 DP 和通信原语、Transformer、注意力数学、HC/mHC 等基础演算不冒充 vLLM 执行链。

图中的张量、步数和时间是教学示例；调用链依据静态源码，跳转只切换教学页面，不启动模型或硬件执行。详细范围以各场景的说明为准。

### 统一主题与离线生成

所有入口、图源和内嵌画布使用 Scheduler 的配色：浅色背景 `#f5f5ef`、面板 `#fffefa`，深色背景 `#141c19`、面板 `#1b2520`。原图用来区分设备、张量、专家和状态的颜色保留。公共配色维护在 [assets/lesson-theme.css](assets/lesson-theme.css)。

新增的调用链由各主题的 `call-chain.json` 描述，`call-chain-adapter.js` 将节点映射到原图已有控件。公共界面、样式与 iframe 通信在 `assets/call-chain.*` 和 `assets/call-chain-bridge.js`。修改图源后，先运行该主题原有的导出脚本，再生成范围说明与公共界面：

```powershell
python scripts/build_lessons.py
python scripts/update_scope_headers.py
python scripts/build_learning_ui.py
python scripts/build_lessons.py --check
python scripts/update_scope_headers.py --check
python scripts/build_learning_ui.py --check
```

生成器把主题、调用链数据和交互代码内联到 HTML，包括 sandbox iframe；新增调用链无需启动服务或联网。标记为 `lesson-theme`、`call-adapter`、`call-ui` 的区域由生成器维护，不应直接编辑导出副本。

### 新增数值与框架工作台

新增十个主题共用离线逐步工作台：五个基础知识主题（RoPE、采样、量化、显存预算、性能指标）直接从输入进入计算；五个框架主题（异步调度、输入打包、结构化输出、Multi-LoRA、混合 KV）先显示固定 commit 的多层调用链，再跳转到具体场景和步骤。

教学数据与状态维护在各目录的 `lesson.js`，公共接口见 [assets/lesson-workbench-schema.md](assets/lesson-workbench-schema.md)。`scripts/build_lessons.py` 内联图、表、数值与交互；不依赖 CDN 或服务。源码节点跳转会重置为该节点声明的参数，避免先前探索的参数与源码场景混合。手动改参数后可继续自由探索。

每个新主题的 `verify.mjs` 独立验证关键算式或状态守恒；`node scripts/verify_lessons.mjs` 汇总检查控件边界、步骤依赖、数据确定性、相关链接和源码节点目标。基础知识中的数值并非模型运行输出；框架主题的真实调用位置与教学 token、块号、小矩阵分别标注，源码证据固定到 vLLM `295c062db8a48ea73bbd05d1174cb37d24bf86f9`。

### 调用位置必须与源码 commit 匹配

每个场景单独声明源码仓库 URL 与完整 40 位 commit；所有证据链接使用 `/blob/<commit>/<path>#L<line>`，不依赖可移动分支或本地当前行号。源码 commit 与本学习笔记仓库的提交互相独立。

```powershell
node scripts/verify_call_chains.mjs --repo vllm=E:/code/vllm --repo ascend=E:/code/vllm-ascend --repo sglang=E:/code/sglang --repo torch_npu=E:/code/torch_npu
node scheduler/verify-source.mjs --repo E:/code/vllm
```

通用校验器用 `git show <commit>:<path>` 核对文件、行范围、Git blob、片段 SHA-256，以及每个节点与证据的绑定，逐主题保存在 `call-chain.lock.json`，并检查 HTML 内联数据是否同步。源码仓库只需包含对应 Git 对象，无需切换分支；可加 `--topic <目录名>` 单独检查。Scheduler 保留原有专用校验器与 `source-lock.json`。

升级源码或修改调用位置时，先重新走读该 commit 的调用关系和行号，更新数据与版本说明，再给通用校验命令添加 `--write-lock` 生成指纹，重新生成页面并运行默认校验。指纹检查能发现引用漂移，不能替代对调用语义和教学步骤的审阅。

## 首页目录维护

首页按「模型基础」「引擎与调度」「并行与通信」「KV 缓存与传输」「性能优化」组织流程，支持模块筛选、关键词搜索和模块折叠。每个流程使用紧凑列表入口；小屏幕会将侧栏切换为模块筛选按钮。

新增流程时，在 `index.html` 对应模块的 `.flow-list` 中添加一个 `<li>`，沿用已有 `.flow` 链接结构，填写相对路径、名称、简短介绍和 `data-keywords`。导航和流程数量会自动统计，无需修改 JavaScript。

新增模块时，复制一个 `details.module`，设置唯一的 `id`、`data-label`、模块序号和标题，再填入流程。模块导航同样会自动生成。新增项目后，请同步更新上方项目表格。

首页不依赖网络或构建工具；请保留 `assets` 目录。即使禁用 JavaScript，仍可按模块浏览、折叠并打开全部流程。
