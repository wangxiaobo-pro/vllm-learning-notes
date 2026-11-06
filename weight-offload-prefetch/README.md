# 权重 CPU Offload / Prefetch

用浏览器打开 [设备结构图](index.html)。橙线追踪 CPU 与 NPU 之间的权重拷贝，绿线把 NPU 静态槽连到读取权重的层，蓝线把上游的 hidden 连到下游。

以 L5 为例，CPU 上的 W5 预取到槽 A，L4 传来激活 `[2, 4]`。L5 将这两路输入相乘，输出 `[6, 4]` 给 L6。展开双流图，可以看到 L1 的输出如何同时交给 L2 并为 `start_prefetch` 建立顺序依赖：计算流记录旧层读完的事件，拷贝流等待后覆盖 A；计算流的 `wait_prefetch` 再等待拷贝完成事件，才允许 L5 读取。中间层计算与 H2D 可以重叠，图中行高不表示耗时或保证隐藏全部传输时间。

## 算例与源码

图中采用 Ascend Model Runner V1、单个 worker、eager 模式和普通 ND 权重。八层教学网络的偶数层保持输入值，奇数层使用 2×2 对角矩阵。分组大小为 2，每组卸载末 1 层，预取步长为 2。数值用于核对输入输出关系，图中的播放速度不表示设备耗时。

- vLLM `295c062db8` 的层包装器决定何时等待本层权重、调用原始 forward 和预取后续层。[选层与 forward](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/model_executor/offloader/prefetch.py#L195-L265)
- 拷贝流等待计算流记录的事件，覆盖静态槽，再为目标层记录拷贝完成事件。[静态槽回填](https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/model_executor/offloader/prefetch.py#L529-L569)
- vLLM-Ascend `94e3e25f8` 在基类初始化后检查权重格式并再次提交首批预取。图中将首批预取合并展示。[Ascend 初始化](https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/model_executor/offloader/prefetch.py#L173-L190)

[source.html](source.html) 保留可编辑的原图。[index.html](index.html) 是独立浏览器入口，内嵌图形、样式与交互脚本。重新导出时保留外层 736px 限宽与水平居中。
