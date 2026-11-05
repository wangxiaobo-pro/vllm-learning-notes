# 模型架构图谱：五模型 Forward

入口：[index.html](index.html)。从模型整体结构进入可点击组件，沿同一组 token、hidden、权重与历史状态查看输入来源、内部计算、输出以及下一消费者。

## 打开与阅读

下载或克隆整个仓库，保持目录结构，直接用浏览器打开本目录的 `index.html`，或从仓库首页的「模型基础」进入。页面为纯静态 HTML、CSS 与 JavaScript，无外部依赖、CDN、网络数据请求或构建步骤；源码链接仅在读者主动打开时访问外站。

1. 切换顶部模型 Sheet，查看该模型的基线和配置。
2. 点击带进入标记的节点，展开对应的层堆栈、Block、Attention、MoE、视觉组件或输出头；面包屑可返回上级。
3. 先读「输入 · 从哪里来」和「输出 · 交给谁」，再看有名称的连线。悬停或用键盘聚焦节点可高亮相邻输入输出；算子详情说明它接收、计算和交出的数据。
4. 使用「全局关系」「上一步 / 下一步」或播放，跟踪当前步骤；完整步骤列表与逐条连线可核对整体数据流。

图中的权重来自模型加载，历史 KV 或递推状态来自此前执行，positions、块表与槽位来自推理框架。这些来源单独标明，不把缓存、对象成员或初始化参数误画成当前 `forward` 的函数调用。

## 五个模型 Sheet

| 模型 | 本页重点 | 官方配置 | 页面数据 |
| --- | --- | --- | --- |
| DeepSeek V4.1 Flash | CED、CSA2 跨层复用、mHC、Engram、MoE 与 DSpark | [DeepSeek-V4.1-Flash config](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json) | [deepseek.js](data/deepseek.js) |
| GLM-5.3 | MLA / DSA、Top-K 索引复用、Dense / MoE 分界与 MTP | [GLM-5.3 config](https://huggingface.co/zai-org/GLM-5.3/blob/main/config.json) | [glm53.js](data/glm53.js) |
| Kimi K3 | KDA / gated MLA 混合主干、AttnRes、LatentMoE 与视觉路径 | [Kimi-K3 config](https://huggingface.co/moonshotai/Kimi-K3/blob/main/config.json) | [kimi-k3.js](data/kimi-k3.js) |
| DeepSeek V4 Pro | V4 主干、压缩注意力、mHC、MoE 与预测分支 | [DeepSeek-V4-Pro config](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/config.json) | [deepseek-pro.js](data/deepseek-pro.js) |
| MiniMax M3.1 Flash | 全层 MSA、块索引器、Dense / MoE 分界、视觉融合与独立 DSpark | [MiniMax-M3.1-Flash config](https://huggingface.co/MiniMaxAI/MiniMax-M3.1-Flash/blob/main/config.json) | [minimax.js](data/minimax.js) |

GLM Sheet 对应 **GLM-5.3**，不使用 GLM-5.3-Flash 的配置。MiniMax Sheet 对应截至本次核验的 **M3.1 Flash**；M3 家族实现中的配置分支按 M3.1 官方权重配置解释。各模型互不套用层数、共享 KV 规则、残差机制或草稿头。

表中配置链接便于查阅官方文件；本次核验的具体版本、日期、固定 revision 链接、源码文件及行号由各模型数据中的 `checked`、`revision`、`sources` 记录，并显示在页面的「源码与配置依据」中。`main` 后续变化不自动更新本地图。

## 源码基线与适用边界

本次整理日期为 **2026-11-05**，主要本地源码基线为：

| 仓库 | Commit |
| --- | --- |
| vLLM-Ascend | `94e3e25f836d79b5ee5c1aed257999ee61d10875` |
| vLLM | `295c062db8a48ea73bbd05d1174cb37d24bf86f9` |

模型组件标注实际拥有实现的文件；涉及补充实现时，在该组件单独列出来源。例如 MiniMax DSpark 采用官方独立草稿配置与本地 SGLang 实现补充说明，不据此宣称当前 Ascend checkout 已支持相同路径。

这些图是**官方配置与源码的静态分析**，没有运行模型、执行 NPU 推理或测量性能。逻辑张量形状通常省略 TP / EP 的物理切分，层号统一使用 0-based；真实设备布局、量化格式、图融合与通信行为仍取决于对应后端和运行配置。图中拆开的计算步骤不等于实际 kernel 数量。

模型架构、参考 `forward` 与服务优化分别说明。官方架构具备的能力，不代表最小参考代码或任意后端已经启用；反过来，仓库存在某个可选草稿实现，也不代表基础 checkpoint 自带该权重。

## DSpark 与接受 / 拒绝示例

草稿分支展示完整的消费边界：主模型特征与已接受 token → 草稿网络 → 候选 token / 概率 → 主模型候选位置 `forward` → target logits → verifier → 已接受前缀与后续状态。草稿候选和 confidence 不能直接当作最终输出。

页面中的贪心验证示例使用候选 `a、b、c、d、e`，可切换「在 c 首次拒绝」与「全部接受」。这些候选、目标结果和接受长度均为**教学数据**，用于说明按顺序接受前缀、首次不一致后停止接受以及全部命中时继续预测的规则，不是任何模型的实际输出。随机采样模式下的拒绝采样概率规则不能由这个 greedy 示例直接推出。

## 文件与数据约定

| 文件 | 用途 |
| --- | --- |
| `index.html` | 最终浏览器入口，加载五个模型 Sheet |
| `style.css`、`app.js`、`art.js` | 页面布局、组件导航、步骤交互与图形绘制 |
| `data/deepseek.js`、`data/deepseek-pro.js` | DeepSeek V4.1 Flash 与 V4 Pro 的组件数据 |
| `data/glm53.js`、`data/kimi-k3.js`、`data/minimax.js` | 其余模型的组件数据与来源 |
| [data/SCHEMA.md](data/SCHEMA.md) | 模型、组件、节点、连线、步骤与来源的数据契约 |
| `data/legacy-graphs.js` | 由早期图整理的内部图数据，供当前页面按需使用 |
| `source-v41.html` | 早期 V4.1 图的历史源码快照，保留作追溯；不是当前五模型页面入口 |

每份模型数据注册到 `window.ARCH_MODELS`。主要节点通过 `target` 指向真实组件；每条边记录生产节点、消费节点、数据名称与步骤编号。维护时同步检查组件输入输出、节点说明、连线、步骤和来源，避免图能播放但数据依赖不闭合。

## 检查修改

在仓库根目录运行 `node model-architecture/validate.mjs`，检查五个模型的组件跳转、面包屑、节点说明、数据依赖、步骤及来源引用。它不加载模型权重，也不验证硬件推理。

浏览器检查应包括各 Sheet 切换、组件深入与返回、叶子算子输入输出、播放 / 暂停、验证示例两种结果，以及 320px 至 1920px 下的明暗主题。直接通过本地 `file://` 打开时也应能完整使用。
