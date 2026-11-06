# RoPE：位置、旋转与相对位置点积

入口为 [index.html](index.html)。本页沿同一份小向量，连续展示投影后的 Q/K、位置与频率、角度、两个旋转分支、相对位置点积，以及交给 attention 的缩放分数。

## 可操作的场景

- **单对二维旋转**：Q=`[1,2]`、K=`[2,1]`，可直接调整每位置旋转角（度）。例如 m=1、n=0、每位置 90° 时，Q′=`[-2,1]`，Q′·K=`-3`。
- **四维多频率 RoPE**：Q=`[1,2,0.5,-1]`、K=`[2,1,1.5,0.5]`，采用 `θᵢ=base^(−2i/d)`。可调整位置、基数和共同位置平移。
- **教学位置插值 p/s**：仅把两边位置都除以 s，再使用同一套频率。s=1 与普通四维场景一致；此处不模拟训练，不把它当作所有 RoPE scaling 的统一实现。

每个场景都有 7 步。节点、三角函数表、旋转结果、向量图、点积对照均来自 `calculate(params)` 的同一次 trace。页面只格式化输出，计算本身使用 JavaScript 双精度浮点数。

## 数学约定与边界

配对为相邻两维，采用 `R(a)=[[cos(a),-sin(a)],[sin(a),cos(a)]]`。对每对固定内容向量有：

```text
Q′ = R(mθ)Q
K′ = R(nθ)K
Q′ᵀK′ = QᵀR((n−m)θ)K
```

旋转保持各对范数，同时平移两端位置不改变点积。这里只固定 Q/K 验证恒等式；真实模型改变上下文后，内容投影也可能改变。单个点积并不保证随距离单调减小。

本页 V 不旋转，末端只得到一个 key 的 `score/√d`，尚不是 softmax 概率。另一些实现用前后半维配对，必须同时考虑坐标排列，不能直接照抄本页数组索引。

## 源文件和验证

- `lesson.js`：纯计算与公共工作台数据，声明 `window.LESSON`；不访问 DOM 或网络。
- `verify.mjs`：已知 90° 旋转、原点恒等映射、相对位置独立展开、范数/共同平移不变量、插值等价性、图边引用与确定性检查。
- `index.html`：由仓库公共构建器生成的离线导出；请修改 `lesson.js` 后重新生成，不单独修改内联副本。

在仓库根目录执行：

```powershell
node rope-position/verify.mjs
python scripts/build_lessons.py --topics rope-position
python scripts/build_lessons.py --check --topics rope-position
```

数值验证覆盖 108 组位置/频率/场景组合。页面验证是浏览器行为和教学数值验证，不是模型质量或硬件推理测试。

浏览器验证覆盖 320、736、1440 px 的全部场景与步骤、明暗主题、离线加载、真实控件事件和刷新后状态恢复；几何检查之外还查看了旋转流程与结果截图。

## 依据

- [RoFormer，§3.2–3.3](https://arxiv.org/abs/2104.09864)：二维旋转、一般维度定义与相对位置性质。
- [Extending Context Window of Large Language Models via Positional Interpolation](https://arxiv.org/abs/2306.15595)：线性位置插值及论文中的微调设定。本页只演示位置映射的数值部分。
