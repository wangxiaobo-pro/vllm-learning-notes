# 均匀整数权重量化

[index.html](index.html) 用同一个 `W[2,4]`，连续展开分组、校准范围、scale/zero-point、舍入、裁剪、反量化，以及传入下游线性层后产生的误差。全部矩阵和图表来自 `lesson.js` 的实际计算。

## 控件与场景

- 三个矩阵分别展示通道尺度悬殊、非负偏移分布和恰好半整数的舍入。
- 位宽为 4 或 8；对称模式采用窄有符号范围，affine 模式采用无符号范围。
- Per tensor 让整个矩阵共享参数；per channel 沿输出通道逐行；group 在每行的输入维内每 2 或 4 列分组，绝不跨行。
- Min/max 模式为每组单独统计，范围始终包含零；范围系数小于 1 可以观察裁剪。手动模式可输入正 scale 与整数 zero-point，对称模式强制 z=0。

手动模式对所有组输入同一套参数，因此只改变分组不会改变重建值；自动校准才会产生不同组参数。全零校准范围约定 scale=1，避免除零。

## 精确数值约定

```text
对称：qmax=2^(bits−1)−1，qmin=−qmax，z=0
      s=max(|min|,|max|)/qmax
Affine：qmin=0，qmax=2^bits−1
        s=(max−min)/(qmax−qmin)
        z=clip(round_even(qmin−min/s))

q = clip(round_even(x/s) + z, qmin, qmax)
x̂ = s·(q−z)
```

本页采用 round-to-nearest, ties-to-even；例如 ±0.5→0，±1.5→±2。量化舍入发生在加整数零点之前。`Math.round` 的负半整数语义不同，因此实现显式处理偶数舍入。对称模式不使用最负二进制码，这是一种明确的教学选择，不能推定所有后端都如此实现。

Zero-point 舍入后，可表示端点不一定恰好等于校准 min/max。未裁剪元素的绝对舍入误差不超过 s/2，裁剪会破坏这个界。下游使用固定 `v=[1,-1,0.5,2]`，实际计算 `Wv` 和 `Ŵv`；这只是浮点参考计算，不模拟整数 GEMM、权重打包或吞吐。

FP8 使用指数与尾数，例如 E4M3、E5M2。它可以带缩放因子，但不是本页“等间距整数码 + zero-point”模型；页面没有把 FP8 放进整数位宽切换器。GPTQ、AWQ、激活统计和低比特内核均在本页范围之外。

## 源文件和验证

`calculate(params)` 是纯计算测试接口，`build(params)` 生成公共工作台结构；请修改 `lesson.js`，再生成内联导出：

```powershell
node quantization/verify.mjs
python scripts/build_lessons.py --topics quantization
python scripts/build_lessons.py --check --topics quantization
```

`verify.mjs` 覆盖 216 组场景、scheme、粒度、位宽、参数来源和范围组合；验证独立已知整数码、正负 ties-even、zero-point、分组尺度、裁剪、s/2 误差界、MSE 与下游输出。默认示例中逐通道与分组的误差改进仅是该矩阵的计算结果，不表述为所有数据的必然关系。`index.html` 由共享生成器维护，不独立编辑。

浏览器验证覆盖 320、736、1440 px 的典型分组/校准组合与全部步骤、明暗主题、离线加载、手动参数上下界和刷新后恢复，并目视核对负值条形图、误差表与输入来源连线。

## 依据

- [Jacob 等：Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference](https://arxiv.org/abs/1712.05877)：仿射量化方案。
- [PyTorch per-channel API](https://docs.pytorch.org/docs/2.15/generated/torch.quantize_per_channel.html)：沿指定 axis 的 scales 与 zero_points。
- [PyTorch per-tensor API](https://docs.pytorch.org/docs/2.15/generated/torch.quantize_per_tensor.html)：张量级 scale 与 zero_point。
- [FP8 Formats for Deep Learning](https://arxiv.org/abs/2209.05433)：E4M3、E5M2 浮点格式边界。
