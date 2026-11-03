# vLLM PD 分离：V0 / V1 交互动画

用统一的 P / D × Scheduler / Worker 布局，展示两代 vLLM 引擎通过 Mooncake 交接 KV Cache 的流程。

## 打开与操作

用浏览器打开本目录的 [index.html](index.html)。页面可离线使用，无需安装依赖或启动服务。

- 点击 **V0 Engine / V1 Engine** 切换版本。
- 点击 **上一步 / 下一步** 查看匹配、分配、传输与后续执行。
- **全局关系** 页末尾列出完整的 1–9 步流程；箭头上的小序号与步骤对应，节点内序号表示本地动作。同一箭头可对应多个步骤。
- 虚线表示请求、元数据和完成通知；实线表示实际传输的数据。
- V0 展示 KV 与 hidden states 的传输；V1 示例展示直接 KV 交接。

## 源码基线

这里的 **V0 / V1 指引擎架构**，不等同于 vLLM 软件版本号的主版本。

| 维度 | V0 Engine | V1 Engine |
| --- | --- | --- |
| 基线 | upstream vLLM `v0.8.5` | upstream vLLM `295c062db8` |
| 连接器 | `MooncakeConnector` 注册为 `SimpleConnector`，组合 `SimpleBuffer` 与 `MooncakePipe` | `MooncakeConnector` 分为 Scheduler 与 Worker 两个角色 |
| 匹配位置 | P Worker 的缓冲区按 tokens / ROI 匹配请求 | D Scheduler 计算本地命中与远端缺口；P Worker 按 `transfer_id` 配对 |
| 等待方式 | D Worker 在接收接口内阻塞等待 | D 请求进入 `WAITING_FOR_REMOTE_KVS`，Worker 异步推进传输 |
| 数据传输 | D READ 序列化的临时缓冲，再恢复到本地 paged KV | D 提供目标元数据，由 P WRITE 到 D 的 KV buffer |
| 首次采样 | KV 与 hidden 完整时可跳过 Prefill forward，用 hidden 计算 logits | 示例普通全注意力模型在完整命中后重算 prompt 末 token，获得 logits |

V0 的 `drop_select()` 在匹配后取走缓冲条目；未匹配时等待缓冲更新。V1 中声明“可从远端加载”不代表 KV 已经到达，必须完成传输与状态反馈。

## 示例与范围

- V0：64 个输入 token，P 端查找缓冲完整命中。
- V1：64 个输入 token，D 本地命中 16 个；每块 16 个 token，剩余 48 个 token 的 KV 从 P 传入。
- block 编号与 token 数用于教学，不是运行日志或性能测量。
- 展示的是 upstream vLLM 的两条直接 PD 路径；不包含 Mooncake Store 共享缓存池，也不代表 vLLM-Ascend 的连接器实现。
- 动画基于静态源码分析，未进行 GPU / NPU 性能验证。

## 对照源码

### V0 Engine（v0.8.5）

- [Connector 注册](https://github.com/vllm-project/vllm/blob/v0.8.5/vllm/distributed/kv_transfer/kv_connector/factory.py)
- [SimpleConnector 收发入口](https://github.com/vllm-project/vllm/blob/v0.8.5/vllm/distributed/kv_transfer/kv_connector/simple_connector.py)
- [SimpleBuffer tokens / ROI 匹配](https://github.com/vllm-project/vllm/blob/v0.8.5/vllm/distributed/kv_transfer/kv_lookup_buffer/simple_buffer.py)
- [MooncakePipe 字节传输](https://github.com/vllm-project/vllm/blob/v0.8.5/vllm/distributed/kv_transfer/kv_pipe/mooncake_pipe.py)
- [ModelRunner 执行入口](https://github.com/vllm-project/vllm/blob/v0.8.5/vllm/worker/model_runner.py)

### V1 Engine（295c062db8）

- [MooncakeConnector 调度与传输](https://github.com/vllm-project/vllm/blob/295c062db8/vllm/distributed/kv_transfer/kv_connector/v1/mooncake/mooncake_connector.py)
- [Scheduler 远端 KV 生命周期](https://github.com/vllm-project/vllm/blob/295c062db8/vllm/v1/core/sched/scheduler.py)
- [Mooncake 示例 Proxy](https://github.com/vllm-project/vllm/blob/295c062db8/examples/disaggregated/mooncake_connector/mooncake_connector_proxy.py)

[返回项目目录](../README.md)
