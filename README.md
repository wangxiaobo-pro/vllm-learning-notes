# vLLM 学习笔记与交互演示

按学习主题整理的 Transformer / vLLM 可视化项目。每个项目独立存放，包含可在浏览器中打开的 HTML 页面与使用说明。

## 项目目录

| 项目 | 内容 | 说明 | HTML 入口 |
| --- | --- | --- | --- |
| Transformer 结构与矩阵 | 模型结构、注意力、MLP、逐步矩阵计算 | [transform](transform/README.md) | [transform/index.html](transform/index.html) |
| vLLM-Ascend 启动流程 | 组件初始化清单、26 步启动流程、TP 分片、物理 KV 与调度器 | [vllm-ascend-startup](vllm-ascend-startup/README.md) | [vllm-ascend-startup/index.html](vllm-ascend-startup/index.html) |
| vLLM-Ascend 图优化 | 首次捕获与后续回放、逐算子底层调用、FIA 动态参数更新与条件性融合 | [vllm-ascend-graph](vllm-ascend-graph/README.md) | [vllm-ascend-graph/index.html](vllm-ascend-graph/index.html) |
| vLLM PD 分离 | V0 / V1、P / D、Scheduler / Worker、Mooncake 缓存匹配与传输 | [pd-disaggregation](pd-disaggregation/README.md) | [pd-disaggregation/index.html](pd-disaggregation/index.html) |
| vLLM 并行流程 | 六种单项并行与 TP+SP、DP+EP、DP+TP+PP 三种组合，默认 TP+SP，附训练 DP 对照 | [parallelism](parallelism/README.md) | [parallelism/index.html](parallelism/index.html) |
| 通信原语 | 具体数组的发送、归约、汇集、散布与交换，以及 Ring Attention 的 K/V 环传 | [communication-primitives](communication-primitives/README.md) | [communication-primitives/index.html](communication-primitives/index.html) |

```text
vllm-learning-notes/
├── README.md
├── index.html                         # 项目导航
├── vllm-ascend-startup/
│   ├── README.md
│   └── index.html                     # 组件启动清单与 26 步源码流程
├── vllm-ascend-graph/
│   ├── README.md
│   ├── index.html                     # 捕获与回放、Host 调用与 NPU 任务对照
│   └── source.html                    # 可编辑的可视化源片段
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
│   ├── index.html                     # 六种并行与三种组合，默认 TP+SP
│   ├── matrix-examples.json           # 完整精度的数值算例
│   ├── verify_matrices.py             # 独立算术与分片验算
│   ├── combo-examples.json            # 三种组合的数值、通信组与 payload
│   ├── verify_combinations.py         # 组合算术、所有权与传输验算
│   ├── training-dp.json               # 三 GPU 训练 DP 算例
│   └── verify_training_dp.py          # 全批次与分布式梯度等价验算
└── communication-primitives/
    ├── README.md
    ├── index.html                     # 通信原语、数组变化与 Ring Attention
    ├── ring-attention-example.json    # K/V 环传与在线 softmax 数值
    └── verify_ring_attention.py       # 逐轮状态与完整 attention 验算
```

## 打开方式

下载或克隆整个仓库，保持目录结构，使用浏览器打开根目录的 `index.html`，再选择项目。也可以直接打开各子目录中的 `index.html`。

GitHub 仓库中的 HTML 链接通常显示源码；本地演示需要用浏览器打开下载后的文件。

学习内容对应各项目说明中注明的教学模型或源码版本。
