# 结构化输出：语法约束如何进入采样

用 JSON Schema `{"type":"string","enum":["A","B"]}` 观察 Schema/tokenizer → matcher → allowed bitmask → logits mask → GPU 选择 → CPU 接受状态的完整闭环。

## 固定范围与教学词表

GPU MRV1、UniProcExecutor、TP=PP=DP=1、同步调度，`structured_outputs.backend=xgrammar`，无推测解码、LoRA 或 reasoning 前缀；`temperature=0`。同步调度不等于同步 grammar 编译：输入处理线程仍可把编译任务提交给线程池，调用树对此使用异步边界。

教学 ID 0..5 对应 `"`、`A`、`B`、`C`、空格、EOS；窄化语言只接受 `"A"` 或 `"B"` 后接 EOS，不含空白。JavaScript 的 q0..q4 是显式教学状态名，位掩码是此小词表的契约演算，不是运行外部 xgrammar 所得的真实 mask。生产 tokenizer 的 token/字节切分不同，必须重新编译，不能照搬示例数值。

## 九个观察点

第 1–2 步提交/编译；第 3 步概括完整开引号轮。第 4–7 步细看枚举值轮：q1 的 allowed IDs 为 `[1,2]`，int32 word=6；虽然非法 C 的原始 logit=9，mask 后仍不可选择。A/B 两场景分别提高合法 A/B 的分数，最终得到 `"A"` / `"B"`。第 6 步 GPU 已有候选但 CPU matcher 仍是 q1，第 7 步收到真实 token 才进入 q2。

第 8 步闭引号和第 9 步 EOS 各是另外一个完整生成轮。EOS 不拼接到用户 JSON。图中概率只是解释 mask 后合法分布；greedy 分支实际使用 argmax，不按该概率随机抽样。4 B 仅指教学一个 int32 的有效 mask payload，不含 padding、协议及其他元数据。

调用链同时展开本地 xgrammar wrapper、请求 ID/行对齐、H2D、GPU mask、普通 Sampler 和 Scheduler 的 accept 路径；外部 xgrammar 编译器/算子标为边界，不编造其内部定义。独立验证检查 bit 位、禁止高分非法词、概率归一、CPU/GPU 状态分离、最终 JSON 和终止 token。

## 文件与复现

- `lesson.js`：同一份计算结果驱动节点状态、箭头、表格和九步观察点。
- `call-chain.json`：实际调用树，含调用位置/实现、输入/状态/输出/返回续点及精确步骤跳转。
- `call-chain-adapter.js`：调用公共工作台的 `lessonController.openTarget`；参数恢复与目标验证由公共控制器处理。
- `verify.mjs`：独立数值/状态校验，运行 `node <本目录>/verify.mjs`。
- `index.html`：由根目录 `scripts/build_lessons.py` 生成；不直接编辑生成页。

固定源码为 [vLLM `295c062db8a48ea73bbd05d1174cb37d24bf86f9`](https://github.com/vllm-project/vllm/tree/295c062db8a48ea73bbd05d1174cb37d24bf86f9)。证据引用的是该 Git 对象的实际行号，不依赖工作区当前行号。这里完成了静态源码核对和 JavaScript 教学演算；未执行 GPU、外部语法库或性能测试。共享 UI 校验由整站构建后执行。
