# 投机解码

目标模型读完「今天」，刚选出「想」。接下来的三个词能怎样提前得到，又有哪些能直接输出？

- **逐步看七种算法**。选一种起草方法，从输入走到候选验证。页面显示每一步交给谁、已经得到几个候选，以及本轮新增的正式 token。[逐步流程图](index.html)
- **并排比较串行和并行**。跟着同一个例子，看 DeepSeek MTP 怎样逐词喂回、DFlash 怎样一次填三个位置，再切换首位猜错、第二位猜错和全部猜中。[MTP 与 DFlash 并排图](comparison.html)

## 怎样读目标层与草稿输入之间的线？

从目标模型的 Block 或词表头出发，沿箭头找到草稿端的输入。多条线汇合表示草稿同时读取几份输入，一条线分叉表示同一份数据有多个消费者。Medusa 把「今天」末位的同一行隐藏态送给三个并列预测头，各头分别猜「吃」「火」「锅」。独立草稿模型和 N-gram 只需读取已有 token 的 ID，前者自己算隐藏态，后者直接查本请求的历史 token。

- **EAGLE-3** 的图例采用 32 层 Llama。这份配套草稿配置省略了采集层，按 vLLM 默认值读取第 **2、16、29** 个目标 Block 在同一位置的输出，拼接后投影给草稿。图中所有层号均从 1 数起。[EAGLE-3 草稿配置](https://huggingface.co/yuhuili/EAGLE3-LLaMA3.1-Instruct-8B/blob/ada412b672e293d682423de84a095447bf38a637/config.json) · [默认取层规则](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/model_executor/models/interfaces.py#L1691-L1712)
- **DFlash** 的 Qwen3-8B-DFlash-b16 配置显式列出零基索引 `[1, 9, 17, 25, 33]`。图中的第 **2、10、18、26、34** 个目标 Block 分别接到草稿的上下文输入，共同生成草稿 K/V。「想」和三个 `[MASK]` 走另一条查询输入。换用其他 checkpoint 时，应读取其配套配置和目标模型的取层规则。[DFlash 草稿配置](https://huggingface.co/z-lab/Qwen3-8B-DFlash-b16/blob/9b41424b7109f9c5413454f481b09a82b85333f4/config.json)

## 谁读取 token，谁读取目标模型的隐藏态？

用 `H_t` 表示目标模型**处理完位置 t** 时的隐藏态。这里 t 是「今天」所在的位置，目标 LM head 从这一行预测出下一个 token「想」。此时已经知道「想」的 ID，目标模型要等下一次把「想」作为输入才会算出 `H_想`。以下固定三个候选，词块是教学 token，N-gram 另加一段可匹配的历史。

| 起草方法 | 起草时使用的 token | 起草时使用的目标隐藏态 | 部署时需要的额外权重 |
| --- | --- | --- | --- |
| EAGLE | 首步用刚选出的「想」，后续喂回前一候选 | 首步取「今天」末位的目标特征，后续用草稿模型自己的特征 | 与目标模型配套的 EAGLE 草稿 |
| EAGLE-3 | 同样从「想」起步，按位置递推 | 图示配置采集「今天」同一位置的多层目标特征并融合，后续使用草稿返回的特征 | 匹配目标模型和特征层配置的 EAGLE-3 草稿 |
| 普通 DeepSeek MTP | 从「想」起步，逐步喂回「吃」「火」 | 目标特征与「想」配对猜「吃」，后续用 MTP 上一步的状态 | 配套 MTP 层，通常来自目标 checkpoint |
| 独立草稿模型 | 首轮自己读「今天、想」，后续喂回自己的候选 | 无。草稿模型用自己的 embedding、模型层和 KV | 另加载兼容的小型自回归模型 |
| Medusa | 预测头直接读隐藏态。Runner 用有效输出 token 的**个数**选行 | 三个头读取同一行 `H_t`，各猜「想」后不同距离的词 | 与目标模型配套的 Medusa 头权重 |
| DFlash | 一个查询块含「想」和三个 `[MASK]`，同时预测三个占位位置 | 融合目标模型指定层的上下文特征，供草稿查询块使用 | 与目标模型匹配的 DFlash 草稿 |
| CPU N-gram | 在本请求完整历史「昨天想吃火锅，今天想」中查找末词「想」，复制旧匹配后的「吃、火、锅」 | 无。只比较、复制 token ID | 无 |

`--enforce-eager` 控制模型的执行模式，启用时使用 eager 执行并关闭编译及计算图回放。`EAGLE` 是 *Extrapolation Algorithm for Greater Language-model Efficiency* 的缩写，通过 `--speculative-config` 中的 `method` 选择。页面中的路径和 `K=3` 用于说明配置形状，未做实际部署或硬件性能测试。[eager 执行开关](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/config/model.py#L272-L279) · [Ascend 提议器选择](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/__init__.py#L40-L67)

## 第二个候选猜错时，下一轮从哪一行开始？

目标模型复用「今天」对应的历史 KV，在一次因果前向中处理 `[想, 吃, 火, 锅]`。这四行依次预测各输入位置之后的词。假设前两行选出「吃、面」，就接受「吃」、用「面」纠正「火」。后面两行都看到过错误的「火」，本轮新增输出到「面」为止。如果三位全中，最后一行还能给出额外的「。」。[目标前向选择采样行](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/worker/model_runner_v1.py#L1856-L1886) · [贪心纠正与额外 token](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/sample/rejection_sampler.py#L859-L894)

对 Medusa，四行的 0 起始索引是 `0=H_想、1=H_吃、2=H_火、3=H_锅`。单请求在批内的起始偏移为 0，本轮有效输出 `[吃, 面]` 的长度为 2，因此下一次起草选 `0 + 2 − 1 = 1`。三个头同读 `H_吃`，即目标模型刚才用来选出「面」的那行。下一轮目标验证时，才把「面」作为正式输入继续计算。[Ascend 的 Medusa 选行公式](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/medusa_proposer.py#L46-L72)

## 论文里的树和图上的候选链

Medusa 原论文让不同位置的多个预测组合成若干候选续写，再用树注意力一并验证。这里按本地实现绘制，每个头只取一个最高分词，三个头的结果拼成一条 `[吃, 火, 锅]`，交给目标模型验证。三个头之间没有 token 依赖。[Medusa 原论文](https://arxiv.org/abs/2401.10774) · [本版本各头取 top-1 并拼成序列](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/spec_decode/medusa.py#L38-L56)

EAGLE 用前移一位的 token 配合目标特征预测后续特征，原论文在多条分支上起草和验证。EAGLE-3 融合多层特征，训练时直接预测 token，并沿用 EAGLE-2 根据上下文构造草稿树的做法。本图跟踪 Ascend Model Runner V1 的普通链式起草路径，后续候选依赖前一步选出的词。[EAGLE 原论文](https://arxiv.org/html/2401.15077v3) · [EAGLE-3 原论文](https://arxiv.org/html/2503.01840v2) · [首步特征对齐](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/llm_base_proposer.py#L1793-L1838) · [EAGLE-3 特征融合](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/model_executor/models/llama_eagle3.py#L397-L418) · [下一位使用前一候选](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/llm_base_proposer.py#L1672-L1683)

## 真实调用链与双页定位

[call-chain.json](call-chain.json) 包含 EAGLE、EAGLE-3、普通 DeepSeek MTP、DFlash、独立草稿、Medusa、CPU N-gram 七条路径，共 83 个节点。主线固定 Ascend Model Runner V1、贪心验证和三个候选；初始化工厂、草稿提议、本轮返回及下一轮 target 验证分别标明，不把 target forward 画成 proposer 的同步子调用。

源码基线为 vLLM `295c062db8a48ea73bbd05d1174cb37d24bf86f9` 与 vLLM-Ascend `94e3e25f836d79b5ee5c1aed257999ee61d10875`。普通 MTP 不混入 Gemma / Step3.5 等专用分支，DFlash 不混入 DSpark / DFlash2。独立草稿模型保留动态模型接口边界，不能从通用 proposer 推断具体 checkpoint 的网络结构。

[call-chain-adapter.js](call-chain-adapter.js) 兼容两个页面：主页面实际选择方法、接受场景与步骤；对照页面实际选择验证场景，展示串行/并行关系。带 `action.page` 的目标由共享导航切换页面后重放；对照图是算法比较，没有伪造独立的 Python 调用实现或不存在的逐步控件。两页使用同一份调用链数据，源码证据中的 commit 与行号随数据一起维护。

返回[项目导航](../index.html)。
