/* GLM-5.3: official checkpoint configuration + locally inspected vLLM forward. */
(() => {
  const n = (id, label, detail, kind, col, row, target, description, extra = {}) =>
    ({ id, label, detail, kind, col, row, ...(target ? { target } : {}), ...(description ? { description } : {}), ...extra });
  const e = (from, to, label, step, optional = false) => ({ from, to, label, step, ...(optional ? { optional: true } : {}) });
  const s = (title, text, focus) => ({ title, text, focus });
  const rev = '295c062db8a48ea73bbd05d1174cb37d24bf86f9';
  const hf = 'ba32f8c19c8738e2c57c71798c601d477a7bf844';
  const gh = (path, line) => `https://github.com/vllm-project/vllm/blob/${rev}/${path}#L${line}`;
  window.ARCH_MODELS.glm53 = {
    id: 'glm53',
    name: 'GLM-5.3',
    subtitle: '78 层 Decoder · MLA + DSA · 跨层复用 TopK · 256 选 8 MoE',
    summary: '沿 GLM-5.3 的文本 forward 展开：前 3 层使用 Dense FFN，后 75 层使用 MoE。每层有自己的 MLA KV，部分层重新运行 indexer，其余层复用选中的历史位置。官方 README 说明它沿用 GLM-5.2 基座，改进来自后训练；本页不是 GLM-5.3-Flash / glm5next 架构。',
    checked: '2026-11-05',
    revision: `HF ${hf.slice(0, 8)} · vLLM ${rev.slice(0, 10)} · CUDA owning forward 静态分析`,
    stats: [
      { label: '主干层数', value: '78 = 3 Dense + 75 MoE' },
      { label: 'Hidden / Q heads', value: '6144 / 64' },
      { label: 'MoE 每 token', value: '256 选 8 + 1 shared' },
      { label: 'DSA 检索', value: 'Top2048 · 21 个 full indexer' },
      { label: 'MLA latent', value: 'KV 512 + RoPE 64' },
      { label: '配置最大位置', value: '1,048,576 tokens' }
    ],
    sources: [
      { id: 'config', label: '官方 GLM-5.3 config：维度、层型、indexer 与 MTP', url: `https://huggingface.co/zai-org/GLM-5.3/blob/${hf}/config.json` },
      { id: 'readme', label: '官方 GLM-5.3 README：沿用 GLM-5.2 基座', url: `https://huggingface.co/zai-org/GLM-5.3/blob/${hf}/README.md` },
      { id: 'entry', label: 'vLLM 平台入口：GlmMoeDsaForCausalLM 映射至 DSA 实现', url: gh('vllm/models/deepseek_v32/__init__.py', 1), local: 'E:/code/vllm/vllm/models/deepseek_v32/__init__.py:1' },
      { id: 'registry', label: 'vLLM 模型注册表：GlmMoeDsaForCausalLM', url: gh('vllm/model_executor/models/registry.py', 118), local: 'E:/code/vllm/vllm/model_executor/models/registry.py:118' },
      { id: 'model', label: 'DeepseekV32Model：embedding、78 层循环与 final norm', url: gh('vllm/models/deepseek_v32/nvidia/model.py', 172), local: 'E:/code/vllm/vllm/models/deepseek_v32/nvidia/model.py:172' },
      { id: 'forward', label: 'DeepseekV32Model.forward：241–324', url: gh('vllm/models/deepseek_v32/nvidia/model.py', 241), local: 'E:/code/vllm/vllm/models/deepseek_v32/nvidia/model.py:241' },
      { id: 'block', label: 'DecoderLayer：Dense/MoE 选择与双残差 forward', url: gh('vllm/models/deepseek_v32/nvidia/model.py', 57), local: 'E:/code/vllm/vllm/models/deepseek_v32/nvidia/model.py:57' },
      { id: 'attn', label: 'DeepseekV32Attention.forward：298–463', url: gh('vllm/models/deepseek_v32/attention.py', 298), local: 'E:/code/vllm/vllm/models/deepseek_v32/attention.py:298' },
      { id: 'indexer', label: 'Indexer 投影、index K cache 与 TopK 参数', url: gh('vllm/models/deepseek_v32/attention.py', 50), local: 'E:/code/vllm/vllm/models/deepseek_v32/attention.py:50' },
      { id: 'sharing', label: '按 freq/offset 决定哪些层创建 indexer', url: gh('vllm/models/deepseek_v32/attention.py', 166), local: 'E:/code/vllm/vllm/models/deepseek_v32/attention.py:166' },
      { id: 'sparse', label: '先写 TopK buffer，再进入本层 sparse MLA', url: gh('vllm/models/deepseek_v32/attention.py', 466), local: 'E:/code/vllm/vllm/models/deepseek_v32/attention.py:466' },
      { id: 'mla', label: 'MLA 数学语义：latent cache 与 MHA/MQA 两种计算', url: gh('vllm/model_executor/layers/attention/mla_attention.py', 25), local: 'E:/code/vllm/vllm/model_executor/layers/attention/mla_attention.py:25' },
      { id: 'moe', label: 'DeepseekV2MoE：路由器、shared expert 与 fused experts', url: gh('vllm/model_executor/models/deepseek_v2.py', 291), local: 'E:/code/vllm/vllm/model_executor/models/deepseek_v2.py:291' },
      { id: 'router', label: 'GroupedTopK：偏置选路、原分数权重、归一化及缩放', url: gh('vllm/model_executor/layers/fused_moe/router/grouped_topk_router.py', 112), local: 'E:/code/vllm/vllm/model_executor/layers/fused_moe/router/grouped_topk_router.py:112' },
      { id: 'dense', label: 'DeepseekV2MLP.forward：gate/up → SiLU×up → down', url: gh('vllm/model_executor/models/deepseek_v2.py', 244), local: 'E:/code/vllm/vllm/model_executor/models/deepseek_v2.py:244' },
      { id: 'head', label: '继承的 LM wrapper：forward 与 compute_logits 分离', url: gh('vllm/model_executor/models/deepseek_v2.py', 1965), local: 'E:/code/vllm/vllm/model_executor/models/deepseek_v2.py:1965' },
      { id: 'mtp', label: '独立 MTP：embedding/hidden 融合与一层 draft block', url: gh('vllm/models/deepseek_v32/nvidia/mtp.py', 63), local: 'E:/code/vllm/vllm/models/deepseek_v32/nvidia/mtp.py:63' },
      { id: 'mtpshare', label: 'MTP 迭代 TopK 复用及 draft head', url: gh('vllm/models/deepseek_v32/nvidia/mtp.py', 198), local: 'E:/code/vllm/vllm/models/deepseek_v32/nvidia/mtp.py:198' }
    ],
    root: 'overview',
    components: {
      overview: {
        title: 'GLM-5.3 整体 forward',
        intro: ['这是文本自回归 Decoder 架构。用本轮 T=8 个 token 作教学示例；S 表示可见历史长度，图中维度是未按 TP/EP 切分的逻辑形状。', '官方 architectures 为 GlmMoeDsaForCausalLM。本地 CUDA 入口别名指向 DeepseekV32ForCausalLM，其模型循环和 Attention 实现承载这份 checkpoint 配置。'],
        inputs: 'input_ids [T]、positions [T]；已有各层 KV cache；可选 inputs_embeds。',
        outputs: 'forward 返回归一化 hidden [T,6144]；runner 后续计算选中位置的 logits 并采样。',
        notes: ['官方 README 明确 GLM-5.3 与 GLM-5.2 使用相同 base model；此处没有引入 GLM-5.3-Flash 的混合 attention 或视觉塔。', 'MTP 是配置与 runner 启用的推测解码旁支，不是每个 token 必经的第 79 层。', '仅核对源码和配置，没有运行模型；这里不承诺 NPU/GPU 性能或具体量化缓存字节数。'],
        sources: ['config', 'readme', 'registry', 'entry', 'forward', 'head', 'mtp'],
        nodes: [
          n('embed', 'Token → Embedding', '[8] → [8,6144]', 'tokens', 0, 0, 'embedding'),
          n('runtime', '历史与位置信息', 'positions / 各层 latent KV', 'cache', 1, 0, 'mla'),
          n('stack', '78 层 Decoder', 'L0–2 Dense · L3–77 MoE', 'stack', 0, 1, 'decoderstack'),
          n('indices', '跨层共享 TopK', '21 次 full · 57 层 shared', 'selection', 1, 1, 'indexsharing'),
          n('head', 'Final norm → LM head', 'hidden → 154880 维词表分数', 'logits', 0, 2, 'head'),
          n('mtp', '可选 MTP 草稿', '1 个 predictor layer', 'draft', 1, 2, 'mtp'),
          n('sample', '外部采样与返回', '选中 token → 下一次输入', 'sample', 0, 3, 'head')
        ],
        edges: [e('embed', 'stack', 'hidden [8,6144]', 2), e('runtime', 'stack', 'positions / cache state', 2), e('stack', 'indices', 'full 层写位置 IDs', 2), e('indices', 'stack', 'shared 层读取 IDs', 2), e('stack', 'head', '末层 hidden + residual', 3), e('head', 'sample', 'logits', 4), e('head', 'mtp', 'normalized hidden（非 logits）', 5, true), e('sample', 'mtp', 'draft token IDs', 5, true)],
        steps: [s('准备输入', '文本 IDs 查 embedding，形成本轮 hidden；positions 和已有 KV 状态由 runner 提供。', ['embed', 'runtime']), s('逐层变换', '78 个 block 顺序执行；各层更新自己的 KV，指定 full 层重新检索历史位置。', ['stack', 'indices']), s('输出表征与词表分数', '合并最后未加回的 residual，做 final RMSNorm；compute_logits 在主 forward 之外调用。', ['head']), s('选择下一个 token', '外部 sampler 消费 logits，新 token 成为后续轮输入。', ['sample']), s('启用时才生成草稿', 'MTP 接收已有 hidden 与 token embedding；候选需由主模型验证后才能作为正式输出。', ['mtp'])]
      },
      embedding: {
        title: 'Embedding：从 token ID 到 6144 维', parent: 'overview',
        intro: ['词表有 154880 项。一个 token ID 索引一行 embedding；本轮所有 token 堆成 [T,6144]。本 checkpoint 不共享 embedding 与 LM head 权重。'],
        inputs: 'input_ids [T] 或调用方提供的 inputs_embeds [T,6144]。', outputs: 'embedding hidden [T,6144]，以及可融合计算的首层 normalized attn_in。',
        notes: ['本地有 full-vocab-on-rank 时 fused_embed_norm 可同时完成查表和首层 RMSNorm；这是执行融合，不是多出一种模型层。', '图用 T=8，真正的 T 由本轮 batch 调度决定。'], sources: ['config', 'model', 'forward'],
        nodes: [n('ids', '输入 token 队列', 't0 … t7', 'tokens', 0, 0), n('weights', 'Embedding 权重表', '[154880,6144]', 'state', 1, 0), n('lookup', '按 ID 取行', '8 个 token → 8 行向量', 'gather', 0, 1), n('external', '可选外部 embedding', 'inputs_embeds [8,6144]', 'state', 1, 1), n('h', '首层 hidden', '[8,6144] residual 起点', 'streams', 0, 2, 'block'), n('norm', '首层 Attention 输入', 'RMSNorm(h)', 'state', 1, 2, 'block')],
        edges: [e('ids', 'lookup', '行索引', 1), e('weights', 'lookup', '被索引的权重行', 1), e('lookup', 'h', 'embedding', 2), e('external', 'h', '替代查表结果', 2, true), e('h', 'norm', 'h', 3)],
        steps: [s('读取权重行', '每个 ID 从已加载的 embedding 表读取对应向量。', ['ids', 'weights', 'lookup']), s('建立 residual', '获得 [8,6144]；若提供 inputs_embeds，则直接以该张量作为输入。', ['h', 'external']), s('交给 L0', '首层保留 embedding 为 residual，并把 RMSNorm 后的值交给 Attention；两者可融合生成。', ['h', 'norm'])]
      },
      decoderstack: {
        title: '78 层堆叠：前 3 Dense，后 75 MoE', parent: 'overview',
        intro: ['所有 78 层都采用 MLA + DSA attention；不同的是 FFN 类型。L0–2 使用普通 Dense MLP，L3–77 使用 MoE。', 'full/shared 指 indexer 是否重新产生 TopK 位置，不能理解为这一层有无 Attention。'],
        inputs: 'embedding [T,6144]、positions、各层 cache。', outputs: '末层 hidden 与 residual，交给 final RMSNorm。',
        notes: ['层号从 0 开始。这里没有 Encoder/Decoder 的 20+20 划分，也没有 4 路 mHC residual。', '源码以 hidden_states 和 residual 两个张量延迟执行 residual add；它们表达一条 residual stream 的分拆状态。'], sources: ['config', 'block', 'forward', 'sharing'],
        nodes: [n('entry', 'Embedding hidden', '[8,6144]', 'streams', 0, 0, 'embedding'), n('early', 'L0–2：3 个 block', 'MLA/DSA + Dense FFN', 'stack', 0, 1, 'block'), n('dense', 'Dense FFN', 'intermediate 12288', 'shared', 1, 1, 'dense'), n('late', 'L3–77：75 个 block', 'MLA/DSA + MoE', 'stack', 0, 2, 'block'), n('moe', 'Sparse MoE', '256 选 8 + 1 shared', 'experts', 1, 2, 'moe', undefined, { expertCount: 256, selectedExperts: 8 }), n('share', 'full/shared indexer', '位置 ID 在相邻层间复用', 'selection', 1, 3, 'indexsharing'), n('end', 'Final RMSNorm', '合并末层 residual → [8,6144]', 'state', 0, 3, 'head')],
        edges: [e('entry', 'early', 'hidden', 1), e('early', 'dense', '归一化 FFN 输入', 1), e('early', 'late', 'L2 的输出状态', 2), e('late', 'moe', '归一化 FFN 输入', 2), e('share', 'late', 'TopK IDs', 2), e('late', 'end', 'hidden + residual', 3)],
        steps: [s('先过 Dense 层', 'L0、L1、L2 各运行 Attention 与宽度 12288 的 Dense FFN。', ['entry', 'early', 'dense']), s('再过 MoE 层', 'L3 至 L77 的 FFN 变为 MoE；Attention 仍逐层运行，部分层复用 earlier full layer 的 TopK。', ['late', 'moe', 'share']), s('完成主干', '最后一个 MoE 分支结果与 residual 合并，再做最终 RMSNorm。', ['end'])]
      },
      block: {
        title: '单层 block：两次归一化与残差更新', parent: 'decoderstack',
        intro: ['数学语义可写为 r = h + Attention(RMSNorm(h))，h_next = r + FFN(RMSNorm(r))。图把 residual 输入单独画出，避免把 norm 当作覆盖原始 residual。', '本地 forward 将 FFN 输出和 residual 分开返回，第二次加法延迟到下一层 input_layernorm 或 final norm；下面的末尾加法表示同一数学更新。'],
        inputs: '本层 residual 表征 [T,6144]；positions 与本层 Attention state。', outputs: '新的 [T,6144] residual 表征；源码以 FFN 分支结果 + residual 配对返回。',
        notes: ['L0–2 选择 Dense，L3–77 选择 MoE，两者是层配置分支，不能在同一层串联。', 'TP all-reduce、SP gather/scatter 可与 norm 等操作融合；本图展示模型计算语义。'], sources: ['config', 'block'],
        nodes: [n('h', '本层输入 h', '[8,6144]', 'streams', 0, 0), n('norm1', 'Attention RMSNorm', '[8,6144]', 'state', 0, 1), n('attn', 'MLA + DSA', 'Q / KV / TopK → attention', 'attention', 0, 2, 'attention'), n('add1', 'Attention residual add', 'r = h + attn_out', 'sum', 0, 3), n('norm2', 'FFN RMSNorm', 'x = RMSNorm(r)', 'state', 0, 4), n('dense', 'L0–2：Dense FFN', '6144 → 12288 → 6144', 'shared', 0, 5, 'dense'), n('moe', 'L3–77：MoE', '256 选 8 + shared', 'experts', 1, 5, 'moe', undefined, { expertCount: 256, selectedExperts: 8 }), n('add2', 'FFN residual add', 'h_next = r + ffn_out', 'sum', 0, 6)],
        edges: [e('h', 'norm1', 'h', 1), e('norm1', 'attn', 'normalized h', 2), e('attn', 'add1', 'attn_out', 3), e('h', 'add1', 'residual h', 3), e('add1', 'norm2', 'r', 4), e('norm2', 'dense', 'x；仅 L0–2', 5), e('norm2', 'moe', 'x；仅 L3–77', 5), e('dense', 'add2', 'dense_out', 6), e('moe', 'add2', 'moe_out', 6), e('add1', 'add2', 'residual r', 6)],
        steps: [s('保留 residual', '保留 h；计算 Attention 需要的 RMSNorm(h)。', ['h', 'norm1']), s('读取历史', 'MLA 为本层投影 Q/KV，DSA 选择或复用 TopK 历史位置并完成 attention。', ['attn']), s('第一次残差更新', '把 attention 输出加回 h，得到 r。', ['h', 'add1']), s('准备 FFN 输入', '保留 r，同时计算 RMSNorm(r)。', ['norm2']), s('按层型运行 FFN', '早三层使用 Dense；之后使用 MoE，输入和输出 hidden 宽度相同。', ['dense', 'moe']), s('第二次残差更新', 'FFN 输出加回 r。实现可把此加法延迟到下一次 RMSNorm。', ['add2'])]
      },
      attention: {
        title: 'Attention：MLA 数据路径与 DSA 选择路径', parent: 'block',
        intro: ['MLA 决定 Q/KV 如何表示和计算，DSA 决定本次需要关注哪些历史位置。两条路径在 sparse attention 合流。', '本层 MLA cache 保留压缩通道的 KV；full indexer 层另有 index K cache。共享层复用位置 IDs，但仍生成本层 Q、写本层 KV、做本层 attention。'],
        inputs: 'normalized hidden [T,6144]、positions、历史 cache、上一个 full 层的 TopK（若 shared）。', outputs: 'attn_out [T,6144]，交给本层 residual add。',
        notes: ['Top2048 是最多保留的历史位置数；短上下文、padding 与 causal mask 会减少有效项。', '特定后端可对短 prefill 使用等价 dense 路径；图描述有稀疏筛选时的主语义，不保证每批都实际调用 TopK kernel。'], sources: ['config', 'attn', 'sparse', 'mla', 'sharing'],
        nodes: [n('x', '归一化 hidden', 'x [8,6144] + positions', 'streams', 0, 0), n('mla', 'MLA 投影与缓存', 'Q latent / KV latent / RoPE', 'attention', 0, 1, 'mla'), n('index', 'full 层：Indexer', 'index Q/K → Top2048', 'selection', 1, 1, 'indexer'), n('reuse', 'shared 层：复用 IDs', '最近 full 层的选择结果', 'state', 1, 2, 'indexsharing'), n('read', '选中的本层历史', 'TopK IDs 索引本层 KV', 'gather', 0, 2, 'mla'), n('attend', 'Sparse attention', 'causal QK → softmax → V', 'attention', 0, 3, 'mla'), n('out', '输出投影 o_proj', '64×256 → 6144', 'state', 0, 4)],
        edges: [e('x', 'mla', '本层 x / positions', 1), e('x', 'index', 'x；Q 使用 q_c', 2), e('mla', 'index', 'normalized q_c', 2), e('mla', 'read', '本层历史 KV', 3), e('index', 'read', '新 TopK IDs', 3), e('reuse', 'read', '复用 TopK IDs', 3), e('mla', 'attend', '本层 Q', 4), e('read', 'attend', '选中的历史表示', 4), e('attend', 'out', '每个 head 的结果', 5)],
        steps: [s('生成本层表示', 'x 分别产生 Q latent、KV latent 与位置分量；新 KV 写入本层缓存。', ['x', 'mla']), s('决定历史位置', 'full 层运行独立 indexer；shared 层使用前一 full 层已经写好的位置 IDs。', ['index', 'reuse']), s('按位置取本层 KV', 'TopK 只提供位置；从当前 attention 层自己的 cache 读取对应表示。', ['read']), s('计算 attention', '本层 Q 与选中历史做带因果约束的 attention，聚合 V。', ['attend']), s('返回 residual 宽度', '各 head 的结果由 o_proj 映射回 [8,6144]。', ['out'])]
      },
      mla: {
        title: 'MLA：压缩通道，不压缩 token 时间轴', parent: 'attention',
        intro: ['GLM-5.3 的 Q 低秩维为 2048，KV latent 为 512；每条历史记录另带 64 维 RoPE key。缓存逻辑上可看作每层 [S,512+64]，不是每个 token 缓存 64 组完整 K/V。', '这里画出数学等价的显式 K/V 路径帮助理解。decode 实现可把 K 的升维权重吸收到 Q、把 V 的升维放在聚合后，不必实际展开所有历史 K/V。'],
        inputs: 'x [T,6144]、positions [T]、本层历史 latent cache、TopK IDs。', outputs: '每头输出 [T,64,256]，经 o_proj 变为 [T,6144]。',
        notes: ['QK 每头为 192 个 non-RoPE 通道 + 64 个 RoPE 通道；不能把 config 的 head_dim=192 当作完整 QK 宽度。', '512+64 是逻辑通道数量，不是字节数；量化、padding、分页会改变物理布局。', 'S 随上下文增加；MLA 的压缩发生在特征维，而非把若干历史 token 池化成一个 token。'], sources: ['config', 'attn', 'mla'],
        nodes: [n('x', '当前 hidden x', '[8,6144]', 'streams', 0, 0), n('pos', '位置 positions', 'RoPE 使用各 token 位置', 'state', 1, 0), n('q', 'Q 低秩再升维', '2048 → 64×(192+64)', 'attention', 0, 1), n('kv', 'KV latent 与位置 K', 'Norm(c_KV)=512 · k_R=64', 'state', 1, 1), n('cache', '当前层 KV cache', '历史 [S,512+64]', 'cache', 1, 2), n('ids', 'DSA TopK 位置', '最多 2048 个 / query', 'selection', 0, 2, 'indexsharing'), n('expand', '选中 latent → K/V', 'K:64×192 · V:64×256', 'gather', 1, 3), n('attend', 'QK 匹配与 V 聚合', '加上 RoPE 分量；causal', 'attention', 0, 3), n('output', '恢复 hidden 宽度', '[8,64,256] → [8,6144]', 'state', 0, 4)],
        edges: [e('x', 'q', 'Q A-proj → Norm → B-proj', 1), e('x', 'kv', 'KV A-proj', 1), e('pos', 'q', '旋转 Q 的 64 维部分', 2), e('pos', 'kv', '旋转 k_R', 2), e('kv', 'cache', '写当前 token 的记录', 2), e('cache', 'expand', '选中 c_KV / k_R', 3), e('ids', 'expand', '位置 IDs', 3), e('q', 'attend', 'Q', 4), e('expand', 'attend', '选中的 K / V', 4), e('attend', 'output', 'head outputs', 5)],
        steps: [s('拆分低秩分支', '融合 A projection 得 q_c [8,2048]、kv_c [8,512]、k_pe [8,64]；Q 再由 B projection 升维。', ['x', 'q', 'kv']), s('处理位置并写 cache', 'Q 和位置 K 应用 RoPE；normalized KV latent 与位置 K 写入当前层 cache。', ['pos', 'kv', 'cache']), s('选历史记录', '使用 TopK IDs 读取最多 2048 条可见历史记录；显式升维只是数学解释。', ['ids', 'expand']), s('按内容与位置聚合', 'QK 分数经因果 mask 和 softmax 得权重，再聚合 V；吸收式 decode 路径具有相同语义。', ['q', 'attend']), s('投影输出', '64 个 head、每头 256 维的结果由 o_proj 回到 hidden 6144。', ['output'])]
      },
      indexer: {
        title: 'Lightning indexer：选择历史位置', parent: 'attention',
        intro: ['Indexer 是主 attention 旁边的小型选择网络。它有 32 个 query heads、每 head 128 维，目标是输出历史位置 IDs，而不是生成最终 hidden。', 'Q 来自 MLA 已归一化的 q_c；index K 和每个 query head 的权重来自当前 x。index K cache 与 MLA KV cache 是不同数据。'],
        inputs: 'normalized q_c [T,2048]、x [T,6144]、positions、历史 index K。', outputs: 'topk_indices_buffer 的有效行 [T,2048]（不足时有无效项）。',
        notes: ['只有 full indexer 层构造并执行这些投影；shared 层无需重新计算 index K/Q。', '分数与 TopK 是选择信息，不能直接替代主 attention 的 softmax 权重。', '本地 index K 使用量化缓存，具体编码属于后端实现，不把 128 个通道说成固定 128 字节。'], sources: ['config', 'indexer', 'attn', 'sparse'],
        nodes: [n('qc', 'MLA Q latent', 'q_c [8,2048]', 'streams', 0, 0, 'mla'), n('x', '当前 hidden x', '[8,6144] + positions', 'streams', 1, 0), n('iq', 'Index Q 投影', '[8,32,128] + RoPE', 'attention', 0, 1), n('kw', 'Index K / head 权重', 'K [8,128] · w [8,32]', 'state', 1, 1), n('cache', 'Index K 历史', 'LayerNorm → RoPE → 存储', 'cache', 1, 2), n('scores', '多头检索分数', '每 query 对可见历史打分', 'selection', 0, 2), n('top', '选出 Top2048', '输出历史位置 IDs', 'selection', 0, 3, 'indexsharing')],
        edges: [e('qc', 'iq', 'indexer.wq_b(q_c)', 1), e('x', 'kw', 'wk_weights_proj(x)', 1), e('kw', 'cache', 'normalized / rotated K', 2), e('iq', 'scores', 'query heads', 3), e('kw', 'scores', 'query head weights', 3), e('cache', 'scores', '历史 index K', 3), e('scores', 'top', '有效历史分数', 4)],
        steps: [s('准备检索输入', 'q_c 生成 32 个检索 Q；x 同时生成 index K 和 32 个 head 权重。', ['qc', 'x', 'iq', 'kw']), s('更新 index cache', '当前 index K 经 LayerNorm 和 RoPE 后写 cache，后续 query 可检索它。', ['cache']), s('给历史打分', '检索 Q、历史 K 和 head 权重共同形成位置分数，遵守请求边界及因果可见性。', ['scores']), s('写位置 buffer', '选出最多 2048 个位置，当前层及随后的 shared 层使用这些 IDs。', ['top'])]
      },
      indexsharing: {
        title: '跨层复用的是 TopK，不是 KV', parent: 'attention',
        intro: ['官方配置的 full 层为 L0、L1、L2，以及 L6、L10、…、L74；共 21 个。其余 57 层是 shared。', '本地代码以 max(layer_id−2,0) % 4 == 0 判定这些 full 层，与 index_topk_freq=4、index_skip_topk_offset=3 及官方 indexer_types 一致。下面展示 L2→L5，L6 再次检索。'],
        inputs: 'full 层生成的 TopK IDs；每一层独立的 Q 和 MLA KV cache。', outputs: '各层自己的 attention 输出；L6 更新下一组使用的 IDs。',
        notes: ['共享选择只在同一 forward 中把较早 full 层的结果交给后续层，不是跨请求共用一份语义状态。', 'L3、L4、L5 用同一批历史位置，但读取各自 cache 中对应位置的 KV；三个输出通常不同。', 'L0、L1、L2 连续运行 full indexer，因此 L0/L1 的选择不会替代 L2 的选择。'], sources: ['config', 'model', 'sharing', 'sparse'],
        nodes: [n('full', 'L2 full indexer', '重新检索当前 query', 'selection', 0, 0, 'indexer'), n('ids', '共享位置 buffer', 'I₂ [T,2048]', 'state', 0, 1), n('own', '每层自己的 Q / KV', 'Q₃/KV₃ · Q₄/KV₄ · Q₅/KV₅', 'cache', 1, 1, 'mla'), n('l3', 'L3 shared attention', '读取 I₂ 对应的 KV₃', 'attention', 0, 2, 'attention'), n('l4', 'L4 shared attention', '读取 I₂ 对应的 KV₄', 'attention', 1, 2, 'attention'), n('l5', 'L5 shared attention', '读取 I₂ 对应的 KV₅', 'attention', 0, 3, 'attention'), n('l6', 'L6 full indexer', '新的 query → I₆', 'selection', 0, 4, 'indexer')],
        edges: [e('full', 'ids', '写 I₂', 1), e('ids', 'l3', '位置 IDs', 2), e('ids', 'l4', '同一 I₂', 2), e('ids', 'l5', '同一 I₂', 2), e('own', 'l3', '本层 Q₃ / KV₃', 2), e('own', 'l4', '本层 Q₄ / KV₄', 2), e('own', 'l5', '本层 Q₅ / KV₅', 2), e('l5', 'l6', '经 block 后的 hidden', 3)],
        steps: [s('L2 生产位置', 'L2 根据它自己的输入重新打分，写入 TopK buffer I₂。', ['full', 'ids']), s('L3–5 顺序复用', '三个 block 顺序执行；图中并排表示共同的数据依赖，不表示这些层并行。每层使用 I₂ 和自己的 Q/KV。', ['ids', 'own', 'l3', 'l4', 'l5']), s('L6 刷新选择', 'L6 用更深层表征重新运行 indexer，结果供 L6–9 使用。', ['l6'])]
      },
      moe: {
        title: 'MoE：256 选 8，加一条 shared 分支', parent: 'block',
        intro: ['L3–77 的每个 token 都经过 1 个 shared expert，同时由 router 从 256 个 routed experts 中选择 8 个。每个专家是 intermediate=2048 的 SwiGLU MLP。', 'Router 在 FP32 中产生分数；sigmoid 后的分数加 correction bias 用于选择专家。最终权重从原 sigmoid 分数取出并归一化，再乘 routed_scaling_factor=2.5。'],
        inputs: 'FFN RMSNorm 输出 x [T,6144]；router 和专家权重。', outputs: 'MoE 分支结果 [T,6144]，交给 residual 更新。',
        notes: ['6/384 是 DeepSeek V4.1 的配置，不适用于本模型；这里是 8/256。', '校正 bias 影响选谁，不直接作为被选专家的聚合权重。', '图追踪一个 token 的 top8，batch 中不同 token 可选择不同专家；专家网格表示逻辑专家，不表示实际设备数。'], sources: ['config', 'moe', 'router', 'dense'],
        nodes: [n('x', 'FFN 输入 x', '[8,6144]', 'streams', 0, 0), n('route', 'FP32 Router', 'Linear → sigmoid；bias 选路', 'router', 0, 1), n('shared', 'Shared expert ×1', '每 token 都执行', 'shared', 1, 1, 'dense'), n('select', '选 8 / 256', '归一化原分数 × 2.5', 'selection', 0, 2), n('experts', '8 个 routed experts', '各自 SwiGLU(6144→2048)', 'experts', 0, 3, 'dense', undefined, { expertCount: 256, selectedExperts: 8 }), n('sum', '加权聚合与相加', 'Σ scaled_wᵢ Eᵢ(x) + Shared(x)', 'sum', 0, 4)],
        edges: [e('x', 'route', 'normalized x', 1), e('route', 'select', '256 个分数 + bias', 2), e('select', 'experts', 'expert IDs / scaled weights', 3), e('x', 'experts', '同一 token 的 x', 3), e('x', 'shared', '同一 token 的 x', 3), e('experts', 'sum', '8 路加权输出', 4), e('shared', 'sum', 'shared output', 4)],
        steps: [s('路由评分', 'x 投影成 256 个 logits，使用 sigmoid 得原始分数。', ['x', 'route']), s('选择与定权', '用加 correction bias 的分数选 top8；原分数归一化后乘 2.5 作为聚合权重。', ['select']), s('执行专家', '所选 8 个 routed experts 和一个 shared expert 处理同一个 x，得到各自输出。', ['experts', 'shared']), s('汇总输出', 'routed 输出按 scaled weights 求和，再加 shared 输出；不能重复乘 2.5。', ['sum'])]
      },
      dense: {
        title: 'SwiGLU：Dense FFN 与单个专家', parent: 'block',
        intro: ['两个线性分支分别产生 gate 和 up；SiLU(gate) 与 up 逐元素相乘，再经 down projection 回到 hidden 6144。', 'L0–2 的 Dense intermediate 是 12288；MoE 的 routed/shared 单个专家 intermediate 是 2048。计算结构相同，参数与宽度不同。'],
        inputs: 'normalized x [T,6144]。', outputs: 'FFN/expert 输出 [T,6144]。',
        notes: ['这张图展示普通算子语义；本地 gate_up_proj 把两个投影合并为一次线性计算，激活也可融合。', 'MoE 单个 expert 的输出还要经过路由加权，不能直接当作完整 MoE 输出。'], sources: ['config', 'dense', 'moe'],
        nodes: [n('x', '输入向量 x', '[8,6144]', 'streams', 0, 0), n('gate', 'Gate projection', 'x W_gate → [8,I]', 'state', 0, 1), n('up', 'Up projection', 'x W_up → [8,I]', 'state', 1, 1), n('silu', 'SiLU(gate)', '逐元素激活', 'state', 0, 2), n('mul', '与 up 逐元素相乘', '[8,I]', 'sum', 0, 3), n('down', 'Down projection', 'I → 6144', 'state', 0, 4)],
        edges: [e('x', 'gate', 'x', 1), e('x', 'up', 'x', 1), e('gate', 'silu', 'gate', 2), e('silu', 'mul', 'SiLU(gate)', 3), e('up', 'mul', 'up', 3), e('mul', 'down', '激活后特征', 4)],
        steps: [s('双投影', '同一 x 分别产生 gate 和 up；I 取 12288（Dense）或 2048（expert）。', ['x', 'gate', 'up']), s('门控激活', '对 gate 做 SiLU，保留 up 分支供逐元素相乘。', ['silu']), s('逐元素门控', 'SiLU(gate) × up，不是在 token 维求和。', ['mul']), s('恢复宽度', 'down projection 把 intermediate 映射回 [8,6144]。', ['down'])]
      },
      head: {
        title: 'Final norm、词表 head 与采样边界', parent: 'overview',
        intro: ['主干返回前先将最后的分支输出加回 residual，再应用 final RMSNorm。forward 的结果仍是 hidden，不是 token。', '继承的 compute_logits 另调用 LogitsProcessor 与 ParallelLMHead，把选中位置的 hidden 映射到 154880 项词表；外部 sampler 随后决定 token。'],
        inputs: '末层 branch hidden 与 residual [T,6144]。', outputs: '归一化 hidden；随后是 logits [N,154880] 与外部采样 token。',
        notes: ['N 是 runner 选来计算 logits 的位置数，可能小于 T；prefill 无需给每个位置都返回下一个 token。', 'tie_word_embeddings=false：LM head 权重不与 token embedding 绑定。', '采样策略与推测解码验收属于运行时，不是网络中的一层。'], sources: ['config', 'forward', 'head'],
        nodes: [n('branch', '末层 FFN 输出', '[T,6144]', 'streams', 0, 0), n('residual', '保留的 residual', '[T,6144]', 'streams', 1, 0), n('norm', 'Residual add + RMSNorm', 'forward 返回 hidden', 'state', 0, 1), n('select', 'Runner 选输出位置', '[N,6144]', 'selection', 0, 2), n('head', 'ParallelLMHead', '6144 → vocab 154880', 'logits', 0, 3), n('sampler', '外部 sampler', '策略决定下一 token', 'sample', 0, 4)],
        edges: [e('branch', 'norm', 'FFN branch', 1), e('residual', 'norm', 'residual', 1), e('norm', 'select', 'hidden [T,6144]', 2), e('select', 'head', '选中的 hidden', 3), e('head', 'sampler', 'logits [N,154880]', 4)],
        steps: [s('结束 residual 更新', '最后的 FFN 输出与 residual 一起做最终 RMSNorm。', ['branch', 'residual', 'norm']), s('返回 hidden', '主 forward 结束；runner 选择此次要读 logits 的位置。', ['select']), s('生成词表分数', 'compute_logits 使用独立的 LM head 计算 logits。', ['head']), s('选择并返回 token', '外部采样流程消费 logits，返回 token 并更新请求状态。', ['sampler'])]
      },
      mtp: {
        title: '可选 MTP：主干之外的草稿生成', parent: 'overview',
        intro: ['官方配置 num_nextn_predict_layers=1，对应额外的一个 predictor layer。它融合前一步 hidden 与当前 token embedding，经过一个 DSA+MoE block 产生 draft hidden。', '本地模型把这部分放在 DeepseekV32MultiTokenPredictor 中，主干的 78 层循环不直接调用它。它不是 DSpark。'],
        inputs: 'previous_hidden_states [T,6144]、token IDs/embedding、positions、draft 自己的缓存。', outputs: '草稿 hidden、草稿 logits；经外部推测解码验证后才成为正式输出。',
        notes: ['一个 predictor layer 可以被 proposer 迭代使用，不代表只允许一个候选 token，也不保证自动一次生成固定长度的块。', 'index_share_for_mtp_iteration=true；本地有首步计算 TopK、后续步复用的开关，实际切换由 proposer/runtime 驱动。', '本地 predictor 返回 post-final-norm hidden 给 head，同时把它作为下一 draft step 的 previous_hidden。'], sources: ['config', 'mtp', 'mtpshare'],
        nodes: [n('h', '已有 previous hidden', '[T,6144] → hnorm', 'streams', 0, 0), n('token', 'Token embedding', '[T,6144] → enorm', 'tokens', 1, 0, 'embedding'), n('merge', '拼接再投影', '[T,12288] → [T,6144]', 'gather', 0, 1), n('draft', 'MTP block ×1', 'DSA + MoE；独立 draft 状态', 'draft', 0, 2, 'block'), n('norm', 'Draft final norm / head', 'hidden → draft logits', 'logits', 0, 3), n('verify', '主模型验证候选', '接受的 token 才成为输出', 'verify', 0, 4, 'overview')],
        edges: [e('h', 'merge', 'normalized hidden', 1), e('token', 'merge', 'normalized embedding', 1), e('merge', 'draft', 'eh_proj 输出', 2), e('draft', 'norm', 'branch + residual', 3), e('norm', 'verify', '候选 token', 4, true)],
        steps: [s('融合两路输入', '分别归一化 hidden 与 token embedding，沿 hidden 维拼接，再用 eh_proj 投影回 6144。', ['h', 'token', 'merge']), s('执行 predictor', '额外 predictor block 运行自己的 attention 与 MoE。', ['draft']), s('计算草稿分数', 'residual 合并并做 final norm，head 生成 draft logits；post-norm hidden 可回馈下一步。', ['norm']), s('交给推测解码运行时', 'proposer 采样候选并安排主模型验证；这条可选流程与普通主干 forward 分离。', ['verify'])]
      }
    }
  };

  // Keep every click useful even when opened directly, without its parent view.
  const model = window.ARCH_MODELS.glm53;
  const io = {
    overview: ['runner 提供 input_ids [T]、positions [T] 和各层已有 KV/attention metadata；可选以 inputs_embeds [T,6144] 替代查表。', '主 forward → runner：normalized hidden [T,6144]；compute_logits → sampler：logits [N,154880]；sampler → 请求输出与后续 decode：token IDs。'],
    embedding: ['runner 提供 input_ids [T]（或 inputs_embeds [T,6144]）；模型加载阶段提供 embedding 权重 [154880,6144]。', '交给 L0：embedding residual [T,6144]；可融合生成首层 attention 使用的 attn_in=RMSNorm(embedding)。'],
    decoderstack: ['Embedding 或上一 PP stage 提供 hidden/residual [T,6144]；runner 提供 positions、各层 cache 与 attention metadata。', 'L77 → final norm：FFN branch [T,6144] 与 residual [T,6144]；非末 PP stage 则把这两个字段传给下一 stage。'],
    block: ['上一 block/embedding 提供本层 residual 表征 [T,6144]；runner 提供 positions；本层 attention 读取自己的 cache 与 TopK 状态。', '本层返回 hidden_states（FFN branch）和 residual，均 [T,6144]；下一 block 的 input_layernorm 或模型 final norm 合并二者。'],
    attention: ['本层 input RMSNorm → x [T,6144]；runner → positions/slot_mapping/因果 metadata；本层缓存 → 历史 KV；full indexer 或更早 full 层 → TopK IDs。', 'o_proj → 本层 post_attention_layernorm/residual add：attn_out [T,6144]；本层 KV cache 写入当前 token，供后续 query 使用。'],
    mla: ['本层 normalized x [T,6144]；runner 的 positions [T] 与 cache 写入位置；本层已有 latent cache；DSA/full 或共享 buffer 的 TopK IDs [T,2048]。', '每头 attention 结果 [T,64,256] → o_proj → attn_out [T,6144] → 本层 residual add；新的 latent 记录保留在本层 cache。'],
    indexer: ['MLA A-proj/Norm → q_c [T,2048]；本层 RMSNorm → x [T,6144]；runner → positions；本 full 层 index K cache → 历史检索 K。', '写入 topk_indices_buffer [T,2048] 的有效行；当前层 sparse attention 与后续 shared 层读取这些历史位置 IDs。'],
    indexsharing: ['L2 full indexer → I₂ [T,2048]；L3/L4/L5 各自的输入投影 → Qₗ；各自 cache → KVₗ；L6 输入表征来自 L5 完整 block。', 'L3/L4/L5 attention 分别输出 attn_out [T,6144] 给各自 block 的 residual/FFN；L6 写 I₆，供 L6–L9 的 attention 读取。'],
    moe: ['本层 FFN RMSNorm → x [T,6144]；checkpoint 加载提供 router [256,6144]、correction bias [256] 及 routed/shared expert 权重。', 'MoE → 本层 residual 更新（可延迟到下一 norm）：moe_out [T,6144]；路由中间值是 expert IDs 与 scaled weights [T,8]。'],
    dense: ['本层 FFN RMSNorm（Dense）或 MoE 分发（expert）→ x [T,6144]；checkpoint 加载提供各自 gate/up/down 权重。', 'Dense 输出 [T,6144] → block residual add；单个 routed expert 输出 → MoE weighted sum；shared expert 输出 → MoE shared 分支相加。'],
    head: ['L77 返回的 FFN branch [T,6144] 与 residual [T,6144]；checkpoint 加载提供 norm 权重及独立 LM head [154880,6144]。', 'final norm → runner：hidden [T,6144]；selected hidden [N,6144] → compute_logits；logits [N,154880] → sampler；token IDs → 请求输出/下轮输入。'],
    mtp: ['proposer 提供 previous_hidden_states [T,6144]（主模型表征或上一 draft 的 post-norm hidden）、token IDs/embedding、positions 与 draft cache。', 'predictor → proposer：post-norm draft hidden [T,6144] 和 draft logits [N,154880]；候选 tokens → 主模型验证；接受的 tokens → 正式请求输出。']
  };
  const actions = {
    overview: {
      embed: 'runner 的 token IDs 查已加载 embedding；得到 [T,6144] 并交给 L0。',
      runtime: 'runner 维护 positions 和分页 attention metadata；cache 中保留先前 query 写下的每层 latent KV，供主干各层读取和追加。',
      stack: '按 L0→L77 运行每个 block，更新 hidden/residual 与各层 cache；末层分支结果与 residual 交给 final norm。',
      indices: 'full indexer 层写 [T,2048] 历史位置；随后 shared 层用相同 IDs 访问各自 KV，直到下一个 full 层刷新。',
      head: 'L77 的 branch 与 residual 合并并归一化；返回 hidden 给 runner，再由 compute_logits 映射到词表。',
      mtp: 'proposer 把 previous hidden 与 token embedding 送入独立 predictor，产生待验证草稿；不改变主干层数。',
      sample: '外部运行时消费词表 logits 按采样参数选择 token；token 进入请求输出，也作为后续 decode/proposer 的输入。'
    },
    embedding: {
      ids: '来自 runner 的 input_ids [T]；每项是已分词 token 的整数 ID，交给 embedding 查表。',
      weights: 'checkpoint 加载的 embedding 参数 [154880,6144]；lookup 只读取 ID 对应的行。',
      lookup: '使用 input_ids 索引 embedding 表，保持 token 顺序，生成 [T,6144] 给 L0 residual。',
      external: '调用方可直接提供 inputs_embeds [T,6144]，替代 embedding 查表结果；两种入口不会相加。',
      h: 'lookup 或 inputs_embeds 提供 h [T,6144]；原值作为 L0 residual，并供首层 RMSNorm 读取。',
      norm: '读取首层 h 与已加载 norm 权重，生成 Attention 输入 [T,6144]；原 h 仍留在 residual 分支。'
    },
    decoderstack: {
      entry: 'embedding 生产的 hidden [T,6144] 进入 L0；positions 和 cache 由 runner 另行提供。',
      early: 'L0–L2 顺序执行 Attention、残差更新与 Dense FFN；L2 的状态流向 L3。',
      dense: '各早期 block 的 FFN RMSNorm 输出经宽度 12288 的 SwiGLU，结果返回该 block 的 residual 更新。',
      late: 'L3–L77 顺序执行 DSA attention 和 MoE；末层返回 branch/residual 给 final norm。',
      moe: '后 75 层的 FFN 输入分发到 top8 routed experts 与 shared expert，聚合结果回到本层 residual。',
      share: '读取当前 full 层写下的位置 IDs 并提供给对应 shared 层；没有将其他层 KV 当成本层 KV。',
      end: '读取 L77 的 FFN branch 与 residual，相加后 RMSNorm；normalized hidden 返回 runner。'
    },
    block: {
      h: '上一 block 的逻辑输出或 L0 embedding 是 h [T,6144]；同时送 Attention norm 和残差旁路。',
      norm1: '读取 h 与 input_layernorm 参数，输出 normalized h 给 Attention；运行时可同时合并前层延迟的 residual add。',
      attn: '读取 normalized h、positions、cache 与 TopK，生成 attn_out [T,6144] 给第一处 residual add。',
      add1: '将 attn_out 与原 h 相加得到 r；r 一路去 FFN norm，另一路保留给第二次 residual add。',
      norm2: '读取 r 与 post_attention_layernorm 参数，得到 x [T,6144]，交给该层配置的 FFN。',
      dense: '仅早三层走 Dense FFN：x 经 SwiGLU 得 ffn_out [T,6144]，送至 residual 更新。',
      moe: '主干 L3–L77 使用 MoE（额外 MTP L78 也使用 MoE结构）；x 经路由专家与 shared 聚合后返回 FFN 分支输出。',
      add2: '数学上计算 r+ffn_out 交给下一层；实际 forward 返回两者，下一次 norm 或 final norm 才融合执行此加法。'
    },
    attention: {
      x: '本层 input RMSNorm 提供 x；runner 提供 positions。x 送 MLA 和 full-indexer 的 K/weight 投影。',
      mla: 'x 生成主 Q、KV latent 和 RoPE key；新 KV 写本层 cache，Q 送 attention，normalized q_c 另供 indexer。',
      index: 'full 层由 q_c 与 x 生成检索 Q/K/weights，从历史 index K 得 TopK IDs，交给主 attention 的 gather。',
      reuse: 'shared 层读取先前 full 层写入 buffer 的位置 IDs，交给本层 gather；并不执行另一次 indexer。',
      read: '将选中的历史位置 IDs 应用到当前层自己的 KV cache，得到当前 query 的可见历史表示。',
      attend: '读取本层 Q、选中 KV 与因果 metadata，softmax 后聚合 V，输出每个 head 的结果。',
      out: 'attention head 结果 [T,64,256] 经已加载 o_proj 回到 [T,6144]，交给本 block 的 residual add。'
    },
    mla: {
      x: '本 block 的 input RMSNorm 输出 x [T,6144]，送 Q A-proj 和 KV A-proj；权重来自 checkpoint。',
      pos: 'runner 提供每个当前 token 的 positions；RoPE 旋转 Q/K 的位置分量，不改变 token 顺序。',
      q: '由 x 得 q_c [T,2048]，RMSNorm 后升到 64×256，再拆 192 non-RoPE 与 64 RoPE；送本层 attention。',
      kv: '由 x 投影出 c_KV [T,512] 与 k_R [T,64]；c_KV 归一化，k_R 应用 RoPE，作为新历史记录写 cache。',
      cache: '已有本层 latent 记录由此前 forward 写入；本轮按 runner slot_mapping 追加记录，再供 TopK gather 读取。',
      ids: '来自本 full indexer 或前一 full 层共享 buffer 的位置 IDs [T,2048]；告诉 gather 从当前层取哪些记录。',
      expand: '按 IDs 取本层 latent；用 kv_b_proj 的权重表达 K/V 升维。decode 可通过权重吸收避免真实展开大张量。',
      attend: 'Q 与历史 K 的内容/位置分量共同产生分数；因果 softmax 权重聚合对应 V，交给输出投影。',
      output: '把每头 V 聚合结果 [T,64,256] 通过 o_proj 映射为 [T,6144]，交回 block residual 路径。'
    },
    indexer: {
      qc: '由本层 MLA A-proj 与 q_a_layernorm 产生 q_c [T,2048]；交给 indexer.wq_b。',
      x: '当前 block 的 normalized hidden x 与 runner positions；x 生成 index K/head weights，positions 供 index Q/K 的 RoPE。',
      iq: 'q_c 经 wq_b 形成 [T,32,128]，处理位置后送检索分数计算；不是主 Attention 的 64 个 Q heads。',
      kw: 'x 经 wk_weights_proj 同时得 index K [T,128] 与 head weights [T,32]；分别送 cache 和检索计算。',
      cache: '本 full 层保存已有 index K；当前 K 经 LayerNorm/RoPE/编码写入后，历史 K 供打分。',
      scores: '读取检索 Q、历史 index K、head weights 与因果 metadata，给允许的历史位置打分，供 TopK 排序。',
      top: '选择最多 2048 个有效历史位置，写入共享 buffer；本层及随后 shared 层的 sparse MLA 消费这些 IDs。'
    },
    indexsharing: {
      full: 'L2 的 normalized hidden/q_c 和自己的 index K cache 产生新的 TopK 位置 I₂，写到共享 buffer。',
      ids: '保存 L2 写下的 I₂ [T,2048]；L3、L4、L5 只读取这些整数位置，直到 L6 full 层更新选择。',
      own: 'Qₗ 来自各层自己的 hidden 投影，KVₗ 来自该层历次写入的 cache；提供给对应层 Attention，并非一份共享物理 KV。',
      l3: 'L3 使用 I₂、Q₃、KV₃ 计算 attn_out，交给 L3 residual/FFN；完整 block 输出随后才进入 L4。',
      l4: 'L4 使用 I₂、Q₄、KV₄，输出交给 L4 residual/FFN；完整 block 输出随后进入 L5。',
      l5: 'L5 使用 I₂、Q₅、KV₅，输出交给 L5 residual/FFN；L5 完整 block 的结果进入 L6。',
      l6: 'L6 用更深的 hidden/q_c 与自己的 index K 历史重新检索，写 I₆，供 L6–L9 使用。'
    },
    moe: {
      x: '本层 FFN RMSNorm 产生 x [T,6144]；同一个 x 同时送 router、选中的 routed experts 与 shared expert。',
      route: '用已加载 gate 权重得到 FP32 logits [T,256]，sigmoid 得原分数，交给 top8 选择。',
      shared: '对每个 token 的 x 执行独立 shared SwiGLU，输出 [T,6144] 直接送总和，不使用 routed top8 权重。',
      select: '以 sigmoid 分数加 correction bias 选专家；从原分数提取并归一化 top8，再乘2.5，产生 IDs/weights [T,8]。',
      experts: '两类输入都必需：x 是待计算特征，IDs/weights 指定专家和贡献；所选专家各输出 [T,6144]，交给加权聚合。',
      sum: '对 8 个 routed 输出用已含 2.5 的 scaled weights 求和，再加 shared 输出；交给本层 residual 更新。'
    },
    dense: {
      x: 'Dense 输入来自 FFN norm；expert 输入来自 MoE 分发；两者都是 hidden=6144，分别使用自己的加载权重。',
      gate: 'x 乘本模块 W_gate 得 gate [T,I]，交给 SiLU；I 是 Dense 12288 或单专家2048。',
      up: '同一 x 乘 W_up 得 up [T,I]，保留给门控逐元素乘法。',
      silu: '对 gate 应用 SiLU，输出 [T,I] 与 up 逐元素相乘。',
      mul: '逐元素计算 SiLU(gate)×up，输出 [T,I] 给 down projection；不在 token 轴做归约。',
      down: '加载的 W_down 将 [T,I] 变回 [T,6144]；Dense 送 residual，expert 送 MoE 聚合。'
    },
    head: {
      branch: 'L77 的 MoE 分支输出 [T,6144]；尚未加回 residual，送 final fused add/norm。',
      residual: 'L77 Attention residual 更新后保留的 [T,6144]；与最后 MoE 输出一起交给 final norm。',
      norm: '读取 branch、residual 与加载的 RMSNorm 参数，相加再归一化；作为主 forward 的返回值交给 runner。',
      select: 'runner 按请求需要的输出位置选取 hidden 行；产生 [N,6144] 供 compute_logits，N 不必等于 T。',
      head: '选中的 hidden 乘独立 LM head 权重，经 LogitsProcessor 得 [N,154880]，送 sampler。',
      sampler: '运行时依据 logits 和采样参数产生 token IDs；更新请求输出与后续模型输入，采样不在模型 forward 内。'
    },
    mtp: {
      h: 'proposer 传入主模型 hidden 或前一 draft 的 post-norm hidden；hnorm 归一化为与 token embedding 融合的输入。',
      token: 'proposer 给出 token IDs 或 embedding；draft embedding 查表后经 enorm，交给拼接。',
      merge: '拼接 normalized token embedding 与 normalized previous hidden 得 [T,12288]，eh_proj 投影回 [T,6144]。',
      draft: '额外 L78 predictor block 使用自己的 attention cache 与 MoE，返回 branch/residual 给 draft final norm。',
      norm: '合并 branch/residual 并 RMSNorm；hidden 送 draft LM head 得 logits，同时可作为下一 draft step 的 previous_hidden。',
      verify: 'proposer 将候选 tokens 提交主模型执行验证，运行时决定接受/拒绝；只有接受的结果进入正式请求输出。'
    }
  };
  for (const [id, component] of Object.entries(model.components)) {
    [component.inputs, component.outputs] = io[id];
    component.notes.push('投影、归一化、router 与专家参数由 checkpoint 加载提供；图只画影响本次数据流的权重来源，不把每个固定权重矩阵重复画在主图中。');
    for (const node of component.nodes) node.description = actions[id][node.id];
  }
  model.components.indexer.edges.push(e('x', 'iq', 'positions → index Q RoPE', 1));
  model.components.block.nodes.find(node => node.id === 'moe').label = 'L≥3：MoE';
  model.components.block.notes.push('可选 MTP 的额外 L78 也复用此 block 类，并走 MoE 分支；它不属于主干 78 层。');
})();
