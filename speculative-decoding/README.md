# 投机解码

目标模型读过上下文「今天」，刚输出「想」。接下来能一次确定几个 token？打开[交互流程图](index.html)，沿 ②A 或 ②B 看一条草稿怎样流到验证器，再切换验证情形。

图中每个框标出输入来源和输出去向。① 把所选草稿模型需要的上下文特征 H 与「想」交给 ②，同时为 ③ 保留目标模型自己的历史 KV。② 产生的候选分送到 ③ 和 ④。③ 给出各位置的目标预测，④ 将预测与原始候选比较，⑤ 把有效输出接回原文。

| 起草方式 | 如何提出三个候选 |
| --- | --- |
| 普通 DeepSeek MTP · 串行 | 从「想」和模型状态预测「吃」，再把「吃」和更新的状态送入下一步预测「火」，最后用「火」预测「锅」。后一位依赖前一位的预测。 |
| 常规 DFlash · 并行 | 目标模型已有的隐藏状态提供上下文。草稿模型输入锚点「想」和三个占位符 `[MASK]`，一次前向在三个占位位置给出「吃」「火」「锅」，无需等待上一位选出的 token。 |

一次请求选择其中一种起草方式。图中约定两者碰巧给出相同候选，方便对照。表格中的「吃」「火」「锅」各代表一个教学 token。

目标模型在一次带因果掩码的前向中处理「想 吃 火 锅」。这四个位置（`K + 1`）依次预测「想」后、「吃」后、「火」后和「锅」后的 token。贪心验证从左至右保留连续匹配的前缀，第一次不匹配时采用目标模型的选择。

| 验证场景 | 本轮新增输出 | 原因 |
| --- | --- | --- |
| 第二位不匹配 | 吃 面 | 接受「吃」，用目标选出的「面」替换「火」。第三位的预测以「火」为前提，随草稿后缀舍弃。 |
| 全部匹配 | 吃 火 锅 。 | 接受三个候选，再追加目标模型在「锅」后选出的「。」。 |
| 首位不匹配 | 睡 | 目标在「想」后选中「睡」，本轮接受的候选数为零。 |

**源码依据**取自 vLLM-Ascend 的 Model Runner V1 实现。图中词例用于解释依赖关系和贪心验证规则。[MTP 逐位回填](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/llm_base_proposer.py#L1672-L1683) · [DFlash 查询与上下文](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/dflash_proposer.py#L105-L133) · [并行起草返回全部候选](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/spec_decode/llm_base_proposer.py#L1633-L1643) · [贪心匹配和额外 token](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/sample/rejection_sampler.py#L859-L894)

返回[项目导航](../index.html)。
