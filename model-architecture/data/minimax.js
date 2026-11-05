window.ARCH_MODELS.minimax = {
  id: 'minimax',
  name: 'MiniMax M3.1 Flash',
  subtitle: '全层 MSA · 60 层因果主干 · 原生图像 / 视频输入',
  summary: '从文本与视觉 embedding 出发，沿 60 层 forward 追踪 MSA 的块选择、独立 KV / index cache、Dense / MoE 分界和词表输出；DSpark 作为可选草稿分支单独展开。',
  checked: '2026-11-05',
  revision: '官方 M3.1-Flash ce7f4df；vLLM-Ascend 94e3e25；vLLM 295c062；DSpark 补充：SGLang 17e94c4',
  stats: [
    { label: '语言主干', value: '60 层 · D=6144' },
    { label: 'MSA 选择', value: '16 块 × 128 tokens' },
    { label: 'MoE', value: '128 选 4 + 1 shared' },
    { label: '上下文配置', value: '1,048,576 tokens' }
  ],
  sources: [
    { id: 'release', label: 'MiniMax 官方 M3.1 Flash 发布（2026-10-19）', url: 'https://www.minimax.io/blog/minimax-m31f' },
    { id: 'catalog', label: 'MiniMax 官方模型目录：M3.1 Flash', url: 'https://www.minimax.io/' },
    { id: 'card', label: '官方 M3.1-Flash 模型卡与 M3 差异', url: 'https://huggingface.co/MiniMaxAI/MiniMax-M3.1-Flash' },
    { id: 'config', label: '官方 M3.1-Flash config.json（已核验）', url: 'https://huggingface.co/MiniMaxAI/MiniMax-M3.1-Flash/blob/ce7f4df87d2e05262f5775f373dac4772f134041/config.json' },
    { id: 'draftconfig', label: '官方独立 DSpark 草稿配置', url: 'https://huggingface.co/MiniMaxAI/MiniMax-M3.1-Flash/blob/ce7f4df87d2e05262f5775f373dac4772f134041/dspark/config.json' },
    { id: 'vl', label: 'Ascend 多模态 embedding 与语言 forward：369–412', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/minimax_m3_vl.py#L369', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/minimax_m3_vl.py:369' },
    { id: 'model', label: 'Ascend MiniMaxM3Model.forward：1159–1241', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/minimax_m3.py#L1159', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/minimax_m3.py:1159' },
    { id: 'block', label: 'Ascend DecoderLayer：分支构造与 forward', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/minimax_m3.py#L956', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/minimax_m3.py:956' },
    { id: 'attn', label: 'Ascend MSA：QKV / index 投影、缓存、attention：405–567', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/minimax_m3.py#L405', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/minimax_m3.py:405' },
    { id: 'cache', label: 'Ascend MSA 写入主 KV 与 index K：372–403', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/minimax_m3.py#L372', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/minimax_m3.py:372' },
    { id: 'index', label: 'Ascend Indexer：prefill / decode top-k：406–503', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/msa_m3.py#L406', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/msa_m3.py:406' },
    { id: 'indexmath', label: 'vLLM MSA 块打分和局部块强制入选：672 起', url: 'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/models/minimax_m3/common/ops/index_topk.py#L672', local: 'E:/code/vllm/vllm/models/minimax_m3/common/ops/index_topk.py:672' },
    { id: 'sparsekernel', label: 'Ascend 稀疏 attention 消费 top-k：793–862', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/msa_m3.py#L793', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/msa_m3.py:793' },
    { id: 'moe', label: 'Ascend MoE：gate / shared / FusedMoE：733–845', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/minimax_m3.py#L733', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/minimax_m3.py:733' },
    { id: 'mlp', label: 'Ascend SwiGLU-OAI 与 MLP：628–730', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/minimax_m3.py#L628', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/minimax_m3.py:628' },
    { id: 'vision', label: 'vLLM Vision：ViT → projector → patch merger', url: 'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/models/minimax_m3/common/vision_tower.py#L477', local: 'E:/code/vllm/vllm/models/minimax_m3/common/vision_tower.py:477' },
    { id: 'head', label: 'Ascend LM head 与 compute_logits', url: 'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/minimax_m3/minimax_m3.py#L1459', local: 'E:/code/vllm-ascend/vllm_ascend/models/minimax_m3/minimax_m3.py:1459' },
    { id: 'draft', label: 'SGLang MiniMax DSpark：独立草稿 backbone', url: 'https://github.com/sgl-project/sglang/blob/17e94c4677d7beb58a89b104fd61b3768994e45e/python/sglang/srt/models/dspark_minimax.py#L101', local: 'E:/code/sglang/python/sglang/srt/models/dspark_minimax.py:101' },
    { id: 'draftheads', label: 'SGLang DSpark：Markov / confidence heads', url: 'https://github.com/sgl-project/sglang/blob/17e94c4677d7beb58a89b104fd61b3768994e45e/python/sglang/srt/models/dspark.py#L187', local: 'E:/code/sglang/python/sglang/srt/models/dspark.py:187' }
  ],
  root: 'overview',
  components: {
    overview: {
      title: 'MiniMax M3.1 Flash：从输入到下一 token',
      intro: [
        '截至 2026-11-05，MiniMax 官网最新通用语言 / 多模态型号为 M3.1 Flash；官方 Hugging Face 已发布主模型、配置及独立 DSpark 草稿权重。图中使用 M3.1 配置，不沿用 M3 前三层 full attention 的布局。',
        '主干是 60 层因果 Transformer。每层都用 MSA；L0–2 使用 Dense FFN，L3–59 使用 MoE。图像 / 视频先变成 6144 维 embedding，与文本一起进入主干。'
      ],
      inputs: '文本 input_ids；可选图像 / 视频 patches 与 grid_thw；positions；历史缓存。',
      outputs: '主干 hidden_states → vocabulary logits → 采样器得到下一 token；可选 DSpark 提供待验证草稿。',
      notes: [
        '层号从 0 开始。T 表示本轮处理的 token 数；形状展示单逻辑模型，省略 TP / EP 的物理切分。',
        '结构依据官方 M3.1 配置；主干执行顺序依据本地 M3 家族 vLLM-Ascend 实现。此静态分析不证明该 checkout 已完整支持 M3.1 的量化格式或 DSpark。',
        '最新判断同时核验官网发布、官方模型目录和 HF 权重目录；2026-10-19 发布文中的“之后开放权重”已由当前 HF 可见权重更新。'
      ],
      sources: ['release', 'catalog', 'card', 'config', 'vl', 'model', 'draftconfig'],
      nodes: [
        { id: 'text', label: '文本 token IDs', detail: '词表 200064', kind: 'tokens', col: 0, row: 0, target: 'embeddings' },
        { id: 'media', label: '图像 / 视频', detail: '视觉编码与空间合并', kind: 'vision', col: 2, row: 0, target: 'vision' },
        { id: 'embed', label: '拼入视觉 embedding', detail: '统一为 [T,6144]', kind: 'streams', col: 1, row: 1, target: 'embeddings', streamCount: 1 },
        { id: 'layers', label: '60 层因果主干', detail: '全层 MSA；Dense → MoE', kind: 'stack', col: 1, row: 2, target: 'stack' },
        { id: 'head', label: '归一化与 LM head', detail: '6144 → 200064 logits', kind: 'logits', col: 1, row: 3, target: 'head' },
        { id: 'draft', label: '可选 DSpark', detail: '独立 5 层草稿模型', kind: 'draft', col: 2, row: 3, target: 'draft' },
        { id: 'next', label: '采样 / 验证后输出', detail: '下一 token 进入后续轮次', kind: 'sample', col: 1, row: 4, target: 'head' }
      ],
      edges: [
        { from: 'text', to: 'embed', label: '① 文本向量', step: 1 },
        { from: 'media', to: 'embed', label: '① 视觉向量', step: 1, optional: true },
        { from: 'embed', to: 'layers', label: '② H₀', step: 2 },
        { from: 'layers', to: 'head', label: '③ 最后层状态', step: 3 },
        { from: 'layers', to: 'draft', label: '④ 选定层特征', step: 4, optional: true },
        { from: 'head', to: 'next', label: '⑤ logits', step: 5 },
        { from: 'draft', to: 'next', label: '⑤ 待主模型验证', step: 5, optional: true }
      ],
      steps: [
        { title: '建立统一输入', text: '文本查 embedding；存在媒体时，视觉编码结果替换对应占位位置，得到同一 token 序列。', focus: ['text', 'media', 'embed'] },
        { title: '逐层更新上下文', text: '60 个 block 依次读取 hidden / residual，执行 MSA 与 FFN，同时更新各层缓存。', focus: ['embed', 'layers'] },
        { title: '投影到词表', text: '最后一次 residual 合并与 GemmaRMSNorm 后，LM head 为待采样位置生成 logits。', focus: ['layers', 'head'] },
        { title: '可选草稿分支', text: '兼容 DSpark 的服务实现可提取指定主干层特征，供独立草稿网络生成候选。', focus: ['layers', 'draft'] },
        { title: '由采样器消费', text: '普通模式采样下一 token；推测模式还须经主模型验证。模型 forward 返回不等于 token 已被接受。', focus: ['head', 'draft', 'next'] }
      ]
    },
    embeddings: {
      title: 'Embedding：文本与视觉进入同一序列', parent: 'overview',
      intro: ['语言 embedding 的宽度是 6144。多模态处理在语言 forward 之前准备视觉向量，按占位掩码合入 inputs_embeds；纯文本则直接查表。'],
      inputs: 'input_ids [T]；可选 multimodal_embeddings 与 is_multimodal 掩码。',
      outputs: 'H₀ [T,6144]，连同独立 positions 交给语言主干。',
      notes: ['教学形状按逻辑全模型展示。vLLM 按本轮调度把请求 token 展平为 T，不代表只有一个请求。', '视觉 patch 数与文本 token 数不同，必须经过视觉投影和空间合并再对齐占位位置。'],
      sources: ['config', 'vl', 'model'],
      nodes: [
        { id: 'ids', label: '读取 token IDs', detail: '[T]', kind: 'tokens', col: 0, row: 0 },
        { id: 'lookup', label: '文本 embedding 查表', detail: '200064 × 6144 权重', kind: 'gather', col: 0, row: 1, description: 'VocabParallelEmbedding 读取 token 对应行；TP 时由分片结果恢复逻辑向量。' },
        { id: 'visual', label: '视觉编码结果', detail: '[Nvisual,6144]', kind: 'vision', col: 2, row: 1, target: 'vision' },
        { id: 'merge', label: '按占位位置合入', detail: '图像 / 视频位置被替换', kind: 'scatter', col: 1, row: 2, description: 'SupportsMultiModal.embed_input_ids 使用 is_multimodal 将媒体向量合入文本 embedding，不是把两路向量逐元素相加。' },
        { id: 'out', label: '交给第 0 层', detail: 'H₀ [T,6144]', kind: 'streams', col: 1, row: 3, target: 'stack' }
      ],
      edges: [
        { from: 'ids', to: 'lookup', label: '① token IDs', step: 1 },
        { from: 'lookup', to: 'merge', label: '② 文本向量', step: 2 },
        { from: 'visual', to: 'merge', label: '② 向量 + 占位映射', step: 2, optional: true },
        { from: 'merge', to: 'out', label: '③ inputs_embeds', step: 3 }
      ],
      steps: [
        { title: '查词表', text: '文本 IDs 读取 embedding 权重行，生成 T 个 6144 维向量。', focus: ['ids', 'lookup'] },
        { title: '对齐媒体', text: '视觉路径生成同维向量，掩码确定这些向量写入序列中的哪些位置。', focus: ['lookup', 'visual', 'merge'] },
        { title: '进入主干', text: '统一向量作为 inputs_embeds；positions 另外传递，用于每层 RoPE。', focus: ['merge', 'out'] }
      ]
    },
    stack: {
      title: '60 层主干：注意力稀疏与 MoE 独立配置', parent: 'overview',
      intro: ['M3.1 的 sparse_attention_freq 全为 1，因此 L0–59 全部使用 MSA。moe_layer_freq 则前三项为 0，后 57 项为 1：两种“稀疏”不能混为一谈。', '每次 forward 顺序遍历本 PP stage 拥有的 layers；全部 stage 合起来才是 60 层。没有 CED 的 encoder / decoder 一分为二。'],
      inputs: 'H₀ [T,6144] 或上一个 PP stage 的 hidden_states / residual。',
      outputs: '最后层 hidden_states / residual；最后 stage 做最终 norm。',
      notes: ['所有层号 0-based。图中分组是连续层范围，不是并行执行分支。', 'Prefill 与 decode 经过同一层堆栈；不同之处在 token 数、缓存读写范围及后端 kernel。'],
      sources: ['config', 'model', 'block'],
      nodes: [
        { id: 'input', label: '接收本轮 hidden', detail: '[T,6144]', kind: 'streams', col: 1, row: 0, target: 'embeddings' },
        { id: 'dense', label: 'L0–2：MSA + Dense', detail: '3 层；FFN 中间维 12288', kind: 'stack', col: 1, row: 1, target: 'block' },
        { id: 'moe', label: 'L3–59：MSA + MoE', detail: '57 层；每 token 选 4 专家', kind: 'stack', col: 1, row: 2, target: 'block' },
        { id: 'cache', label: '各层独立缓存', detail: '主 K/V + index K', kind: 'cache', col: 2, row: 2, target: 'cache' },
        { id: 'final', label: '最终 residual + norm', detail: '最后 PP stage 执行', kind: 'sum', col: 1, row: 3, target: 'head' }
      ],
      edges: [
        { from: 'input', to: 'dense', label: '① H₀', step: 1 },
        { from: 'dense', to: 'moe', label: '② H₃', step: 2 },
        { from: 'cache', to: 'moe', label: '③ 历史状态供各层读取', step: 3 },
        { from: 'moe', to: 'final', label: '④ hidden / residual', step: 4 }
      ],
      steps: [
        { title: '前三层', text: 'L0–2 也先执行 MSA；其 FFN 为 Dense MLP，不走路由专家。', focus: ['input', 'dense'] },
        { title: '进入 MoE 层段', text: 'L3–59 继续执行 MSA，但 FFN 切换到 128 选 4 加一个 shared expert。', focus: ['dense', 'moe'] },
        { title: '读取各层状态', text: '每一层写入自己的当前 K/V 与 index K，再选择并读取本层历史 KV。没有 DeepSeek 式跨层共享 KV。', focus: ['moe', 'cache'] },
        { title: '完成主干', text: '最后 stage 合并延迟的 residual，归一化得到用于词表投影的 hidden。', focus: ['moe', 'final'] }
      ]
    },
    block: {
      title: '单层 Block：MSA 后接 Dense 或 MoE', parent: 'stack',
      intro: ['按数学含义，每层执行 H′ = H + MSA(norm(H))，Hnext = H′ + FFN(norm(H′))。实际 vLLM forward 保留 hidden_states 与 residual 两个张量，用融合 add + norm 延迟完成加法。', '归一化采用 GemmaRMSNorm，其学习缩放是 1 + weight。它是单条残差流，不使用 mHC 四路流。'],
      inputs: 'positions；hidden_states；上一子层延迟的 residual。',
      outputs: 'FFN 输出 hidden_states 与保留的 residual，交给下一层或最终 norm。',
      notes: ['本图展开计算语义；NPU fused add/norm 与通信可能合并操作，不能据节点数推算 kernel 数。', 'L0–2 选 Dense，L3–59 选 MoE；两条 FFN 分支每层只走其中一条。'],
      sources: ['config', 'block'],
      nodes: [
        { id: 'h', label: '输入残差状态 H', detail: '[T,6144]', kind: 'streams', col: 1, row: 0 },
        { id: 'norm1', label: '合并残差并归一化', detail: 'input_layernorm', kind: 'sum', col: 1, row: 1 },
        { id: 'attn', label: 'MSA attention', detail: '所有 L0–59 均执行', kind: 'attention', col: 1, row: 2, target: 'attention' },
        { id: 'norm2', label: '加 H 并归一化', detail: 'post_attention_layernorm', kind: 'sum', col: 1, row: 3 },
        { id: 'dense', label: 'Dense FFN', detail: '仅 L0–2', kind: 'experts', col: 0, row: 4, target: 'mlp' },
        { id: 'moe', label: 'MoE FFN', detail: '仅 L3–59', kind: 'router', col: 2, row: 4, target: 'moe' },
        { id: 'next', label: '返回 hidden + residual', detail: '加法由后续 norm 完成', kind: 'state', col: 1, row: 5 }
      ],
      edges: [
        { from: 'h', to: 'norm1', label: '① hidden / residual', step: 1 },
        { from: 'norm1', to: 'attn', label: '② 归一化 hidden', step: 2 },
        { from: 'attn', to: 'norm2', label: '③ attention 输出', step: 3 },
        { from: 'h', to: 'norm2', label: '③ 残差 H', step: 3 },
        { from: 'norm2', to: 'dense', label: '④ L0–2', step: 4 },
        { from: 'norm2', to: 'moe', label: '④ L3–59', step: 4 },
        { from: 'dense', to: 'next', label: '⑤ FFN 输出', step: 5 },
        { from: 'moe', to: 'next', label: '⑤ FFN 输出', step: 5 }
      ],
      steps: [
        { title: '恢复当前残差状态', text: '首层直接保存 embedding 为 residual；后续层把上一步 FFN 输出加到 residual，再做 norm。', focus: ['h', 'norm1'] },
        { title: '读取上下文', text: 'MSA 从归一化 hidden 投影 Q/K/V 和 index Q/K，通过块选择读取历史。', focus: ['norm1', 'attn'] },
        { title: 'Attention 残差', text: 'attention 输出与 H 相加得到 H′；H′ 保留为 residual，同时 norm(H′) 送入 FFN。', focus: ['h', 'attn', 'norm2'] },
        { title: '按层号选择 FFN', text: '前三层执行 Dense MLP，其余层执行 MoE；输入输出宽度都保持 6144。', focus: ['norm2', 'dense', 'moe'] },
        { title: '返回下一层', text: '源码返回 FFN 输出和 H′ 两个张量；后续 add + norm 完成 Hnext 的加法。', focus: ['dense', 'moe', 'next'] }
      ]
    },
    attention: {
      title: 'MSA：小索引器选块，主 attention 读 K/V', parent: 'block',
      intro: ['同一 hidden 产生两组投影：主 attention 的 Q/K/V，以及只负责选块的 index Q/K。选块之后，主 attention 仍使用完整维度的 K/V 内容。', '逻辑形状：主 Q=[T,64,128]，K/V=[T,4,128]；index Q=[T,4,128]，index K=[T,128]。64 个 Q head 分为 4 个 GQA 组，每组 16 个 Q head。'],
      inputs: '归一化 hidden [T,6144]；positions；本层历史主 KV 与 index K cache。',
      outputs: 'attention 输出经 o_proj 变为 [T,6144]；当前 K/V 与 index K 已写入缓存。',
      notes: ['index K 是单个 128 维向量，4 个 index query heads 分别对它打分；不要把 index K 画成 4 份主 K。', '官方 sparse_disable_index_value 全为 1：索引器没有独立 value 输出支路；attention_output_gate=false。', '真实 NPU 路径可融合 QK norm、RoPE 和 cache insert；图展示相同的数据依赖。'],
      sources: ['config', 'attn', 'cache', 'sparsekernel'],
      nodes: [
        { id: 'hidden', label: '接收 norm(hidden)', detail: '[T,6144]', kind: 'streams', col: 1, row: 0 },
        { id: 'main', label: '投影主 Q / K / V', detail: '64 Q heads / 4 KV heads', kind: 'attention', col: 0, row: 1 },
        { id: 'indexqk', label: '投影 index Q / K', detail: '4 query heads / 单 K', kind: 'selection', col: 2, row: 1 },
        { id: 'mainnorm', label: 'QK norm + RoPE', detail: 'head_dim 128；旋转 64 维', kind: 'attention', col: 0, row: 2 },
        { id: 'indexnorm', label: 'Index norm + RoPE', detail: '独立参数归一化', kind: 'selection', col: 2, row: 2 },
        { id: 'cache', label: '写入两类缓存', detail: 'K/V 和 index K', kind: 'cache', col: 1, row: 3, target: 'cache' },
        { id: 'select', label: 'Index Top-16 块', detail: '每块 128 tokens', kind: 'selection', col: 2, row: 4, target: 'indexer' },
        { id: 'sparse', label: '主稀疏 attention', detail: 'Q × 选中 K → softmax × V', kind: 'attention', col: 1, row: 5, description: '消费主 Q、当前层完整 KV cache 与 top-k block IDs。在选中块内部仍应用因果可见性。' },
        { id: 'proj', label: '输出投影 o_proj', detail: '64×128 → 6144', kind: 'sum', col: 1, row: 6 }
      ],
      edges: [
        { from: 'hidden', to: 'main', label: '① hidden', step: 1 },
        { from: 'hidden', to: 'indexqk', label: '① hidden', step: 1 },
        { from: 'main', to: 'mainnorm', label: '② Q,K；V 保留', step: 2 },
        { from: 'indexqk', to: 'indexnorm', label: '② index Q,K', step: 2 },
        { from: 'mainnorm', to: 'cache', label: '③ 当前 K,V', step: 3 },
        { from: 'indexnorm', to: 'cache', label: '③ 当前 index K', step: 3 },
        { from: 'cache', to: 'select', label: '④ 历史 index K', step: 4 },
        { from: 'indexnorm', to: 'select', label: '④ index Q', step: 4 },
        { from: 'select', to: 'sparse', label: '⑤ block IDs', step: 5 },
        { from: 'cache', to: 'sparse', label: '⑤ 主 K,V', step: 5 },
        { from: 'mainnorm', to: 'sparse', label: '⑤ 主 Q', step: 5 },
        { from: 'sparse', to: 'proj', label: '⑥ 多头结果', step: 6 }
      ],
      steps: [
        { title: '生成两套投影', text: '主 QKV 表达真正的 attention 内容；index QK 只学习哪些历史块值得读取。', focus: ['hidden', 'main', 'indexqk'] },
        { title: '加入位置', text: '主 Q/K 和 index Q/K 分别做 per-head norm，再对 64 维应用 RoPE；V 不旋转。', focus: ['mainnorm', 'indexnorm'] },
        { title: '当前 token 入缓存', text: 'slot_mapping 将当前 K/V 与 index K 写入本层 paged cache。缓存写入发生在本轮选择与 attention 之前。', focus: ['mainnorm', 'indexnorm', 'cache'] },
        { title: '每个索引头选块', text: 'indexer 读取历史 index K，为当前 index Q 返回最多 16 个可见块 ID。', focus: ['cache', 'indexnorm', 'select'] },
        { title: '读取选中内容', text: '对应 GQA 组的主 Q 对这些块内的真实 K/V 执行稀疏 attention。索引得分不直接作为主 attention 权重。', focus: ['mainnorm', 'cache', 'select', 'sparse'] },
        { title: '恢复 hidden 宽度', text: '多头结果经 o_proj 回到 6144 维，交给本层残差与 post-attention norm。', focus: ['sparse', 'proj'] }
      ]
    },
    indexer: {
      title: 'MSA Indexer：每个 query 选择历史块', parent: 'attention',
      intro: ['MSA 将历史 token 按每块 128 个划分。对一个 index head 和一个 query，计算 query 与块内 index keys 的点积分数，再取块内最大值作为该块得分。', '每个 index head 选最多 16 个块，强制纳入最近的 1 个可见块。这个局部块占用 top-k 名额；不能解释成“16 个远程块再额外加 1 个局部块”。'],
      inputs: 'index Q [T,4,128]；paged index K；seq_lens、block_table 与 causal 位置。',
      outputs: '每 head / query 的 topk block IDs，逻辑形状 [4,T,16]；无效位置以 -1 等后端约定标记。',
      notes: ['sparse_init_block=0，sparse_local_block=1。最近块仍必须通过块内 token 级因果 mask。', '教学例：已有 20 个块时，每组 query 至多读选中的 16 块；短上下文不足 16 块时只保留有效块。', '16×128=2048 是每组主 attention 的最大选中槽位数；块未满、padding 与因果屏蔽会减少实际可见 token。'],
      sources: ['config', 'index', 'indexmath'],
      nodes: [
        { id: 'q', label: '当前 index Q', detail: '4 个索引头', kind: 'selection', col: 0, row: 0 },
        { id: 'k', label: '历史 index K', detail: '每 token 128 维', kind: 'cache', col: 2, row: 0, target: 'cache' },
        { id: 'dot', label: '计算块内点积', detail: '每个 query / head 独立', kind: 'attention', col: 1, row: 1 },
        { id: 'max', label: '块内取最大分数', detail: '128 token → 1 个块得分', kind: 'gather', col: 1, row: 2 },
        { id: 'causal', label: '因果过滤与局部优先', detail: '保留最近 1 个可见块', kind: 'selection', col: 1, row: 3 },
        { id: 'topk', label: '选择 Top-16 blocks', detail: '输出 block IDs', kind: 'selection', col: 1, row: 4 },
        { id: 'main', label: '交给主 attention', detail: '决定读哪些 K / V', kind: 'attention', col: 1, row: 5, target: 'attention' }
      ],
      edges: [
        { from: 'q', to: 'dot', label: '① index Q', step: 1 },
        { from: 'k', to: 'dot', label: '① 可寻址 index K', step: 1 },
        { from: 'dot', to: 'max', label: '② token 分数', step: 2 },
        { from: 'max', to: 'causal', label: '③ block 分数', step: 3 },
        { from: 'causal', to: 'topk', label: '④ 可见块候选', step: 4 },
        { from: 'topk', to: 'main', label: '⑤ 选择索引', step: 5 }
      ],
      steps: [
        { title: '查询 index cache', text: '每个索引 query head 与共享 index keys 比较；这一路没有 value 聚合。', focus: ['q', 'k', 'dot'] },
        { title: '形成块分数', text: '对同一 128-token 块取最大点积分数，得到更小的 block-score 数组。', focus: ['dot', 'max'] },
        { title: '限制可见范围', text: '未来块不能入选；最近的可见块提升优先级，以保留局部连续信息。', focus: ['max', 'causal'] },
        { title: '保留 16 块', text: 'Top-k 在可见候选中选块，最近块包含在 16 个名额内。', focus: ['causal', 'topk'] },
        { title: '索引交接', text: 'block IDs 交给主 attention，它使用另一套主 Q/K/V 算最终输出。', focus: ['topk', 'main'] }
      ]
    },
    cache: {
      title: '两类状态：主 KV 与索引 K', parent: 'attention',
      intro: ['每个 MSA 层保存主 K/V 和独立 index K。前者承载上下文内容，后者供轻量索引器选块。选择稀疏只减少本次读取的内容范围，并不把主 KV 池压缩为 16 块。'],
      inputs: '当前 K/V、index K；scheduler / runner 构造的 slot_mapping、block_table 与序列长度。',
      outputs: '更新后的 per-layer cache；indexer 与主 attention 读取历史及当前可见位置。',
      notes: ['slot_mapping 是“写入位置”元数据，block_table 是“逻辑序列到物理页”元数据；它们不是张量内容。', '具体 cache dtype 由后端和运行配置决定；M3.1 权重量化配置不能直接当作 KV cache dtype。', 'Prefill 一轮可写多 token；decode 通常增量写入。两者使用同一逻辑状态，不是两套互不相干的历史。'],
      sources: ['cache', 'index', 'sparsekernel'],
      nodes: [
        { id: 'current', label: '当前投影结果', detail: 'K,V,index K', kind: 'streams', col: 0, row: 0 },
        { id: 'meta', label: 'Runner 地址元数据', detail: 'slots / block table / lengths', kind: 'state', col: 2, row: 0 },
        { id: 'write', label: '按 slot 写入', detail: '只写本轮有效 token', kind: 'scatter', col: 1, row: 1 },
        { id: 'main', label: '主 K/V cache', detail: '每 token 各 4×128', kind: 'cache', col: 0, row: 2 },
        { id: 'index', label: 'Index K cache', detail: '每 token 128', kind: 'cache', col: 2, row: 2 },
        { id: 'choose', label: 'Indexer 读历史', detail: '返回 block IDs', kind: 'selection', col: 2, row: 3, target: 'indexer' },
        { id: 'read', label: '主 attention 读选中块', detail: 'KV 状态保留给后续轮次', kind: 'attention', col: 1, row: 4, target: 'attention' }
      ],
      edges: [
        { from: 'current', to: 'write', label: '① tensor 内容', step: 1 },
        { from: 'meta', to: 'write', label: '① slot_mapping', step: 1 },
        { from: 'write', to: 'main', label: '② K,V', step: 2 },
        { from: 'write', to: 'index', label: '② index K', step: 2 },
        { from: 'index', to: 'choose', label: '③ 历史索引向量', step: 3 },
        { from: 'choose', to: 'read', label: '④ top-k block IDs', step: 4 },
        { from: 'main', to: 'read', label: '④ 历史内容', step: 4 }
      ],
      steps: [
        { title: '确定写入地址', text: 'runner 元数据给出物理 slot；当前层提供该 token 的 K/V 和 index K。', focus: ['current', 'meta', 'write'] },
        { title: '维护两类 cache', text: '当前内容写入主 KV；索引特征写入 index cache，二者用途不同。', focus: ['write', 'main', 'index'] },
        { title: '选历史块', text: 'indexer 结合 query、index cache 和因果长度产生 top-k block IDs。', focus: ['index', 'choose'] },
        { title: '读取并保留', text: '主 attention 读取所选 KV 内容；未选中的历史块仍留在缓存，后续 query 可再选中它们。', focus: ['main', 'choose', 'read'] }
      ]
    },
    moe: {
      title: 'MoE：4 个路由专家 + 1 个共享专家', parent: 'block',
      intro: ['L3–59 使用 MoE。每个 token 的 6144 维输入经 gate 得到 128 个路由分数，选 4 个专家；共享专家处理所有 token。两路输出合并后仍是 6144 维。'],
      inputs: 'post-attention norm 的 hidden [T,6144]。',
      outputs: '路由专家加权结果 + shared expert 结果，形状 [T,6144]。',
      notes: ['scoring_func=sigmoid；配置启用 routing correction bias、renormalize，routed_scaling_factor=2。', 'num_local_experts=128 是该模型的路由专家总配置，不代表每个 EP rank 实际各放 128 个。', '真实 FusedMoE 可融合路由、dispatch、专家计算和combine；图按数学依赖展开，不规定通信实现。'],
      sources: ['config', 'moe', 'mlp'],
      nodes: [
        { id: 'h', label: 'FFN 输入', detail: '[T,6144]', kind: 'streams', col: 1, row: 0 },
        { id: 'gate', label: 'Router 打分', detail: '6144 → 128；sigmoid', kind: 'router', col: 0, row: 1 },
        { id: 'shared', label: '共享专家', detail: '所有 token；中间维 3072', kind: 'shared', col: 2, row: 1, target: 'mlp' },
        { id: 'top', label: '每 token 选 4 专家', detail: '输出 IDs + weights', kind: 'selection', col: 0, row: 2 },
        { id: 'experts', label: '128 个路由专家池', detail: '每个专家中间维 3072', kind: 'experts', col: 0, row: 3, target: 'mlp', expertCount: 128, selectedExperts: 4 },
        { id: 'sum', label: '加权合并两路结果', detail: 'routed + shared', kind: 'sum', col: 1, row: 4 },
        { id: 'out', label: '返回 FFN hidden', detail: '[T,6144]', kind: 'streams', col: 1, row: 5 }
      ],
      edges: [
        { from: 'h', to: 'gate', label: '① token hidden', step: 1 },
        { from: 'h', to: 'shared', label: '① 同一 token hidden', step: 1 },
        { from: 'gate', to: 'top', label: '② router scores', step: 2 },
        { from: 'top', to: 'experts', label: '③ expert IDs / weights', step: 3 },
        { from: 'experts', to: 'sum', label: '④ 路由加权和', step: 4 },
        { from: 'shared', to: 'sum', label: '④ shared 输出', step: 4 },
        { from: 'sum', to: 'out', label: '⑤ FFN 结果', step: 5 }
      ],
      steps: [
        { title: '同一输入走两路', text: 'router 为当前 token 选专家；shared expert 无需选择，直接处理输入。', focus: ['h', 'gate', 'shared'] },
        { title: '形成路由选择', text: 'sigmoid 分数结合路由校正用于选出 4 个专家，并形成归一化权重。', focus: ['gate', 'top'] },
        { title: '执行被选专家', text: '每个被选专家执行自己的 SwiGLU-OAI FFN；其余 124 个路由专家不计算该 token。', focus: ['top', 'experts'] },
        { title: '合并专家输出', text: '4 路专家结果按权重合并并按配置缩放，再与共享专家输出相加。', focus: ['experts', 'shared', 'sum'] },
        { title: '返回本层', text: '合并后的向量交回 DecoderLayer，保留 residual 供下一次 add + norm。', focus: ['sum', 'out'] }
      ]
    },
    mlp: {
      title: 'Dense / Expert FFN：SwiGLU-OAI', parent: 'block',
      intro: ['Dense FFN、路由专家和 shared expert 都采用 gate/up/down 的前馈形状。前三层 Dense 中间宽度为 12288；MoE 专家和 shared 的中间宽度为 3072。', 'SwiGLU-OAI 在激活前裁剪：gate 只设上界 7，up 限制在 [-7,7]；再计算 gate × sigmoid(1.702×gate) × (up+1)。这是当前配置对应的激活语义。'],
      inputs: 'x [T,6144]；该 FFN 自己的 gate、up、down 权重。',
      outputs: 'y [T,6144]；MoE 场景再按路由权重合并。',
      notes: ['所有数值来自已核验配置与本地激活实现，不是模型运行观测。', '融合权重 gate_up_proj 一次生成两支，并不意味着 gate 与 up 共用相同权重。'],
      sources: ['config', 'mlp'],
      nodes: [
        { id: 'x', label: '接收 FFN 输入', detail: '[T,6144]', kind: 'streams', col: 1, row: 0 },
        { id: 'gate', label: 'Gate 线性投影', detail: '6144 → I', kind: 'experts', col: 0, row: 1 },
        { id: 'up', label: 'Up 线性投影', detail: '6144 → I', kind: 'experts', col: 2, row: 1 },
        { id: 'act', label: '裁剪与门控相乘', detail: 'SwiGLU-OAI', kind: 'sum', col: 1, row: 2 },
        { id: 'down', label: 'Down 线性投影', detail: 'I → 6144', kind: 'experts', col: 1, row: 3 },
        { id: 'out', label: '交回 Block / MoE', detail: 'I=12288 或 3072', kind: 'streams', col: 1, row: 4 }
      ],
      edges: [
        { from: 'x', to: 'gate', label: '① x', step: 1 },
        { from: 'x', to: 'up', label: '① x', step: 1 },
        { from: 'gate', to: 'act', label: '② gate', step: 2 },
        { from: 'up', to: 'act', label: '② up', step: 2 },
        { from: 'act', to: 'down', label: '③ 门控中间值', step: 3 },
        { from: 'down', to: 'out', label: '④ FFN 输出', step: 4 }
      ],
      steps: [
        { title: '生成 gate 和 up', text: '同一 hidden 乘两套权重；各自得到 I 维中间向量。', focus: ['x', 'gate', 'up'] },
        { title: '稳定激活范围', text: '按配置裁剪两支，执行带 1.702 与 up+1 的 SwiGLU-OAI 门控。', focus: ['gate', 'up', 'act'] },
        { title: '降回模型宽度', text: 'down_proj 把门控后的 I 维向量投影回 6144。', focus: ['act', 'down'] },
        { title: '交给消费者', text: 'Dense 结果交回 block；expert 结果交给 MoE 做路由加权与共享分支合并。', focus: ['down', 'out'] }
      ]
    },
    vision: {
      title: '视觉路径：ViT → Projector → Patch Merge', parent: 'overview',
      intro: ['图片与视频经预处理形成 patches 和时空网格 grid_thw。视觉塔为 32 层、hidden=1280、16 heads，使用 3D RoPE；语言主干始终接收 6144 维向量。', '当前 forward 顺序是先把每个视觉 token 投影到 6144 维，再合并相邻 2×2 空间位置，不能画成在 ViT 之前做 2×2 token merge。'],
      inputs: 'pixel_values：[N,3×2×14×14]；grid_thw；图像 / 视频占位信息。',
      outputs: '视觉 embedding [N/4,6144]，按各媒体对应长度拆分并合入文本序列。',
      notes: ['N 指预处理后视觉 patch token 数；时间 patch_size=2，空间 patch_size=14。视频分段与 grid_thw 决定可见范围。', '视觉编码器属于媒体前端，不意味着语言模型是 encoder-decoder；语言主体仍为因果 decoder stack。', '源码对发布模型取最后 encoder hidden，未额外添加无权重的 post-layernorm。'],
      sources: ['config', 'vision', 'vl'],
      nodes: [
        { id: 'pixels', label: '图像 / 视频 patches', detail: 'pixels + grid_thw', kind: 'vision', col: 1, row: 0 },
        { id: 'embed', label: '视觉 patch embedding', detail: '[N,1176] → [N,1280]', kind: 'gather', col: 1, row: 1 },
        { id: 'vit', label: '32 层视觉 Transformer', detail: '3D RoPE；16 heads', kind: 'stack', col: 1, row: 2, description: '视觉层对媒体内的 patch token 计算 attention 与 MLP。分段元数据限定视频片段序列；不读取语言 KV cache。' },
        { id: 'proj', label: '两层 MLP projector', detail: '1280 → 6144 → 6144', kind: 'vision', col: 1, row: 3, description: 'linear_1 → GELU → linear_2，将视觉特征转换为语言向量空间。' },
        { id: 'merge', label: '2×2 Patch Merge MLP', detail: '24576 → 6144 → 6144', kind: 'gather', col: 1, row: 4, description: '把4个相邻的6144维向量拼成24576维，再用两层MLP得到一个6144维视觉token；空间token数量减为1/4。' },
        { id: 'out', label: '替换媒体占位符', detail: '[N/4,6144]', kind: 'scatter', col: 1, row: 5, target: 'embeddings' }
      ],
      edges: [
        { from: 'pixels', to: 'embed', label: '① patches', step: 1 },
        { from: 'embed', to: 'vit', label: '② 视觉向量 + 网格位置', step: 2 },
        { from: 'vit', to: 'proj', label: '③ 最后层视觉 hidden', step: 3 },
        { from: 'proj', to: 'merge', label: '④ 6144 维 patch 向量', step: 4 },
        { from: 'merge', to: 'out', label: '⑤ 压缩后视觉 token', step: 5 }
      ],
      steps: [
        { title: '嵌入视觉块', text: '将预处理后的时空 patches 转为 1280 维，并准备视觉位置编码与分段信息。', focus: ['pixels', 'embed'] },
        { title: '视觉语义编码', text: '32 层视觉 Transformer 处理 patch 序列，输出同数量的视觉 hidden。', focus: ['embed', 'vit'] },
        { title: '对齐语言维度', text: '两层 projector 把每个视觉 hidden 变成 6144 维。', focus: ['vit', 'proj'] },
        { title: '合并空间邻居', text: '相邻 2×2 视觉向量先拼接再经 MLP，token 数降为四分之一。', focus: ['proj', 'merge'] },
        { title: '拼入语言序列', text: '按每张图或每段视频的网格长度拆分结果，替换输入序列对应的媒体占位位置。', focus: ['merge', 'out'] }
      ]
    },
    head: {
      title: '输出头：hidden → logits → 采样', parent: 'overview',
      intro: ['语言 model.forward 完成层堆栈后返回 hidden；compute_logits 是另一调用。最后归一化在 model 内，词表投影由 ParallelLMHead 和 LogitsProcessor 执行。'],
      inputs: '最后一层 hidden_states / residual；runner 选定的待采样位置。',
      outputs: '每个待采样位置的 200064 维 logits；采样器产生 token ID。',
      notes: ['tie_word_embeddings=false：embedding 与 LM head 不共用一套权重。', '采样器属于推理框架，不是第61个 Transformer block。推测解码中的候选还需验证后才能成为已接受输出。'],
      sources: ['config', 'model', 'head', 'vl'],
      nodes: [
        { id: 'hidden', label: '最后层返回状态', detail: 'hidden + residual', kind: 'state', col: 1, row: 0 },
        { id: 'norm', label: '合并并做最终 Norm', detail: 'GemmaRMSNorm', kind: 'sum', col: 1, row: 1 },
        { id: 'select', label: '选择待采样位置', detail: '由 runner 决定', kind: 'selection', col: 1, row: 2 },
        { id: 'lm', label: 'LM head 词表投影', detail: '6144 → 200064', kind: 'logits', col: 1, row: 3 },
        { id: 'sampler', label: '采样器消费 logits', detail: 'token ID / logprob', kind: 'sample', col: 1, row: 4 },
        { id: 'next', label: '下一轮增量输入', detail: '已接受 token + 新位置', kind: 'tokens', col: 1, row: 5, target: 'embeddings' }
      ],
      edges: [
        { from: 'hidden', to: 'norm', label: '① 最终残差状态', step: 1 },
        { from: 'norm', to: 'select', label: '② model 返回 hidden', step: 2 },
        { from: 'select', to: 'lm', label: '③ selected hidden', step: 3 },
        { from: 'lm', to: 'sampler', label: '④ logits', step: 4 },
        { from: 'sampler', to: 'next', label: '⑤ 已接受 token', step: 5 }
      ],
      steps: [
        { title: '闭合最后残差', text: '最终 norm 把最后 FFN 输出加到 residual，再归一化。', focus: ['hidden', 'norm'] },
        { title: '返回主干结果', text: 'model.forward 返回 hidden；框架决定哪些位置需要下一 token 的分布。', focus: ['norm', 'select'] },
        { title: '执行 compute_logits', text: '选定 hidden 经过独立 LM head，形成整个词表的 logits。', focus: ['select', 'lm'] },
        { title: '进行采样', text: '采样策略读取 logits，生成下一 token 或推测验证所需概率。', focus: ['lm', 'sampler'] },
        { title: '推进序列', text: '已接受 token 在后续调度轮次进入 embedding，读取此前维护的历史缓存。', focus: ['sampler', 'next'] }
      ]
    },
    draft: {
      title: 'DSpark：独立草稿模型与主模型验证', parent: 'overview',
      intro: ['M3.1 发布了独立 dspark/ 权重与配置。草稿网络是 5 层 Dense Transformer，窗口4096、block_size=7；其主干特征来自 target layer IDs [3,17,31,45,59]。', '本地 vLLM-Ascend 的 M3 主干仍暴露 EAGLE3 辅助 hidden 接口，不能据此宣称已实现这份 DSpark。此子图用官方 draft 配置与本地 SGLang DSparkMiniMaxDraftModel 补充说明，属于另一条服务实现路径。'],
      inputs: '主模型指定层的 hidden 特征；当前已接受 token；noise token 槽位；draft 上下文缓存。',
      outputs: '候选 token / base logits / confidence，交给推测解码 worker 和主模型验证。',
      notes: ['block_size=7 表示草稿块配置，不能直接解释为每轮一定接受7个新token；接受数量由验证决定。', 'target layer IDs 是草稿配置引用的层标识；具体抽取的 hidden 边界遵循相应服务框架接口，不能套用 DeepSeek 的 mHC 输入快照。', '草稿层使用 Dense FFN，中间宽12288；块内query可以互相注意，主模型验证仍保持因果约束。未运行模型或测量加速比。'],
      sources: ['card', 'draftconfig', 'draft', 'draftheads', 'model'],
      nodes: [
        { id: 'features', label: '指定主干层特征', detail: 'IDs 3,17,31,45,59', kind: 'gather', col: 0, row: 0, target: 'stack' },
        { id: 'tokens', label: '已接受 token + mask', detail: '草稿块配置大小 7', kind: 'tokens', col: 2, row: 0 },
        { id: 'context', label: '投影上下文特征', detail: '5×6144 → 6144 + norm', kind: 'cache', col: 0, row: 1, description: 'project_target_hidden 用 fc 与 hidden_norm 压缩拼接后的主模型特征，再为草稿 attention 构造上下文 K/V。' },
        { id: 'embed', label: '草稿 embedding', detail: '文本 / noise 槽位向量', kind: 'streams', col: 2, row: 1 },
        { id: 'draft', label: '5 层草稿网络', detail: '窗口4096；Dense FFN', kind: 'draft', col: 1, row: 2 },
        { id: 'markov', label: 'LM + Markov / Confidence', detail: 'Markov rank 256', kind: 'logits', col: 1, row: 3, description: 'Vanilla Markov 从前一token的256维向量投影词表偏置；confidence head 可同时读取draft hidden和Markov特征，供worker安排验证。' },
        { id: 'verify', label: '主模型验证候选', detail: '前缀 + correction / bonus', kind: 'verify', col: 1, row: 4, target: 'verification' },
        { id: 'accepted', label: '提交有效输出序列', detail: '有效 IDs / 长度 / cache', kind: 'tokens', col: 1, row: 5, target: 'verification' }
      ],
      edges: [
        { from: 'features', to: 'context', label: '① 拼接 hidden 特征', step: 1 },
        { from: 'tokens', to: 'embed', label: '② token IDs', step: 2 },
        { from: 'context', to: 'draft', label: '③ draft 上下文 KV', step: 3 },
        { from: 'embed', to: 'draft', label: '③ 草稿 query hidden', step: 3 },
        { from: 'draft', to: 'markov', label: '④ 草稿 hidden', step: 4 },
        { from: 'markov', to: 'verify', label: '⑤ 候选 / 概率 / 信心', step: 5 },
        { from: 'verify', to: 'accepted', label: '⑥ 已接受前缀', step: 6 }
      ],
      steps: [
        { title: '准备草稿上下文', text: '指定主模型层的特征拼接后经 fc 与 norm，形成用于草稿 K/V 的上下文向量。', focus: ['features', 'context'] },
        { title: '建立草稿块', text: 'worker 提供已接受 token 与 noise 槽位，embedding 生成草稿query的初始状态。', focus: ['tokens', 'embed'] },
        { title: '运行 5 层 Draft', text: '草稿块读取上下文与块内信息，经过5层 attention + Dense FFN，输出草稿hidden。', focus: ['context', 'embed', 'draft'] },
        { title: '形成候选与信心', text: 'base logits 配合 Markov 词表偏置形成半自回归草稿；confidence head 估计候选信心。', focus: ['draft', 'markov'] },
        { title: '交给主模型验证', text: 'worker 把候选送入主模型，不直接当作最终输出。具体调度由兼容的DSpark实现负责。', focus: ['markov', 'verify'] },
        { title: '提交前缀与最终补充 token', text: '首个拒绝处保留连续接受前缀并补 correction；全部接受则补 bonus。worker 按有效输出更新序列、长度与可见缓存范围，再进入下一轮；未接受候选不能混入历史。', focus: ['verify', 'accepted'] }
      ]
    }
  }
};

// Keep source tensors and persistent state visible in every drill-down.
(() => {
  const model = window.ARCH_MODELS.minimax;
  const c = model.components;
  c.overview.nodes.push({ id: 'history', label: '本层历史状态', detail: '此前轮次写入的各层 KV', kind: 'cache', col: 0, row: 2, target: 'cache' });
  c.overview.edges.push({ from: 'history', to: 'layers', label: '② 各层历史 K/V 与 index K', step: 2 });
  c.embeddings.nodes.push({ id: 'weights', label: '词嵌入权重', detail: 'checkpoint 中加载', kind: 'state', col: 2, row: 0 });
  c.embeddings.edges.push({ from: 'weights', to: 'lookup', label: '① embedding 表', step: 1 });
  c.block.edges.push({ from: 'norm2', to: 'next', label: '⑤ 保留 H′ residual', step: 5 });
  c.attention.nodes.push(
    { id: 'weights', label: '本层投影 / Norm 权重', detail: 'checkpoint 中加载', kind: 'state', col: 0, row: 0 },
    { id: 'positions', label: 'Runner positions', detail: '当前 token 的序列位置', kind: 'state', col: 2, row: 0 }
  );
  c.attention.edges.push(
    { from: 'weights', to: 'main', label: '① Wq,Wk,Wv', step: 1 },
    { from: 'weights', to: 'indexqk', label: '① WindexQ,WindexK', step: 1 },
    { from: 'positions', to: 'mainnorm', label: '② RoPE 位置', step: 2 },
    { from: 'positions', to: 'indexnorm', label: '② RoPE 位置', step: 2 }
  );
  c.cache.nodes.push({ id: 'history', label: '此前 token 的缓存', detail: '同层、同序列的持久状态', kind: 'state', col: 1, row: 0 });
  c.cache.edges.push(
    { from: 'history', to: 'main', label: '② 保留历史 K/V', step: 2 },
    { from: 'history', to: 'index', label: '② 保留历史 index K', step: 2 }
  );
  c.moe.nodes.push(
    { id: 'routerweights', label: '路由权重与校正偏置', detail: '每层独立训练参数', kind: 'state', col: 0, row: 0 },
    { id: 'expertweights', label: '专家 FFN 权重', detail: '128 routed + 1 shared', kind: 'state', col: 2, row: 0 }
  );
  c.moe.edges.push(
    { from: 'routerweights', to: 'gate', label: '① gate 参数', step: 1 },
    { from: 'expertweights', to: 'shared', label: '① shared 权重', step: 1 },
    { from: 'expertweights', to: 'experts', label: '③ 被选专家权重', step: 3 }
  );
  c.mlp.nodes.push({ id: 'weights', label: '当前 FFN 的权重', detail: 'gate / up / down', kind: 'state', col: 0, row: 0 });
  c.mlp.edges.push(
    { from: 'weights', to: 'gate', label: '① Wgate', step: 1 },
    { from: 'weights', to: 'up', label: '① Wup', step: 1 },
    { from: 'weights', to: 'down', label: '③ Wdown', step: 3 }
  );
  c.head.nodes.push({ id: 'weights', label: '独立 LM head 权重', detail: 'checkpoint 中加载', kind: 'state', col: 2, row: 2 });
  c.head.edges.push({ from: 'weights', to: 'lm', label: '③ Whead', step: 3 });
  c.draft.nodes.push(
    { id: 'target', label: '主模型候选 forward', detail: '候选位置的 target logits', kind: 'verify', col: 0, row: 4, target: 'stack' },
    { id: 'sharedweights', label: '主模型 embedding / head', detail: '草稿 attach_shared_modules', kind: 'state', col: 1, row: 0 }
  );
  c.draft.edges.push(
    { from: 'markov', to: 'target', label: '⑤ 候选 tokens + 历史上下文', step: 5 },
    { from: 'target', to: 'verify', label: '⑤ target logits / 概率', step: 5 },
    { from: 'sharedweights', to: 'embed', label: '② 共享 embedding 表', step: 2 },
    { from: 'sharedweights', to: 'markov', label: '④ 共享 LM head', step: 4 }
  );
  c.draft.steps[4].focus.push('target');
  c.draft.inputs = '主模型 IDs [3,17,31,45,59] 对应特征拼接 [Nctx,30720]；worker 的已接受 token / noise IDs；共享 embedding、LM head；draft 历史 KV。';
  c.draft.outputs = '草稿 hidden [Ndraft,6144] → base logits / Markov 偏置 / confidence → worker 提交候选 → 主模型 target logits → 连续接受前缀 + 首拒 correction，或全接受 + bonus；有效 IDs、输出长度、可见缓存范围及末 token 交给 worker / 下一轮 draft。';
  c.attention.inputs = '上游 input_layernorm 的 hidden [T,6144]；runner positions [T]；本层投影与 norm 权重；此前轮次的主 KV / index K cache。';
  c.indexer.inputs = '本层 index 投影与 norm/RoPE 生成的 Q [T,4,128]；此前及当前已写入的 index K [L,128]；runner 的 seq_lens / block_table / causal 位置。';
  c.indexer.outputs = 'topk block IDs [4,T,16] → 同一层 sparse attention；这些索引决定读取主 K/V 的哪些块，不产生 attention hidden。';
  c.cache.inputs = '本层投影的 K,V [T,4,128] 与 index K [T,128]；此前同层缓存；runner slot_mapping [T]、block_table 与 seq_lens。';
  c.cache.outputs = '主 K/V 与 index K 持久状态被增量更新 → indexer 选块 → sparse attention 读取内容；未选中历史继续供下一轮使用。';
  c.stack.inputs = '多模态融合 / 文本 embedding 的 H₀ [T,6144]；或前一 PP stage 的 hidden/residual；positions [T]；每层历史 KV 状态。';
  c.stack.outputs = '本 PP stage 的 hidden/residual [T,6144] → 下一 stage；最后 stage 的 norm hidden [T,6144] → runner 选行与 compute_logits。';
  c.block.inputs = '前层输出 hidden_states [T,6144]、保留 residual [T,6144]（首层为 None）；positions；本层权重及历史缓存。';
  c.block.outputs = 'FFN 输出 hidden_states [T,6144] 与 attention 后 H′ residual [T,6144] → 下一层 input norm；最后层则交给最终 norm。';
  c.head.inputs = 'L59 的 hidden/residual [T,6144]；runner 的待采样行索引；独立 LM head 权重 [200064,6144]；采样策略。';
  c.head.outputs = 'selected logits [Nsample,200064] → framework sampler / verifier → 已接受 token IDs → 后续调度轮次的 embedding。';
  const descriptions = {
    overview: {
      text: '请求经 tokenizer 得到文本 IDs；交给词嵌入表查出6144维向量，后续与媒体占位位置共同构成语言输入。',
      media: '预处理后的图片或视频进入视觉塔；ViT、projector和patch merge生成6144维向量，交给embedding融合。',
      embed: '接收文本embedding和视觉向量，按媒体掩码替换占位行，输出H₀ [T,6144]给L0。',
      layers: '接收H₀、positions及各层历史状态；顺序运行L0–59，输出最后hidden/residual并保留更新后的缓存。',
      head: '读取L59状态，合并残差并norm；runner选择需预测的位置后由独立LM head产生词表logits。',
      draft: '可选worker读取主模型指定层特征和已接受token，运行独立DSpark；候选送往主模型验证，不能直接发布。',
      next: '采样器或verifier消费logits与候选，得到已接受token；后续调度将它送回embedding，继续读取既有缓存。',
      history: '此前forward已写入的各层主K/V与index K按请求保留；当前层读取自己那份状态，不跨层共用一份KV。'
    },
    embeddings: {
      ids: 'tokenizer及runner提供本轮input_ids [T]；这些整数索引词表行，不携带hidden特征。',
      lookup: '接收IDs与已加载embedding权重，按行查表生成[T,6144]；结果交给媒体掩码融合或直接交主干。',
      visual: '上游视觉塔输出[Nvisual,6144]；按图片/视频网格长度拆分，供对应占位行使用。',
      merge: '接收文本向量、视觉向量及is_multimodal；用视觉向量替换对应行，输出统一inputs_embeds给语言forward。',
      out: '融合结果保持[T,6144]；语言主干接收它和独立positions，开始L0 attention。',
      weights: '初始化加载的词嵌入参数[200064,6144]提供向量内容；每轮查表读取，不由当前请求动态生成。'
    },
    stack: {
      input: '从embedding或上一PP stage接收hidden/residual；本stage按层顺序消费，同一token标识保持连续。',
      dense: '接收H₀并依次执行L0、L1、L2；各层MSA读上下文后使用Dense FFN，输出H₃给L3。',
      moe: '从L2接收状态，依次运行L3–59；每层MSA之后执行MoE，最后状态交给最终norm。',
      cache: '此前与本轮已写入的本层KV提供attention历史；本层更新自己的KV与index K供下一query继续读取。',
      final: '读取最后一层FFN输出及保留残差，完成加法与GemmaRMSNorm，输出词表投影需要的hidden。'
    },
    block: {
      h: '前层返回的hidden与residual共同表示当前H；首层则直接来自embedding，保存H作为attention残差。',
      norm1: '对上一FFN输出与residual作融合加法，再用本层GemmaRMSNorm缩放；归一化结果交MSA。',
      attn: '使用norm(H)投影主QKV与index QK，写入缓存并选块，输出6144维attention结果交post norm。',
      norm2: '把attention输出加到H得到H′，保留H′为residual；norm(H′)送往本层选择的FFN。',
      dense: '仅L0–2消费norm(H′)，经12288维Dense SwiGLU-OAI得到FFN输出，交给下一层。',
      moe: '仅L3–59消费norm(H′)，执行4个路由专家及共享专家合并，结果交给下一层。',
      next: '同时返回FFN输出与保留H′；下一层input norm或最终norm将二者相加，闭合FFN残差。'
    },
    attention: {
      hidden: '上游block的input norm提供[T,6144]；同一hidden分别交给主投影与index投影。',
      weights: '本层checkpoint参数提供Q/K/V、index Q/K、norm与输出投影权重；每层参数各自独立。',
      positions: 'runner从请求序列位置生成positions[T]；主QK和index QK使用相同token位置形成RoPE旋转。',
      main: 'hidden乘本层Wq/Wk/Wv得到Q[T,64,128]和K/V[T,4,128]；Q/K送norm，V留作缓存内容。',
      indexqk: 'hidden乘独立index权重得到Qidx[T,4,128]和Kidx[T,128]；只用于历史块选择。',
      mainnorm: '主Q/K分别per-head归一化并旋转64维；Q送稀疏attention，K连同未旋转V写入主cache。',
      indexnorm: 'index Q/K分别norm和RoPE；index K写入索引cache，index Q留给indexer打分。',
      cache: '用runner的slot_mapping增量写入K/V与index K；此前历史保留，分别供主attention和indexer读取。',
      select: 'index Q查询历史index K，为每个索引head返回16个以内block IDs；这些IDs交给主attention。',
      sparse: '主Q按对应GQA组读取选中K/V，施加因果mask、softmax并加权V，产生[T,64,128]给o_proj。',
      proj: '多头结果展平为[T,8192]，乘本层o_proj权重恢复[T,6144]；回到block残差加法。'
    },
    indexer: {
      q: '当前层index投影与RoPE输出Qidx[T,4,128]；每head独立查询历史块，不与主Q混用。',
      k: '此前及当前token已写入的index K由block_table定位；为点积提供历史128维向量。',
      dot: '读取一个index query和历史index keys，计算每个可见token的点积分数，交块内max归约。',
      max: '每128个token组成一个候选块，取块内最大分数；块分数交给可见性过滤与Top-k。',
      causal: '根据当前query位置屏蔽未来块，并提升最近1个可见块的优先级；结果送Top-16。',
      topk: '对每query/head保留最多16个块索引；最近块包含在预算中，无效位置不成为有效历史。',
      main: '收到top-k block IDs后读取主cache的K/V；索引分数仅决定读取范围，不替代主attention权重。'
    },
    cache: {
      current: '当前层QKV与index投影产生K/V [T,4,128]、index K [T,128]；作为本轮cache写入内容。',
      meta: 'runner提供slot_mapping决定写地址，block_table与seq_lens决定后续读取可见范围；这些是控制元数据。',
      history: '此前轮次已经就绪的本层KV内容保持原位；本轮追加当前token，索引未选中也不会将旧内容删除。',
      write: '用slot_mapping将当前有效token写入两类cache；写完后indexer与主attention才消费当前可见状态。',
      main: '历史加当前K/V组成主内容池；block_table定位物理页，主attention按top-k IDs读取选中块。',
      index: '历史加当前index K组成小索引池；indexer读取它为每个query选择主KV的块。',
      choose: 'index query读取index cache并返回top-k IDs；这些索引与主KV一起送给稀疏attention。',
      read: '根据top-k读取真实主K/V并产生attention输出；两类cache继续保留给后续轮次。'
    },
    moe: {
      h: 'post-attention norm提供[T,6144]；同一token同时供router打分和shared expert计算。',
      routerweights: '本层gate矩阵与训练得到的路由校正偏置在加载时就绪；参与当前token专家选择。',
      expertweights: '每个routed/shared专家拥有各自gate/up/down权重；被选专家和shared分支读取对应权重。',
      gate: 'hidden经gate线性层形成128个logits，再按sigmoid及路由规则产生选择分数；结果送Top-k。',
      shared: '读取所有token hidden和shared权重，运行3072维SwiGLU-OAI，输出交给最终专家求和。',
      top: '从128个候选中为每token选4个专家，产生IDs及归一化routing weights，供dispatch与combine。',
      experts: '根据IDs把token交给对应4个FFN，各自输出6144维向量；权重加权后形成routed分支结果。',
      sum: '把按配置缩放的routed加权和与shared输出相加，得到完整MoE FFN结果。',
      out: '将[T,6144] FFN结果交回block；block保留残差，下一层完成残差加法。'
    },
    mlp: {
      x: '来自block norm或MoE token分发的6144维输入，送本FFN的gate和up两套投影。',
      weights: 'checkpoint提供该FFN独立的Wgate、Wup、Wdown；Dense和不同expert不共用这些参数。',
      gate: 'x乘Wgate得到I维门控支路；该结果交激活，按配置仅裁剪上界。',
      up: 'x乘Wup得到I维内容支路；交激活前将两端限制在[-7,7]。',
      act: '接收gate/up，按SwiGLU-OAI生成门控乘积，输出I维向量给down_proj。',
      down: '激活乘积乘Wdown，从I维投影回6144；结果交block或MoE combine。',
      out: 'Dense输出直接返回当前block；expert输出必须先由MoE按routing weights合并。'
    },
    vision: {
      pixels: '媒体预处理提供时空patches和grid_thw；patch内容进入embedding，网格供3D RoPE与分段元数据使用。',
      embed: '用视觉patch权重把1176维像素块投影为1280维并做pre norm，交32层视觉encoder。',
      vit: '接收patch hidden与3D位置/分段信息，运行32层attention+MLP，最后[N,1280]特征交projector。',
      proj: '视觉特征依次经过1280→6144线性、GELU和6144→6144线性，输出同数量token给patch merger。',
      merge: '按空间邻接把4个6144维向量拼为24576维，经两层MLP生成一个6144维向量；输出token数N/4。',
      out: '视觉结果按grid长度拆分，交embedding融合按媒体掩码替换文本序列占位行。'
    },
    head: {
      hidden: 'L59返回FFN hidden与attention后residual；两者交最后norm完成主干输出。',
      norm: '先将hidden加到residual，再做GemmaRMSNorm，形成[T,6144]并返回runner。',
      select: 'runner根据请求需要从主干hidden选出待采样行；将[Nsample,6144]送compute_logits。',
      weights: '加载独立Whead[200064,6144]供词表投影；本模型tie_word_embeddings=false。',
      lm: 'selected hidden乘Whead得到[Nsample,200064] logits，交框架sampler或verifier。',
      sampler: '采样器按生成策略消费 logits；推测模式还结合候选和 target 分布，输出连续接受前缀与 correction，或全接受后的 bonus。',
      next: '采样或验证得到的有效 token（含 correction / bonus）成为请求新增序列；后续 runner 将末 token IDs 和 positions 送回 embedding，按有效长度读取历史 KV。'
    },
    draft: {
      features: '目标模型在指定层边界采集特征并按配置拼接成[Nctx,30720]，交草稿fc；抽取语义服从worker接口。',
      tokens: '推测worker提供当前已接受anchor及noise槽位IDs，形成配置大小为7的草稿块输入。',
      sharedweights: 'DSpark attach_shared_modules接收主模型embedding和LM head；前者供draft输入，后者供base logits。',
      context: '拼接target hidden经30720→6144的fc和norm；由draft每层KV投影建立可查询上下文。',
      embed: '草稿IDs读取共享目标embedding，生成6144维draft query hidden，交5层草稿网络。',
      draft: 'draft query读取上下文KV和块内信息，执行5层窗口attention与Dense FFN，最终norm hidden交输出头。',
      markov: '草稿hidden经共享LM head产生base logits；前token的Markov偏置形成半自回归候选，confidence随候选交worker。',
      target: '主模型读取历史上下文和草稿候选，按因果约束运行候选位置forward，输出target logits给verifier。',
      verify: 'verifier 接收草稿候选 IDs / q 与 target logits / p，判定连续接受前缀；首拒后补 correction，全接受后补 bonus，完整有效输出交 worker。confidence 用于调度，不替代验证。',
      accepted: '接收 verifier 的连续接受前缀加 correction，或全部候选加 bonus；worker 提交有效 IDs 与长度、限制可见缓存范围，并把末 token / 上下文特征交下一轮 draft。拒绝后缀不能成为历史。'
    }
  };
  Object.entries(descriptions).forEach(([componentId, nodes]) => {
    c[componentId].nodes.forEach(node => { node.description = nodes[node.id] || node.description; });
  });

  model.sources.push(
    { id: 'verifyaccept', label: 'SGLang DSpark：greedy / sampling 验证分派：1296–1387', url: 'https://github.com/sgl-project/sglang/blob/17e94c4677d7beb58a89b104fd61b3768994e45e/python/sglang/srt/speculative/dspark_components/dspark_verify.py#L1296', local: 'E:/code/sglang/python/sglang/srt/speculative/dspark_components/dspark_verify.py:1296' },
    { id: 'verifygreedy', label: 'SGLang：连续匹配、末 token 与有效长度：587–783', url: 'https://github.com/sgl-project/sglang/blob/17e94c4677d7beb58a89b104fd61b3768994e45e/python/sglang/kernels/ops/speculative/dspark/dspark_accept.py#L587', local: 'E:/code/sglang/python/sglang/kernels/ops/speculative/dspark/dspark_accept.py:587' },
    { id: 'verifyoutputs', label: 'SGLang：组装 out_tokens、commit_lens、new_seq_lens：1103–1182', url: 'https://github.com/sgl-project/sglang/blob/17e94c4677d7beb58a89b104fd61b3768994e45e/python/sglang/srt/speculative/dspark_components/dspark_verify.py#L1103', local: 'E:/code/sglang/python/sglang/srt/speculative/dspark_components/dspark_verify.py:1103' },
    { id: 'verifycontext', label: 'SGLang：已提交 target hidden 更新下一轮 draft KV', url: 'https://github.com/sgl-project/sglang/blob/17e94c4677d7beb58a89b104fd61b3768994e45e/python/sglang/srt/speculative/dspark_components/dspark_deferred_commit.py#L1', local: 'E:/code/sglang/python/sglang/srt/speculative/dspark_components/dspark_deferred_commit.py:1' }
  );
  c.draft.sources.push('verifyaccept', 'verifyoutputs');
  const submitted = c.draft.edges.find(edge => edge.from === 'verify' && edge.to === 'accepted');
  if (submitted) submitted.label = '⑥有效前缀 + correction / bonus';
  c.verification = {
    title: 'DSpark 后的验证：拒绝纠正或全接受奖励', parent: 'draft', verificationDemo: true,
    intro: [
      '草稿候选必须交主模型验证。这里展开通用的因果验证闭环：候选 forward → 连续接受前缀 → 首拒 correction 或全接受 bonus → 提交有效状态 → 下一轮起草。下面的固定 5 token 交互采用 greedy 比较，字符只是教学 token。',
      '官方 MiniMax 草稿配置 block_size=7；教学示例的 K=5 与该配置独立。K 表示 worker 本轮实际提交的候选数量，不把 anchor、草稿槽位与最终输出数混为一谈。此图依据本地 SGLang 验证接口说明算法边界，不证明 vLLM-Ascend 已支持 MiniMax DSpark。'
    ],
    inputs: 'worker 的候选 IDs d [R,K]、实际草稿分布 q [R,K,V]（随机路径）；已确认历史 / anchor IDs、positions、有效 KV 与长度 [R]；已加载 target 权重及采样配置。target forward 在本图内产生验证输入 p [R,K+1,V]；R 为请求数，V=200064，形状是逻辑表示。',
    outputs: '连续接受前缀 + 首拒 correction，或全部候选 + bonus，组成有效 IDs [R,≤K+1]；每请求有效长度、末 token 与可见缓存范围交 worker，已提交 target 特征供下一轮 draft 更新上下文。停止条件 / 调度上限可进一步截断输出。',
    notes: [
      'greedy 示例按 d_i 是否等于 target argmax 判定，首个不匹配后停止接受。随机路径需要相应 p / q 和采样状态；此图不把 greedy 比较当作随机拒绝采样公式，也不承诺各后端采用同一具体算法。',
      'target 的第 i 个预测分布基于已确认历史与前 i−1 个候选；拒绝后的候选及其后续分布不能继续当成已确认路径。全接受时才使用最后一行分布生成 bonus。',
      '源码中的 bonus 字段也承载首拒时的纠正 token。逻辑图把 correction 和全接受 bonus 分开，以说明两个互斥来源。',
      '输出 token 已确定不等于它的 KV 已算完：新 correction / bonus 的 target KV 仍需后续 forward 物化。拒绝后缀由有效长度 / 映射排除，不表示把物理 cache 清零。'
    ],
    sources: ['card', 'draftconfig', 'draft', 'verifyaccept', 'verifygreedy', 'verifyoutputs', 'verifycontext'],
    nodes: [
      { id: 'draft', label: '候选 IDs 与草稿 q', detail: 'd [R,K]；随机路径携带 q', kind: 'draft', col: 0, row: 0, target: 'draft', description: 'DSpark 输出经 worker 形成候选 IDs d；随机路径保留实际 proposal 分布 q。IDs 送 target forward，d / q 另送 verifier；confidence 不能代替 q 或 target 验证。' },
      { id: 'history', label: '已确认历史与 KV', detail: 'anchor / positions / 长度', kind: 'cache', col: 2, row: 0, target: 'cache', description: '上一轮 worker 提供已确认历史、anchor、positions 与有效缓存范围；target 在这些状态后处理候选，提交阶段据原长度决定新边界。' },
      { id: 'weights', label: '已加载 target 权重', detail: '主干参数 + LM head', kind: 'state', col: 0, row: 1, target: 'stack', description: 'checkpoint 加载的 MiniMax 主模型参数供 target forward 与词表投影读取；本轮验证不训练或修改这些权重。' },
      { id: 'target', label: '主模型候选 forward', detail: '因果计算候选位置 hidden', kind: 'stack', col: 1, row: 1, target: 'stack', description: '读取历史 KV、anchor 与候选 IDs，在正确 positions 和因果可见范围内运行 60 层主干；候选位置 hidden 交最终 norm / LM head，产生逐位置预测。' },
      { id: 'p', label: '目标预测 p', detail: '逻辑 [R,K+1,200064]', kind: 'logits', col: 1, row: 2, target: 'head', description: 'target hidden 经过 norm / LM head 得到 logits，再按请求采样规则解释为 p；前 K 行对应候选验证，末行仅在全接受时供 bonus，结果交 verifier。greedy 可直接用 logits argmax。' },
      { id: 'policy', label: '请求采样规则', detail: 'greedy / 随机状态 / 停止条件', kind: 'state', col: 2, row: 2, description: '请求携带采样策略与必要随机状态，决定 target 分布和验证路径；停止条件及输出预算约束最后提交数，交验证与 worker 提交阶段使用。' },
      { id: 'accept', label: '确定连续接受前缀', detail: '首拒位置 j 或全部 K 个接受', kind: 'verify', col: 1, row: 3, description: '同时消费候选 d、target p 和适用的 q / 采样状态；greedy 示例逐位置比较 argmax，得到连续接受长度。首拒走 correction 分支，全接受走 bonus 分支。' },
      { id: 'correction', label: '首拒后的 correction', detail: '已接受 d₁…dⱼ₋₁ + c', kind: 'sample', col: 0, row: 4, description: '收到首拒位置 j 与该位置 target 分布；greedy 取 argmax p_j 作为纠正 token c，放在已接受前缀后。随机路径遵循相应验证规则；拒绝后缀不提交，结果交有效输出合并。' },
      { id: 'bonus', label: '全接受后的 bonus', detail: '全部 d₁…dK + b', kind: 'sample', col: 2, row: 4, description: '仅在 K 个候选均接受后，使用最后位置 target 分布按请求规则选择 bonus b；将全部候选加 b 交有效输出合并，greedy 示例取该分布 argmax。' },
      { id: 'commit', label: '提交有效 token 与状态', detail: 'IDs / 长度 / 可见缓存范围', kind: 'state', col: 1, row: 5, description: '接收两个互斥分支之一的有效序列，并遵守停止条件及预算；worker 更新输出 IDs、有效长度与缓存可见范围，排除拒绝后缀，把末 token 和已提交 target 特征交下一轮。' },
      { id: 'next', label: '下一轮 DSpark 输入', detail: '末 token + 有效上下文', kind: 'draft', col: 1, row: 6, target: 'draft', description: 'worker 将新末 token / anchor、有效位置及已提交 target 特征提供给下一轮 DSpark，更新可查询 draft 上下文再提出候选；correction / bonus 自身的 target KV 随后续 forward 物化。' }
    ],
    edges: [
      { from: 'draft', to: 'target', label: '①anchor 后的候选 IDs', step: 1 },
      { from: 'history', to: 'target', label: '①历史 KV / positions', step: 1 },
      { from: 'weights', to: 'target', label: '②加载的主干 / head 参数', step: 2 },
      { from: 'target', to: 'p', label: '②hidden → logits → p', step: 2 },
      { from: 'policy', to: 'p', label: '③请求采样规则', step: 3 },
      { from: 'draft', to: 'accept', label: '③候选 d / 随机路径 q', step: 3 },
      { from: 'p', to: 'accept', label: '③逐位置 target p', step: 3 },
      { from: 'policy', to: 'accept', label: '④验证策略 / 随机状态', step: 4 },
      { from: 'accept', to: 'correction', label: '⑤首拒 j / 前缀 / pⱼ', step: 5 },
      { from: 'accept', to: 'bonus', label: '⑤全部接受 / pK₊₁', step: 5 },
      { from: 'correction', to: 'commit', label: '⑥接受前缀 + correction', step: 6 },
      { from: 'bonus', to: 'commit', label: '⑥全部候选 + bonus', step: 6 },
      { from: 'history', to: 'commit', label: '⑥旧长度 / KV 映射', step: 6 },
      { from: 'policy', to: 'commit', label: '⑥停止条件 / 输出预算', step: 6 },
      { from: 'target', to: 'commit', label: '⑥候选 KV / target 特征', step: 6 },
      { from: 'commit', to: 'next', label: '⑦有效 IDs / 长度 / 上下文', step: 7 }
    ],
    steps: [
      { title: '提交本轮候选与历史', text: 'worker 将候选 d 与已确认历史、anchor、positions、有效 KV 送 target；随机路径的 q 保留给 verifier。K 由本轮提交决定。', focus: ['draft', 'history', 'target'] },
      { title: 'target 一次计算验证位置', text: '主模型用已加载权重对候选位置做因果 forward，hidden 经 LM head 形成 K+1 个逻辑预测位置，最后一行留给全接受后的 bonus。', focus: ['weights', 'target', 'p'] },
      { title: '对齐候选与目标分布', text: 'verifier 接收 d_i 对应的 target p_i，随机路径还消费实际 q_i；请求采样规则决定分布。候选自身不能泄漏到预测它的输入中。', focus: ['draft', 'p', 'policy', 'accept'] },
      { title: '找到连续接受边界', text: 'greedy 示例从首个候选开始比较 target argmax，首个不匹配确定 j；后面的候选不能越过该位置继续接受。全匹配则接受 K 个。', focus: ['accept'] },
      { title: '纠正与 bonus 二选一', text: '首拒输出此前接受前缀加 correction；全接受输出全部候选加 bonus。两支互斥，不是把两个额外 token 都添加到序列。', focus: ['accept', 'correction', 'bonus'] },
      { title: '提交有效输出与缓存边界', text: 'worker 合并有效序列并处理停止条件 / 预算，更新长度与缓存可见范围；拒绝后缀不成为历史。新 correction / bonus 的 KV 尚需后续 forward。', focus: ['correction', 'bonus', 'commit', 'history'] },
      { title: '用确认后的状态再次起草', text: '新末 token、有效位置和已提交 target 特征交下一轮 DSpark；draft 上下文只吸收有效历史，然后再提出候选。固定 5 token 的交互例子不改变实际 block_size=7。', focus: ['commit', 'next'] }
    ]
  };
})();
