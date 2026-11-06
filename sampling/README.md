# 从 logits 到下一个 token

[index.html](index.html) 展示单请求、单个生成位置的完整决定过程：LM head 的 logits → temperature → top-k → top-p → 最终归一化与 CDF → 固定随机数 u → token / EOS 状态。

## 场景与连续数值

六个教学 token 为 `猫、狗、鱼、鸟、停、<eos>`，ID 为 0–5。这里的“停”只是普通词，只有 ID 5 是 EOS。三种 logits 场景分别展示明显头部、并列最大值与 EOS 高概率；真实模型不会使用这里的手工词表。

默认 logits 使用 `[8,4,2,1,0.5,0.5]` 的自然对数，便于复算。T=1 时 softmax 为 `[0.5,0.25,0.125,0.0625,0.03125,0.03125]`。k=4 后剩余质量为 15/16；在该剩余分布上设置 p=0.9，保留 IDs 0、1、2，最终概率为 `[4/7,2/7,1/7,0,0,0]`。u=0.6 因而选择 ID 1“狗”。

采样路径有 7 步；Greedy 有独立的 5 步，包括最大值、并列处理与 EOS 判断。改变策略会切换真实计算路径，不会把 T=0 代入除法。

## 过滤与边界约定

- **温度**：仅接受 T>0，计算稳定 softmax；减去最大 logit 不改变分布。
- **Top-k**：k=0 关闭。保留分值大于等于第 k 大阈值的项；阈值处并列时，候选可以超过 k 个。
- **Top-p**：在 top-k 后重新归一化的分布上，按概率降序保留达到 p 的最短前缀，包含跨过阈值的项；p=1 关闭。
- **并列排序**：本页 top-p 并列按 token ID 升序，Greedy 并列选最小 ID。框架的排序细节可能不同，因此并列边界不承诺逐 token 完全一致。
- **抽样区间**：最终概率按 token ID 顺序累计，选择首个 `u<CDFᵢ` 的正概率项，即左闭右开区间。最后有效区间上界校正为 1，消除浮点累计尾差。

教学固定 u 使选择可复现；没有模拟 GPU 随机数生成器，也不承诺与框架的随机种子逐位一致。Greedy 结果为确定性决策，不把 one-hot 选择称为未经处理的 softmax 分布。本页只检查 EOS，省略长度限制、stop strings、重复惩罚、约束解码和 beam search。

## 源文件和验证

`lesson.js` 中 `calculate(params)` 产生唯一 trace，`build(params)` 把它转换成节点、边、步骤、表格和概率图。二者均不访问 DOM 或网络。`index.html` 为共享工作台导出，请勿只修改其内联数据。

```powershell
node sampling/verify.mjs
python scripts/build_lessons.py --topics sampling
python scripts/build_lessons.py --check --topics sampling
```

`verify.mjs` 覆盖 576 组温度/过滤/u 组合，并单独验证已知分数、CDF 精确边界、top-k 并列、top-p 最短前缀、概率总和、Greedy 参数无关性、EOS、确定性和流程引用。

浏览器验证覆盖 320、736、1440 px 的采样与 Greedy 全步骤、明暗主题、离线加载、控件上下界和刷新后恢复。Top-k 使用离散选择；u 的输入步长为 0.000001，上限 0.999999，可实际输入接近 1 的边界。

## 依据

- [Transformers v4.52.2 生成配置](https://huggingface.co/docs/transformers/v4.52.2/main_classes/text_generation)：Greedy 和采样参数。
- [同版本 generation/utils.py](https://github.com/huggingface/transformers/blob/v4.52.2/src/transformers/generation/utils.py#L1190-L1199)：该版本采样处理中 temperature、top-k、top-p 的顺序。
- [同版本 logits_process.py](https://github.com/huggingface/transformers/blob/v4.52.2/src/transformers/generation/logits_process.py)：TopKLogitsWarper 的阈值语义和 TopPLogitsWarper 的累计过滤。页面是基础数学展开，不声明为完整的 Transformers 或 vLLM 调用链。
