# vLLM 学习笔记与交互演示

按学习主题整理的 Transformer / vLLM 可视化项目。每个项目独立存放，包含可在浏览器中打开的 HTML 页面与使用说明。

## 项目目录

| 项目 | 内容 | 说明 | HTML 入口 |
| --- | --- | --- | --- |
| Transformer 结构与矩阵 | 模型结构、注意力、MLP、逐步矩阵计算 | [transform](transform/README.md) | [transform/index.html](transform/index.html) |
| vLLM PD 分离 | V0 / V1、P / D、Scheduler / Worker、Mooncake 缓存匹配与传输 | [pd-disaggregation](pd-disaggregation/README.md) | [pd-disaggregation/index.html](pd-disaggregation/index.html) |
| vLLM 并行流程 | TP、EP、SP、PP、CP、DP 的分工、通信与接续 | [parallelism](parallelism/README.md) | [parallelism/index.html](parallelism/index.html) |
| 通信原语 | 具体数组的发送、归约、汇集、散布与交换 | [communication-primitives](communication-primitives/README.md) | [communication-primitives/index.html](communication-primitives/index.html) |

```text
vllm-learning-notes/
├── README.md
├── index.html                         # 项目导航
├── transform/
│   ├── README.md
│   ├── index.html                     # Transformer 项目入口
│   ├── transformer-structure-explorer.html
│   └── transformer-structure-explorer-matrices.html
├── pd-disaggregation/
│   ├── README.md
│   └── index.html                     # V0 / V1 PD 分离交互动画
├── parallelism/
│   ├── README.md
│   └── index.html                     # 六种并行方式
└── communication-primitives/
    ├── README.md
    └── index.html                     # 通信原语与数组变化
```

## 打开方式

下载或克隆整个仓库，保持目录结构，使用浏览器打开根目录的 `index.html`，再选择项目。也可以直接打开各子目录中的 `index.html`。

GitHub 仓库中的 HTML 链接通常显示源码；本地演示需要用浏览器打开下载后的文件。

学习内容对应各项目说明中注明的教学模型或源码版本。
