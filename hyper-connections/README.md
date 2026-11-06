# Decoder 残差连接：HC 与 mHC

用浏览器打开 [index.html](index.html)，对照普通残差连接、Hyper-Connections（HC）与 Manifold-Constrained Hyper-Connections（mHC）在三层 Pre-Norm Decoder 中的数据流。

## 图中约定

- 每层包含 Attention 和 FFN 两个子层，各自执行一次残差更新，因此三层共展示六次更新。RMSNorm 位于 Attention / FFN 的计算之前。
- 普通残差连接保留单条残差流。HC / mHC 使用两条流作教学示意：从同一个输入复制得到初始状态，随后经各子层的读出、残差混合和写回逐步更新。这两条流不是两个独立输入。
- HC / mHC 每个子层先用 `H_pre` 读出一个输入，再经过 RMSNorm 和一次 Attention / FFN；`H_post` 将计算结果写回多条流，与 `H_res` 混合后的残差逐元素相加。Attention 和 FFN 各有自己的连接映射，增加流数不表示主干重复执行多次。
- mHC 对残差混合矩阵 `H_res` 加双随机约束：元素非负，每行、每列之和为 1；实际 Sinkhorn 迭代是近似实现。该约束不代表矩阵就是恒等矩阵，也不代表包含主干计算与动态映射的整个网络严格保持范数。`H_pre`、`H_post` 不受同样的行列和约束。
- 图中的流数、混合系数和数值均为教学例子，不是模型实测结果，也不代表论文模型的完整配置。

## 一个子层的数值展开

新增六步展开：读取当前两路 H 与参数 → 从 H 生成 pre/post/res 系数 → 聚合并 RMSNorm → 执行一次 F → 分别混合 residual 与写回 → 相加交给下一子层。切换两组输入，可观察系数随当前 H 改变；「上一步 / 下一步」沿同一份计算结果高亮。

参数、门控投影、20 轮 Sinkhorn、矩阵方向和所有中间量均在页面显示。mHC 的行列和可直接复算；HC 分支使用无双随机约束的教学映射。F 用已声明的 2×2 线性矩阵代替实际 Attention / FFN，ε=0、γ=1，计算使用未舍入值。这些是明确的教学设定，不是 checkpoint 的实际参数。

数值例从中间子层开始，因此两路输入可不同；主图仍从同一 embedding 复制初始化。示例按常规 / V4 的同子层 Hpre 消费顺序讲解，V4.1 的 delayed-pre 应查看页面链接的专属架构图。系数生成与 residual 方向引用固定 vLLM commit 的实现，没有运行模型或 NPU。

## 文件与维护

- [source.html](source.html)：可编辑的图源片段，包含演示所需的样式、结构与脚本。
- [index.html](index.html)：可直接用浏览器打开的独立页面；不依赖外部脚本，支持离线使用。修改图源后需同步导出更新，并保留外层返回导航、论文链接与居中布局；导出模板中未使用的图标、提示框 CDN 脚本无需保留。
- 修改 `source.html` 后运行 `node hyper-connections/sync-source.mjs`，更新导出容器内的源片段；运行 `node hyper-connections/sync-source.mjs --check` 验证二者一致。脚本只替换带标记的片段，保留外层导航与主题模板。

## 参考资料

- [Hyper-Connections](https://arxiv.org/abs/2409.19606)
- [mHC: Manifold-Constrained Hyper-Connections](https://arxiv.org/abs/2512.24880)

[返回项目目录](../README.md)
