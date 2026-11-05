/* DeepSeek-V4-Pro, not DeepSeek-V4.1: checkpoint facts and Ascend forward. */
(() => {
  const n = (id, label, detail, kind, col, row, target, description, extra = {}) =>
    ({ id, label, detail, kind, col, row, ...(target ? { target } : {}), description, ...extra });
  const e = (from, to, label, step, optional = false) => ({ from, to, label, step, ...(optional ? { optional: true } : {}) });
  const s = (title, text, focus) => ({ title, text, focus });
  const rev = '94e3e25f836d79b5ee5c1aed257999ee61d10875';
  const hf = 'b5968e9190ef611bbf34a7229255be88a0e937c1';
  const gh = (path, line) => `https://github.com/vllm-project/vllm-ascend/blob/${rev}/${path}#L${line}`;
  const modelFile = 'vllm_ascend/models/deepseek_v4/model.py';
  const attnFile = 'vllm_ascend/attention/dsa_v1.py';
  window.ARCH_MODELS.deepseek_v4_pro = {
    id: 'deepseek_v4_pro',
    name: 'DeepSeek V4 Pro',
    subtitle: '61 层 · 4 路 mHC · C4 CSA / C128 HCA · 每层独立缓存',
    summary: '沿 Ascend forward 看 V4 Pro：文本 embedding 展为四路 residual，61 层各执行 mHC 包裹的混合注意力与 MoE，最后由学习到的 hc_head 折叠四路。CSA 在四倍压缩历史上检索，HCA 读取全部可见的 128 倍压缩历史，两者都保留 128-token 滑窗。',
    checked: '2026-11-05',
    revision: `官方 HF ${hf.slice(0, 8)} · Ascend ${rev.slice(0, 8)} · 静态源码分析`,
    stats: [
      { label: '主干 / hidden', value: '61 层 / 7168' },
      { label: 'Attention 类型', value: '30 CSA(C4) + 31 HCA(C128)' },
      { label: '残差 / Attention heads', value: '4 路 / 128 × 512' },
      { label: 'Routed / shared', value: '384 选 6 + 1 shared' },
      { label: '局部 / 稀疏历史', value: 'SWA 128 / CSA Top1024' },
      { label: '配置最大位置', value: '1,048,576 tokens' }
    ],
    sources: [
      { id: 'config', label: '官方 DeepSeek-V4-Pro config：维度与 62 项 compress_ratios', url: `https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/${hf}/config.json` },
      { id: 'card', label: '官方模型卡：CSA/HCA、mHC 与 Pro 版本', url: `https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/${hf}/README.md` },
      { id: 'reference', label: '官方 inference/model.py：Compressor、Indexer、Gate、Block 数学语义', url: `https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/${hf}/inference/model.py` },
      { id: 'forward', label: 'Ascend DeepseekV4Model.forward：908–998', url: gh(modelFile, 908), local: `E:/code/vllm-ascend/${modelFile}:908` },
      { id: 'block', label: 'Ascend 单层 forward：各 sublayer 独立 hc_pre/hc_post', url: gh(modelFile, 743), local: `E:/code/vllm-ascend/${modelFile}:743` },
      { id: 'attention', label: 'Attention 构造：Q/KV、分组输出、C4/C128 与独立 cache', url: gh(modelFile, 462), local: `E:/code/vllm-ascend/${modelFile}:462` },
      { id: 'prolog', label: 'Ascend Attention prolog：Q 低秩、Norm、RoPE 与窗口 KV', url: gh(attnFile, 1938), local: `E:/code/vllm-ascend/${attnFile}:1938` },
      { id: 'cache', label: 'C4 更新压缩 cache + TopK；C128 只更新 cache', url: gh(attnFile, 2165), local: `E:/code/vllm-ascend/${attnFile}:2165` },
      { id: 'attend', label: 'Attention 调用：窗口 KV、压缩 KV、sink 与索引', url: gh(attnFile, 2321), local: `E:/code/vllm-ascend/${attnFile}:2321` },
      { id: 'output', label: 'Attention 输出：inverse RoPE 后分组 wo_a/wo_b', url: gh(attnFile, 1910), local: `E:/code/vllm-ascend/${attnFile}:1910` },
      { id: 'compressor', label: 'Compressor：独立 wkv/wgate、C4 overlap、持久 state', url: gh('vllm_ascend/models/deepseek_v4/compressor.py', 97), local: 'E:/code/vllm-ascend/vllm_ascend/models/deepseek_v4/compressor.py:97' },
      { id: 'indexer', label: 'C4 Indexer：独立 128 维 Compressor 与 index K cache', url: gh('vllm_ascend/models/deepseek_v4/indexer.py', 289), local: 'E:/code/vllm-ascend/vllm_ascend/models/deepseek_v4/indexer.py:289' },
      { id: 'moe', label: 'MoE：前 3 层 tid2eid、打分路由与 shared expert', url: gh(modelFile, 267), local: `E:/code/vllm-ascend/${modelFile}:267` },
      { id: 'expert', label: 'SwiGLU expert：gate/up、clamp 与 down', url: gh(modelFile, 218), local: `E:/code/vllm-ascend/${modelFile}:218` },
      { id: 'head', label: 'hc_head：学习到的四路加权和', url: gh(modelFile, 899), local: `E:/code/vllm-ascend/${modelFile}:899` },
      { id: 'logits', label: 'wrapper.forward 与 compute_logits 分离', url: gh(modelFile, 1094), local: `E:/code/vllm-ascend/${modelFile}:1094` },
      { id: 'mtp', label: 'MTP：token embedding + 完整 HC hidden，独立 draft block', url: gh('vllm_ascend/models/deepseek_v4/mtp.py', 62), local: 'E:/code/vllm-ascend/vllm_ascend/models/deepseek_v4/mtp.py:62' },
      { id: 'mtphead', label: 'MTP compute_logits：先 hc_head 再 norm/head', url: gh('vllm_ascend/models/deepseek_v4/mtp.py', 225), local: 'E:/code/vllm-ascend/vllm_ascend/models/deepseek_v4/mtp.py:225' }
    ],
    root: 'overview',
    components: {
      overview: {
        title: 'DeepSeek V4 Pro 整体 forward',
        intro: ['用本轮 T=8 个 flattened tokens 追踪 hidden；S 表示各请求已经可见的历史长度。形状为未按 TP/EP 切分的逻辑形状。', 'V4 Pro 是 61 层统一 Decoder。这里没有 V4.1 的 Causal Encoder-Decoder 切分、Engram 或 L20 跨层 KV 共享。'],
        inputs: 'runner 提供 input_ids [T]、positions [T]、分页 metadata、每层已有 SWA/compressed cache；可选 inputs_embeds [T,7168]。',
        outputs: 'model.forward → runner：normalized hidden [T,7168]；compute_logits → sampler：logits [N,129280]；可选 MTP 获取 pre-hc_head 四路 hidden。',
        notes: ['本页核对官方 DeepSeek-V4-Pro checkpoint，不是 V4-Flash 或 V4.1-Flash。', '源码检查没有执行模型/NPU，也不将动画或缓存逻辑形状作为性能与实际字节数证明。'],
        sources: ['config', 'card', 'forward', 'logits', 'mtp'],
        nodes: [
          n('embed', 'Token → 四路 residual', '[8] → [8,4,7168]', 'tokens', 0, 0, 'embedding', 'runner 的 token IDs 查 embedding [T,7168]，再复制成四路 [T,4,7168]，作为 L0 输入。'),
          n('state', '每层的历史与位置', 'positions / SWA / compressed KV', 'cache', 1, 0, 'attention', 'runner 提供 positions 与 cache metadata；每层读取并追加自己先前保留的窗口 KV、压缩 KV 和 compressor state。'),
          n('stack', '61 个 mHC block', 'CSA/HCA + MoE', 'stack', 0, 1, 'stack', 'L0–L60 顺序更新四路 residual；每层内部执行 Attention 和 MoE，最后输出交给 hc_head。'),
          n('route', '前 3 层 hash routing', 'input_ids → 6 个专家 IDs', 'hash', 1, 1, 'hashroute', '原始 token IDs 在 L0–L2 查询 checkpoint 的 tid2eid；这些 IDs 和 hidden 产生的权重一起驱动本层 MoE。'),
          n('head', 'hc_head → norm → head', '四路折叠；hidden → logits', 'logits', 0, 2, 'head', '最终四路 hidden 经学习到的 hc_head 折叠及 RMSNorm 返回 runner；runner 另调用 LM head 算词表 logits。'),
          n('mtp', '可选 MTP 草稿', '完整 HC hidden + token embedding', 'draft', 1, 2, 'mtp', 'proposer 读取最后一层的 pre-hc_head hidden [T,28672] 和 token embedding，进入独立 predictor，候选仍需主模型验证。'),
          n('sample', '外部 sampler', 'logits → token → 后续输入', 'sample', 0, 3, 'head', 'sampler 根据 logits 及采样配置决定 token；更新请求输出，token 供下一轮 decode 或 MTP 使用。')
        ],
        edges: [e('embed', 'stack', 'H [8,4,7168]', 2), e('state', 'stack', 'positions / 各层 cache', 2), e('embed', 'route', '保留 raw input_ids', 2), e('route', 'stack', 'L0–L2 expert IDs', 2), e('stack', 'head', '最终四路 H', 3), e('head', 'sample', '词表 logits', 4), e('stack', 'mtp', 'pre-hc_head H', 5, true), e('sample', 'mtp', '候选起点 token', 5, true)],
        steps: [s('构造四路输入', 'embedding 后复制四路 residual；raw token IDs 继续保留给前 3 层 hash routing。', ['embed']), s('运行 61 层', '逐层读取本层历史，执行 mHC Attention 与 MoE；每层压缩率由配置固定。', ['stack', 'state', 'route']), s('折叠并返回表征', 'hc_head 对最终四路作学习到的加权和，再 final RMSNorm；forward 返回 hidden。', ['head']), s('输出 token', 'runner 计算所需位置的 logits，sampler 生成正式 token。', ['sample']), s('可选草稿分支', '启用 MTP 时把 pre-hc_head 四路 hidden 与 token 信息交给 predictor，候选经验证才输出。', ['mtp'])]
      },
      embedding: {
        title: 'Embedding 与四路 residual 初始化', parent: 'overview',
        intro: ['词表 129280，hidden 7168。每个 token 的 embedding 被复制 4 份；初始四路数值相同，随后每个 mHC 子层会重新混合并更新它们。'],
        inputs: 'runner 的 input_ids [T] 或 inputs_embeds [T,7168]；checkpoint 的 embedding 参数 [129280,7168]。',
        outputs: 'L0 接收 H [T,4,7168]；raw input_ids [T] 同时供 L0–L2 MoE 的 hash routing 使用。',
        notes: ['四路是每个 token 的 residual stream 轴，不是 4 个 token、4 个 attention heads 或 4 个设备。', 'tie_word_embeddings=false：embedding 与 LM head 是独立参数。'], sources: ['config', 'forward', 'moe'],
        nodes: [n('ids', 'Token IDs', 't0 … t7', 'tokens', 0, 0, null, 'runner 提供本轮 token IDs，分别送 embedding 查表和前 3 层路由。'), n('table', 'Embedding 权重', '[129280,7168]', 'state', 1, 0, null, 'checkpoint 加载的 token 向量表；每个 ID 对应一行7168维向量。'), n('lookup', '查表或接收 embedding', 'h [8,7168]', 'gather', 0, 1, null, '根据 IDs 从表中取行，或使用调用方的 inputs_embeds，生成本轮 h。'), n('expand', '复制为 4 路', 'H [8,4,7168]', 'streams', 0, 2, 'mhc', '将每个 h 沿新增 stream 轴复制4次；该 H 进入 L0 Attention 的 hc_pre。', { streamCount: 4 }), n('hash', '保留原始 IDs', 'L0–L2 tid2eid lookup', 'hash', 1, 2, 'hashroute', '不从 embedding 反推 ID，直接把原始 input_ids 传到 hash MoE，得到该 token 的专家列表。')],
        edges: [e('ids', 'lookup', '行索引', 1), e('table', 'lookup', 'embedding 行', 1), e('lookup', 'expand', 'h [8,7168]', 2), e('ids', 'hash', 'raw input_ids', 3)],
        steps: [s('读取 token 向量', 'input_ids 选择 embedding 行，得到 [8,7168]。', ['ids', 'table', 'lookup']), s('初始化 streams', '复制得到 [8,4,7168]，不改变 token 轴。', ['expand']), s('保留路由输入', '前 3 个 block 还需要整数 token IDs 查询专家映射。', ['hash'])]
      },
      stack: {
        title: '61 层：30 个 CSA，31 个 HCA', parent: 'overview',
        intro: ['主干 compress_ratios 的前 61 项：L0、L1 为 C128；从 L2 起偶数层为 C4、奇数层为 C128，最后 L60 是 C4。每层都是 MoE block。', '注意力模式按层固定。C4/C128 是同一模型的两类层，不是请求到来时随机选择的运行模式。'],
        inputs: 'embedding 的 H [T,4,7168]；runner 的 positions/cache；前3层使用 raw input_ids。', outputs: 'L60 后 H [T,4,7168] → hc_head；可选 pre-hc_head buffer [T,28672] → MTP proposer。',
        notes: ['主干之外的 compress_ratios[61]=0 属于额外 MTP，不能算进 61 个主干层。', '61 层都有各自的压缩 KV 和窗口 KV；没有从某个固定源层给其他所有层共享 KV。', '本地可选 aux_hidden_states 在 layer() 返回后取四路 mean；这不是 V4.1 的层入口采集，也不是主输出的 hc_head。'], sources: ['config', 'forward', 'attention'],
        nodes: [n('start', '输入四路 H', '[8,4,7168]', 'streams', 0, 0, 'embedding', 'embedding 初始化 H 或上一 PP stage 传来的 H，交给当前 stage 第一层。', { streamCount: 4 }), n('first', 'L0、L1：HCA', 'C128 + hash-routed MoE', 'stack', 0, 1, 'block', '这两层各运行窗口+重压缩历史 attention，再执行前3层特有的 hash MoE。'), n('csa', 'L2、4、…、60', '30 层 CSA / C4', 'stack', 0, 2, 'csa', '这些偶数层用各自 C4 压缩 cache 和 indexer 选 Top1024；L2 仍属 hash routing，后续使用 score routing。'), n('hca', 'L3、5、…、59', '29 层 HCA / C128', 'stack', 1, 2, 'hca', '这些奇数层读取本层全部可见 C128 压缩历史；与 CSA 层按真实层号交错执行。'), n('end', 'L60 输出 H', '四路 residual 保持完整', 'streams', 0, 3, 'head', '所有主干层处理后仍为 [T,4,7168]，送 hc_head；若启用 MTP则同时保存展平版本。', { streamCount: 4 })],
        edges: [e('start', 'first', 'H', 1), e('first', 'csa', 'L1→L2 的 H', 2), e('csa', 'hca', 'L2→3、L4→5…', 2), e('hca', 'csa', 'L3→4、L5→6…', 2), e('csa', 'end', '最后 L60 的 H', 3)],
        steps: [s('先运行两个 HCA 层', 'L0 和 L1 均采用 C128；输入输出保持四路 hidden。', ['start', 'first']), s('按层交错', 'L2 起 CSA 和 HCA 交替；两类节点代表层集合，双向边表示相邻层交接，不是循环回跑同一层。', ['csa', 'hca']), s('结束于 L60', '最后一层 CSA 完成后，四路 H 交给 hc_head；主干总数为61。', ['end'])]
      },
      block: {
        title: '单层：两组独立的 mHC 包裹', parent: 'stack',
        intro: ['本层先运行 Attention 的 hc_pre → norm → attention → hc_post，再运行 FFN 的 hc_pre → norm → MoE → hc_post。两次 hc_pre 都从当时的完整四路 residual 计算本子层的系数。'],
        inputs: '上一层 H [T,4,7168]；positions/cache metadata；raw input_ids [T]（hash层）。', outputs: '新的 H [T,4,7168] → 下一层；末层则交给 hc_head。',
        notes: ['V4 不传递 V4.1 delayed pre_mix：当前子层自己生成 pre、post、comb。', '残差旁路保留四路原值，不能用一个普通 h+x 加法代替 mHC 混合。'], sources: ['block', 'reference'],
        nodes: [n('h', '输入四路 residual', 'H [8,4,7168]', 'streams', 0, 0, 'mhc', '上一 block 输出 H；一份供 Attention hc_pre 计算，一份留作 hc_post residual。', { streamCount: 4 }), n('apre', 'Attention hc_pre + norm', '4路 → x [8,7168]', 'gather', 0, 1, 'mhc', '读取H和本层hc_attn参数，产生x与post/comb；RMSNorm(x)送Attention。'), n('attn', '本层 CSA 或 HCA', '读取窗口与本层压缩历史', 'attention', 0, 2, 'attention', '本层归一化x与位置/cache共同产生attn_out [T,7168]，交给Attention hc_post。'), n('apost', 'Attention hc_post', '得到 H′ [8,4,7168]', 'sum', 0, 3, 'mhc', '读取Attention输出、原H与该hc_pre的post/comb；混合残差并将输出写回四路。'), n('fpre', 'FFN hc_pre + norm', '从 H′ 重新计算系数', 'gather', 0, 4, 'mhc', '读取更新后的H′和独立hc_ffn参数，产生FFN输入x及新的post/comb；norm同时准备FP32 router输入。'), n('ids', 'Raw token IDs', '前3层 hash MoE 的输入', 'tokens', 1, 4, 'hashroute', '来自runner且保持与T轴对齐的input_ids；在hash层决定专家IDs，不代替hidden特征。'), n('moe', 'MoE', '6 routed + 1 shared', 'experts', 0, 5, 'moe', 'normalized x以及必要的token IDs进入MoE，汇总输出[T,7168]送FFN hc_post。', { expertCount: 384, selectedExperts: 6 }), n('fpost', 'FFN hc_post', '得到下一层四路 H', 'sum', 0, 6, 'mhc', '用FFN post/comb把moe_out与H′组合为新H [T,4,7168]，交给下一层。')],
        edges: [e('h', 'apre', 'H', 1), e('apre', 'attn', 'normalized x', 2), e('apre', 'apost', 'Attention post/comb', 3), e('h', 'apost', 'residual H', 3), e('attn', 'apost', 'attn_out', 3), e('apost', 'fpre', 'H′', 4), e('fpre', 'moe', 'x / FP32 router x', 5), e('ids', 'moe', 'input_ids', 5), e('fpre', 'fpost', 'FFN post/comb', 6), e('apost', 'fpost', 'residual H′', 6), e('moe', 'fpost', 'moe_out', 6)],
        steps: [s('汇合四路', 'Attention hc_pre 由H生成本子层系数与单路输入，随后RMSNorm。', ['h', 'apre']), s('执行 attention', 'CSA或HCA读取本层历史，输出单路hidden。', ['attn']), s('写回四路', 'Attention post/comb同时消费原H和attention输出，得到H′。', ['apost']), s('重新生成 FFN 系数', 'FFN hc_pre读取H′，使用另一套参数独立计算混合系数。', ['fpre']), s('运行 MoE', 'MoE读取hidden与hash层所需IDs，产生单路结果。', ['ids', 'moe']), s('完成本层', 'FFN hc_post用新的post/comb和H′生成下一层四路H。', ['fpost'])]
      },
      mhc: {
        title: 'mHC：四路怎样汇合、计算、再写回', parent: 'block',
        intro: ['每个 token 的 H 有4行、每行7168维。当前子层用展平的四路状态生成 pre[4]、post[4]、comb[4,4]：pre把四路汇合成计算输入，post把模块输出分配回四路，comb混合原四路残差。', 'comb 经过20次 Sinkhorn 迭代约束为近似双随机矩阵；这是残差混合矩阵的约束，不是把 pre 简单当作均值。'],
        inputs: '来自上一子层的 H [T,4,7168]；checkpoint 的本子层 hc_fn、hc_scale、hc_base 参数。', outputs: '模块输入 x [T,7168]；模块算出的 y 与 H/post/comb 生成 H_next [T,4,7168]，交给下一子层。',
        notes: ['Attention和MoE各自持有一套mHC参数，并各自基于当前H计算系数。', '图中的4路加权/残差混合是算法语义；Ascend用npu_hc_pre_v2与npu_hc_post融合执行。'], sources: ['config', 'block', 'reference'],
        nodes: [n('h', '4 路当前 H', '[8,4,7168]', 'streams', 0, 0, null, '上一子层的四路H同时供系数计算、pre加权汇合和residual混合读取。', { streamCount: 4 }), n('params', '本子层 mHC 参数', 'hc_fn / scale / base', 'state', 1, 0, null, 'checkpoint加载的参数与当前H一起产生动态mixes；Attention与FFN使用不同参数。'), n('coeff', '生成 pre/post/comb', 'comb 做20次Sinkhorn', 'router', 0, 1, null, '归一化展平H后线性投影并用base/scale变换，得到pre、post以及经过Sinkhorn的comb。'), n('collapse', 'pre 加权汇合', '[8,4,7168] → [8,7168]', 'gather', 0, 2, null, '用本次pre对4行H加权求和为x，送RMSNorm及Attention或MoE。'), n('module', 'Norm → 子模块', 'Attention 或 MoE；输出 y', 'attention', 0, 3, 'block', '单路x经过对应norm和模块，得到单路y [T,7168]，回到hc_post。'), n('resmix', 'comb 混合残差', '4×4 作用于原 H', 'streams', 1, 3, null, 'comb在stream轴混合原H，保留四路结构；此结果与post写回的y相加。', { streamCount: 4 }), n('write', 'post 写回再相加', 'H_next [8,4,7168]', 'sum', 0, 4, null, '按post为每路分配y，再加comb混合后的原H，所得H_next成为下一子层输入。')],
        edges: [e('h', 'coeff', 'flatten(H)', 1), e('params', 'coeff', '加载的mHC参数', 1), e('coeff', 'collapse', 'pre [T,4]', 2), e('h', 'collapse', '原H', 2), e('collapse', 'module', 'x [T,7168]', 3), e('h', 'resmix', '原H', 3), e('coeff', 'resmix', 'comb [T,4,4]', 3), e('module', 'write', 'y [T,7168]', 4), e('coeff', 'write', 'post [T,4]', 4), e('resmix', 'write', '混合残差', 4)],
        steps: [s('从当前状态算系数', 'H与当前子层参数生成pre/post/comb，comb经Sinkhorn约束。', ['h', 'params', 'coeff']), s('形成单路输入', 'pre对四路H加权求和，生成模块可处理的[T,7168]。', ['collapse']), s('模块计算与残差混合', '模块处理x；comb同时定义原四路H怎样混合，二者是数据依赖分支。', ['module', 'resmix']), s('回到四路', 'post把单路y分配回四路，与comb混合残差相加。', ['write'])]
      },
      attention: {
        title: 'Attention 主线：窗口 + 压缩历史', parent: 'block',
        intro: ['输入是mHC汇合并RMSNorm后的x [T,7168]。Q走1536维低秩再展开到128×512；窗口KV每token是一条512维共享向量。', 'C4或C128 compressor另从x产生长历史表示；它不是把已经投影好的窗口KV直接取平均。Attention后对末64维做inverse RoPE，再经分组低秩输出投影返回7168维。'],
        inputs: '本block的normalized x [T,7168]；runner positions/metadata；本层SWA与compressed cache；加载的attn_sink。', outputs: 'attn_out [T,7168] → 本层Attention hc_post；更新后的本层cache → 后续query。',
        notes: ['C4层走CSA，C128层走HCA，主干每层独立拥有这些状态。', 'wo_a把128个head分成16组，每组8×512维降到1024；wo_b把16×1024映射到7168。'], sources: ['config', 'attention', 'prolog', 'attend', 'output'],
        nodes: [n('x', '归一化 x', '[8,7168]', 'streams', 0, 0, null, 'Attention hc_pre+RMSNorm产生x，同时供Q、窗口KV与本层compressor/indexer读取。'), n('meta', '位置与 cache metadata', 'positions / slot / causal lengths', 'state', 1, 0, null, 'runner提供positions、cache写入槽位与可见历史范围；这些控制数据指导RoPE、写缓存和因果选择。'), n('q', 'Q 低秩投影', '1536 → [8,128,512]', 'attention', 0, 1, null, 'wq_a→q_norm得qr [T,1536]，wq_b升维后逐head RMS与RoPE，生成主Q；qr另供CSA indexer。'), n('win', '本层窗口 KV', 'wkv→norm→RoPE；SWA128', 'cache', 1, 1, null, 'x经本层wkv生成[T,512]，norm和RoPE后按slot写窗口cache；最多128个可见窗口token供attention。'), n('csa', '本层若 C4：CSA', '压缩历史 Top1024', 'selection', 0, 2, 'csa', '从x更新本层C4 attention/indexer cache，用qr和x检索位置，得到被选的压缩历史。'), n('hca', '本层若 C128：HCA', '所有可见压缩块', 'cache', 1, 2, 'hca', '从x增量形成C128记录，读取所有已完成且因果可见的本层压缩历史，不运行TopK indexer。'), n('sink', '加载的 attention sink', '每个 Q head 一个参数', 'state', 1, 3, null, 'checkpoint的attn_sink [128]与Q/KV分数共同参与attention归一化；它不是额外用户token。'), n('attend', '联合 Attention', '窗口 + 选定压缩记录', 'attention', 0, 3, null, '主Q同时读取窗口KV及CSA/HCA提供的压缩记录，按causal约束和sink进行归一化聚合，输出[T,128,512]。'), n('o', 'inverse RoPE + 输出投影', '16组×1024 → [8,7168]', 'state', 0, 4, null, '对attention输出的位置分量去旋转，分组wo_a降维，再wo_b恢复hidden；结果交本层hc_post。')],
        edges: [e('x', 'q', 'x', 1), e('x', 'win', 'x', 1), e('meta', 'q', 'positions', 1), e('meta', 'win', 'positions / slots', 1), e('x', 'csa', 'x；仅C4', 2), e('q', 'csa', 'qr [T,1536]', 2), e('x', 'hca', 'x；仅C128', 2), e('q', 'attend', '主Q', 3), e('win', 'attend', '窗口KV', 3), e('csa', 'attend', '选中C4 KV', 3), e('hca', 'attend', '全部可见C128 KV', 3), e('sink', 'attend', 'attn_sink', 3), e('meta', 'attend', '因果可见范围', 3), e('attend', 'o', '128×512 的结果', 4)],
        steps: [s('生成当前 Q 与窗口 KV', '两路都来自本层x，RoPE读取positions；窗口KV写入本层cache。', ['x', 'meta', 'q', 'win']), s('按层配置准备长历史', 'CSA压缩并检索，HCA强压缩并读取全部可见压缩记录；两者是互斥层类型。', ['csa', 'hca']), s('窗口与长历史共同参与', '主Q读取窗口和所选压缩KV，结合因果metadata与learned sink完成attention。', ['attend', 'sink']), s('返回 hidden', 'inverse RoPE后按16组做wo_a，再wo_b回到7168维。', ['o'])]
      },
      csa: {
        title: 'CSA：C4 压缩后再选 Top1024', parent: 'attention',
        intro: ['CSA同时维护两套C4压缩历史：主attention用512维latent，indexer用独立128维key。二者由各自参数从同一x生成；共享的是压缩位置的对应关系，不是张量内容。', 'Indexer Q来自qr，64个head、每head128维；head权重来自x。Top1024挑的是压缩记录位置，而非1024个原始token。'],
        inputs: '本层normalized x [T,7168]、Q低秩qr [T,1536]、本层主KV/index K及compressor state、runner metadata。', outputs: 'TopK compressed IDs [T,1024] → 当前层attention；被选主compressed KV [≤1024,512]与窗口KV一起被读取。',
        notes: ['C4每完成4个新token产出一条压缩记录；overlap池化可同时使用前一组与当前组，不能理解为不重叠4token均值。', '官方配置未启用跨层IndexCache；本地hf-overrides可额外启用TopK复用，属于另一个运行配置，不能等同V4.1固定KV共享。'], sources: ['config', 'attention', 'indexer', 'cache', 'reference'],
        nodes: [n('x', '本层 x / qr', 'x [8,7168] · qr [8,1536]', 'streams', 0, 0, null, 'x由block的Attention norm产生，qr由本层wq_a/q_norm产生；分别供压缩器和检索Q读取。'), n('maincomp', '主 C4 Compressor', '每条512维；自己的state', 'gather', 0, 1, 'compressor', '主compressor从x与先前state形成512维C4记录，写当前层主compressed cache。'), n('idxcomp', 'Index C4 Compressor', '独立参数；每条128维', 'gather', 1, 1, 'compressor', 'indexer独立compressor从同一x生成128维key，处理RoPE/旋转编码后写index K cache；不复用主512维KV。'), n('maincache', '本层主压缩 KV', '[约S/4,512]', 'cache', 0, 2, null, '保存本层主compressor此前生成的记录与本轮新记录；TopK ID只决定读取其中哪些行。'), n('indexcache', '本层 Index K', '[约S/4,128]', 'cache', 1, 2, null, '本层indexer历史key由独立压缩器产生，参与检索打分，不直接作为主attention的V。'), n('query', 'Index Q 与权重', 'Q:64×128 · weights:64', 'attention', 1, 3, null, 'qr经indexer.wq_b产生Q并RoPE/旋转；x经weights_proj产生head权重，送历史评分。'), n('top', '检索 Top1024', '输出compressed位置 IDs', 'selection', 0, 3, null, '检索Q与index K匹配，经head加权及因果可见性筛选，选出最多1024个压缩位置。'), n('read', '按 IDs 读主 KV', '与 SWA128 一起送主Attention', 'gather', 0, 4, 'attention', '用compressed IDs读取本层512维主KV，与独立窗口KV共同交给主Q attention。')],
        edges: [e('x', 'maincomp', 'x', 1), e('x', 'idxcomp', 'x', 1), e('maincomp', 'maincache', '512维记录+slots', 1), e('idxcomp', 'indexcache', '128维key+slots', 1), e('x', 'query', 'qr与x', 2), e('query', 'top', 'index Q / weights', 3), e('indexcache', 'top', '历史index K', 3), e('top', 'read', '压缩位置 IDs', 4), e('maincache', 'read', '当前层主KV', 4)],
        steps: [s('更新两套压缩历史', '主512维cache与index128维cache各用独立compressor和state，从x增量生成。', ['maincomp', 'idxcomp', 'maincache', 'indexcache']), s('准备检索 Q', 'qr产生index Q，x产生head weights。', ['query']), s('选择压缩位置', 'Indexer在因果可见的index历史上评分，输出最多1024个compressed IDs。', ['top']), s('读取主表示', '相同位置IDs索引主512维compressed cache；其值与窗口KV一起交主attention。', ['read'])]
      },
      hca: {
        title: 'HCA：C128 强压缩，读全部可见块', parent: 'attention',
        intro: ['HCA以128个token为一个完成单位，形成一条512维压缩记录。压缩率足够大，因此不使用CSA的检索TopK：attention读取全部已完成、因果可见的本层压缩记录。', '本地每层仍保留独立SWA128窗口，覆盖当前附近的精细信息及尚未形成压缩记录的尾部。'],
        inputs: '本层normalized x [T,7168]；本层C128部分状态与已完成compressed KV；主Q、SWA窗口与causal metadata。', outputs: '全部可见C128 KV和SWA KV → 本层attention → [T,128,512]，随后输出投影。',
        notes: ['教学例：从空状态累计256个token，可形成2条C128记录；本轮若只有8个token，是否产生新记录取决于之前积累位置。', '“全部”指当前query可见的压缩记录，不包括未来块，也不指全部原始token。'], sources: ['config', 'cache', 'attend', 'compressor', 'reference'],
        nodes: [n('x', '当前 x', '[T,7168]', 'streams', 0, 0, null, '本层mHC+norm产生x，交给C128 compressor；不会读取别层hidden来生成本层cache。'), n('state', '之前未完成的块', 'KV / gate accumulator state', 'state', 1, 0, 'compressor', '本层compressor保存此前未形成完整128组的状态；本轮继续追加，供下一压缩边界消费。'), n('pool', 'C128 门控池化', '完成128 token → 1记录', 'gather', 0, 1, 'compressor', '结合当前x、之前state和加载参数，softmax门控池化；完成组输出512维记录，未完成部分继续保留。'), n('cache', '本层 HCA cache', '[floor(S/128),512]', 'cache', 0, 2, null, '保存本层已完成压缩记录；因果metadata决定当前query最多能读到哪一条。'), n('other', '本层主 Q 与 SWA', 'Q:128×512；窗口≤128', 'attention', 1, 2, 'attention', '当前Q来自本层x投影，窗口KV来自本层细粒度cache；与重压缩历史在同一次attention中汇合。'), n('attend', '读取所有可见压缩块', 'SWA + C128；无 TopK indexer', 'attention', 0, 3, 'attention', '主Q读取所有可见C128记录及窗口KV，结合sink/causal约束聚合；输出送inverse RoPE和wo_a/wo_b。')],
        edges: [e('x', 'pool', '当前token特征', 1), e('state', 'pool', '先前partial state', 1), e('pool', 'state', '保留未完成部分', 1), e('pool', 'cache', '新完成记录+slot', 2), e('cache', 'attend', '全部可见C128记录', 3), e('other', 'attend', 'Q / 窗口KV', 3)],
        steps: [s('持续积累', '当前x与以前未完成状态合并；每完成128token才形成新压缩记录。', ['x', 'state', 'pool']), s('追加本层cache', '新记录按compress slot写入本层HCA cache，供当前及后续可见query使用。', ['cache']), s('无需再做TopK', '读取全部因果可见压缩记录，与本层SWA窗口一起完成attention。', ['other', 'attend'])]
      },
      compressor: {
        title: 'Compressor：学习到的门控池化与跨步状态', parent: 'attention',
        intro: ['compressor直接读取本层normalized hidden x，用独立Wkv产生待汇总特征、Wgate产生分数，再加组内位置参数ape。沿压缩窗口对分数做softmax，以其加权求和特征。', '主compressor输出D=512；CSA的indexer compressor使用D=128。C4启用overlap，每4token产出一条记录，后续记录可结合前一组和当前组共8个位置；C128不重叠。'],
        inputs: '本层x [T,7168]；checkpoint的Wkv/Wgate/ape/norm；以前KV/score state；runner start_pos、分组边界、compress slots与RoPE metadata。', outputs: '新完成的M条compressed记录 [M,D]及slots → 对应主/index cache；未完成状态 → 本层state cache供下轮继续。',
        notes: ['M由本轮跨过的完成边界决定，不能无条件写成T/R。C4的输出密度1/4，不意味着每条只看4个位置。', 'compressor state保存部分组特征/分数；compressed KV cache保存可供attention读取的已完成记录，二者不同。', 'norm/RoPE及量化/旋转因主cache与index cache后端而异；图表示算法语义，实际由融合算子完成。'], sources: ['compressor', 'reference', 'cache', 'indexer'],
        nodes: [n('x', '本层 hidden x', '[T,7168]', 'streams', 0, 0, null, '来自本层Attention输入的x送独立Wkv/Wgate；不是将窗口KV直接平均。'), n('params', '加载的池化参数', 'Wkv / Wgate / ape', 'state', 1, 0, null, 'checkpoint提供内容投影、门控投影与组内位置偏置，供当前token生成特征和分数。'), n('project', '双投影', '候选特征 v；分数 g+ape', 'state', 0, 1, null, 'x分别经过Wkv和Wgate，加组内ape得到池化分数；C4为overlap保留两组通道。'), n('prior', '历史 partial state', 'kv_state / score_state', 'state', 1, 1, null, '此前forward保存的不完整组及C4前组状态，与本轮投影结果一起形成正确窗口。'), n('group', '按位置拼成窗口', 'C4可看8位置；C128看128', 'gather', 0, 2, null, 'start_pos与已保存state决定有效窗口；未完成组继续写state，仅完成边界产生记录。'), n('pool', 'softmax gate 加权和', '沿窗口位置归约 → [M,D]', 'sum', 0, 3, null, '对每个通道沿窗口位置softmax，然后加权求和候选特征；不是普通均值或token拼接。'), n('norm', 'Norm + RoPE / 编码', '[M,D]；主D512 / indexD128', 'state', 0, 4, null, '池化结果RMSNorm并按压缩位置处理RoPE；相应后端做必要旋转/量化，输出记录与slot。'), n('cache', '写对应的 cache', '主 KV 或 index K', 'cache', 0, 5, 'attention', '已完成记录写入本层主compressed KV或index K cache，分别供主attention或indexer消费。')],
        edges: [e('x', 'project', 'x', 1), e('params', 'project', '固定参数', 1), e('project', 'group', 'v / score', 2), e('prior', 'group', '先前state', 2), e('group', 'prior', '未完成/overlap状态', 2), e('group', 'pool', '完整有效窗口', 3), e('pool', 'norm', 'pooled [M,D]', 4), e('norm', 'cache', '记录与compress slots', 5)],
        steps: [s('生成内容与门控分数', 'Wkv(x)和Wgate(x)+ape提供两路输入。', ['x', 'params', 'project']), s('恢复连续窗口', '结合start_pos和历史partial state，正确处理跨chunk/跨decode步与C4 overlap。', ['prior', 'group']), s('沿位置做门控池化', 'softmax(score)对v加权求和；只有完成组输出一条记录。', ['pool']), s('规范化与位置对齐', '对压缩表示做norm/RoPE及后端要求的编码。', ['norm']), s('交给消费者', '写主cache供attention，或写独立index cache供检索；partial state另存供下一轮。', ['cache'])]
      },
      moe: {
        title: 'MoE：每层6个 routed + 1个 shared', parent: 'block',
        intro: ['所有61个主干block都使用MoE，没有“前三层Dense”的分支。前3层的特殊之处是专家IDs来自token映射；L3–L60通过内容分数选top6。', '384个routed expert，每token激活6个；一个shared expert始终处理该token。每个专家采用intermediate=3072的带clamp SwiGLU，输出回7168维。'],
        inputs: 'FFN hc_pre + RMSNorm提供x [T,7168]与FP32 router输入；hash层另收raw input_ids [T]；checkpoint提供gate、专家和路由表/偏置。', outputs: 'moe_out [T,7168] → 本层FFN hc_post；中间routing IDs/weights [T,6]指导专家计算与聚合。',
        notes: ['sqrtsoftplus评分：sqrt(softplus(logit))；选中原始分数归一化后应用scale=2.5。不同融合后端可把scale放在权重或输出，但只计一次。', '前3层hash routing不是Engram；没有n-gram记忆向量注入residual。'], sources: ['config', 'moe', 'expert', 'reference'],
        nodes: [n('x', 'FFN 输入 x', '[8,7168]；router用FP32', 'streams', 0, 0, null, 'FFN hc_pre与RMSNorm提供x；x并行进入gate、routed experts和shared expert。'), n('route', '专家 IDs 与权重', 'hash L0–2 / score L3–60', 'router', 0, 1, 'hashroute', '从hidden打分，并由层型选择tid2eid查表或加偏置top6；输出IDs和权重[T,6]。'), n('shared', 'Shared expert ×1', '7168→3072→7168', 'shared', 1, 1, null, '同一x经独立shared SwiGLU，输出[T,7168]直接送最终相加，不由top6选择。'), n('experts', '6 个 routed experts', '384 个逻辑专家中选6个', 'experts', 0, 2, null, 'IDs决定使用哪些已加载专家；每个专家读取x，执行gate/up投影、clamp、SiLU×up、down，输出给加权聚合。', { expertCount: 384, selectedExperts: 6 }), n('weighted', '按路由权重汇总', '2.5 × Σ normalized_wᵢEᵢ(x)', 'sum', 0, 3, null, '对6路专家结果按归一化权重汇总并施加2.5路由缩放；具体融合位置不改变此数学语义。'), n('sum', '加入 shared 输出', 'moe_out [8,7168]', 'sum', 0, 4, null, 'routed聚合结果加shared(x)，作为单路MoE结果送FFN hc_post，更新四路residual。')],
        edges: [e('x', 'route', 'FP32 x', 1), e('x', 'shared', 'x', 2), e('route', 'experts', 'expert IDs', 2), e('x', 'experts', '待计算的x', 2), e('experts', 'weighted', '各expert输出', 3), e('route', 'weighted', 'normalized weights', 3), e('weighted', 'sum', 'scaled routed sum', 4), e('shared', 'sum', 'shared output', 4)],
        steps: [s('产生路由', 'hidden产生权重分数，hash或score规则决定6个expert IDs。', ['x', 'route']), s('两类专家处理同一输入', 'routed experts接收x和IDs，shared expert始终处理x。', ['experts', 'shared']), s('汇总 routed 部分', '加权求和6路结果并施加2.5缩放，不重复缩放shared分支。', ['weighted']), s('返回单路结果', 'routed部分与shared部分相加，交给本层FFN hc_post。', ['sum'])]
      },
      hashroute: {
        title: 'Hash routing：IDs查表，权重仍来自hidden', parent: 'moe',
        intro: ['L0–L2的tid2eid表按原始token ID给出6个expert IDs，映射是checkpoint参数。相同token在同一层使用同一组专家；聚合权重仍随当前hidden变化。', 'L3–L60没有tid2eid，而是把sqrtsoftplus分数加校正bias后选top6；选路bias不直接进入最终权重。'],
        inputs: 'runner input_ids [T]；FFN normalized hidden x [T,7168]；本层加载的gate权重与tid2eid或bias。', outputs: 'expert IDs [T,6] → routed expert分发；normalized weights [T,6] → 聚合（路由scale=2.5计一次）。',
        notes: ['num_hash_layers=3描述专家选择，不是词表外的记忆数据库，也不是Engram n-gram检索。', '本地构造时token_to_expert=(ID+offset)%384只是dummy初始化；实际图表示加载checkpoint后的tid2eid，不能把dummy公式当成训练后的映射规则。'], sources: ['config', 'moe', 'reference'],
        nodes: [n('x', '当前 hidden x', '[8,7168]', 'streams', 0, 0, null, 'FFN norm提供x，以FP32送gate线性层，产生当前内容相关的384个分数。'), n('ids', '原始 token IDs', '[8]；来自runner', 'tokens', 1, 0, null, '原始input_ids保持与hidden行对应，L0–L2用它查询每层自己的tid2eid。'), n('score', 'Gate → sqrtsoftplus', '分数 [8,384]', 'router', 0, 1, null, 'gate(x)产生logits，sqrt(softplus(logits))得原始正分数；用于选路或提取最终权重。'), n('table', 'L0–2：tid2eid 查表', '表[129280,6] → IDs[8,6]', 'hash', 1, 1, null, '从checkpoint加载的tid2eid按token ID读取6个expert IDs；不在hidden上做top6选择。'), n('top', 'L3–60：加bias选top6', '原分数 + correction bias', 'selection', 0, 2, null, '内容路由层用加bias后的分数选6个IDs；原始未加bias分数留给权重计算。'), n('weight', 'Gather 原分数并归一化', '[8,6] 权重', 'gather', 0, 3, null, '使用查表或top6得来的IDs，从原始分数gather 6项，按行归一化；路由缩放在聚合中体现。'), n('out', '分发与聚合的控制信息', 'IDs + normalized weights', 'scatter', 0, 4, 'moe', 'IDs指导x去哪几个专家，weights指导专家输出怎样合并；实际特征x由MoE输入另一路直接提供。')],
        edges: [e('x', 'score', 'FP32 hidden', 1), e('ids', 'table', 'token ID索引', 2), e('score', 'top', '分数；仅score层', 2), e('table', 'weight', 'hash expert IDs', 3), e('top', 'weight', 'score expert IDs', 3), e('score', 'weight', '未加bias的原分数', 3), e('weight', 'out', 'IDs / normalized weights', 4)],
        steps: [s('所有层都计算内容分数', 'x通过gate和sqrtsoftplus，得到384个原始分数。', ['x', 'score']), s('按层规则选IDs', 'L0–L2从tid2eid查6个IDs，L3–L60按分数+bias选top6；两条互斥分支。', ['ids', 'table', 'top']), s('从原分数定权', '用选中的IDs提取原分数并归一化；hash层权重仍依赖当前hidden。', ['weight']), s('交给MoE', 'IDs和weights控制特征分发及输出加权，专家另收真正的hidden x。', ['out'])]
      },
      head: {
        title: 'hc_head 折叠、final norm 与 LM head', parent: 'overview',
        intro: ['hc_head读取L60完成后的4路H，展平并归一化后计算4个动态系数，再对原4路作加权和。之后才final RMSNorm并返回hidden。', '这不是简单mean，也不是V4.1使用上一个ffn_pre的hc_collapse。V4的hc_head有自己加载的fn/scale/base参数。'],
        inputs: 'L60的H [T,4,7168]；checkpoint hc_head参数、norm与独立LM head [129280,7168]。', outputs: 'normalized hidden [T,7168] → runner；selected hidden [N,7168] → compute_logits；logits [N,129280] → sampler。',
        notes: ['最终head使用learned weights，aux采集才可能在层后取mean。二者目的和数值不同。', 'MTP需要的完整四路buffer在hc_head前保存，不能用这里折叠后的hidden替代。'], sources: ['head', 'forward', 'logits', 'config'],
        nodes: [n('h', '最终四路 H', '[8,4,7168]', 'streams', 0, 0, null, 'L60 hc_post输出完整H，分别送hc_head系数计算、四路加权和及可选MTP保存。', { streamCount: 4 }), n('params', 'hc_head 参数', 'fn / scale / base', 'state', 1, 0, null, 'checkpoint加载的独立head参数把归一化flatten(H)转换为4个动态折叠系数。'), n('coeff', '计算折叠系数', 'sigmoid(mixes×scale+base)+ε', 'router', 0, 1, null, 'flatten(H)归一化后经hc_head_fn投影，scale/base和sigmoid得[T,4]系数，供加权和使用。'), n('collapse', '对原四路加权求和', '[8,4,7168] → [8,7168]', 'sum', 0, 2, null, '系数乘原H并沿stream轴求和，得到单路hidden；再送模型final RMSNorm。'), n('norm', 'Final RMSNorm', 'forward 返回 [T,7168]', 'state', 0, 3, null, '对折叠hidden应用final norm，返回runner；此时尚无词表分数或采样token。'), n('lm', '选位置 → LM head', '[N,7168] → [N,129280]', 'logits', 0, 4, null, 'runner选择要计算输出的位置，compute_logits使用独立lm_head和LogitsProcessor得logits。'), n('sample', '外部 sampler', 'logits → 新 token', 'sample', 0, 5, null, '运行时根据logits采样并更新请求，token成为后续decode输入；不在model.forward内执行。')],
        edges: [e('h', 'coeff', 'flatten(H)', 1), e('params', 'coeff', 'head参数', 1), e('coeff', 'collapse', '系数 [T,4]', 2), e('h', 'collapse', '原H', 2), e('collapse', 'norm', '单路hidden', 3), e('norm', 'lm', '返回hidden并选行', 4), e('lm', 'sample', 'logits', 5)],
        steps: [s('学习到的折叠系数', 'H与head参数共同生成4个动态系数。', ['h', 'params', 'coeff']), s('折叠streams', '对原四路H加权求和；不是简单平均。', ['collapse']), s('返回模型表征', 'final norm之后，forward把[T,7168]交回runner。', ['norm']), s('计算词表分数', '选中的N行hidden经LM head变成词表logits。', ['lm']), s('消费logits', 'sampler决定token并更新输出/下一轮输入。', ['sample'])]
      },
      mtp: {
        title: '可选 MTP：保留完整四路的 predictor', parent: 'overview',
        intro: ['checkpoint额外提供1个next-token predictor。它接收主模型hc_head之前的四路状态，而不是主LM head输出。Token embedding与previous HC hidden分别归一化、投影，然后相加形成draft四路输入。', 'compress_ratios末项0用于该predictor：它使用SWA-only attention，没有主干C4/C128压缩支路；is_draft_layer=True也使它不走前三层hash路由。'],
        inputs: 'proposer的token embedding [T,7168]、positions与previous HC hidden [T,4,7168]（可展平[T,28672]）；draft自己的SWA状态。', outputs: 'draft forward返回完整HC hidden；draft compute_logits做hc_head/norm/head得到候选logits → proposer → 主模型验证。',
        notes: ['一个predictor可由proposer迭代调用，不代表固定一次生成5个token；这里不是DSpark。', '本地主模型buffer在L60后、hc_head前保存；MTP forward也先返回完整四路，折叠发生在它的compute_logits。'], sources: ['config', 'forward', 'mtp', 'mtphead'],
        nodes: [n('h', 'Previous HC hidden', '[T,4,7168] / [T,28672]', 'streams', 0, 0, null, 'proposer从主模型pre-hc_head buffer或前一步draft获得完整四路状态，reshape后每路hnorm并经h_proj。', { streamCount: 4 }), n('embed', 'Draft token embedding', '[T,7168]', 'tokens', 1, 0, 'embedding', 'proposer给token embedding；position0按源码屏蔽，再enorm与e_proj，结果广播到四路。'), n('merge', '双投影后相加', 'e_proj(e) + h_proj(H)', 'sum', 0, 1, null, 'e路径[T,7168]广播到stream轴，与h路径[T,4,7168]逐元素相加，构成draft H。'), n('block', 'MTP block ×1', 'mHC + SWA-only + MoE', 'draft', 0, 2, 'block', '独立predictor block读取draft H和自己的SWA cache；Attention压缩率0，MoE使用score routing；返回完整四路状态。'), n('head', 'Draft hc_head / norm / head', '完整四路 → candidate logits', 'logits', 0, 3, 'head', 'draft compute_logits先把完整HC hidden折叠，再shared_head norm/head计算候选词表logits；使用draft自己的参数。'), n('verify', '主模型验证候选', '通过验收才成为正式输出', 'verify', 0, 4, 'overview', 'proposer采样候选并提交主模型验证；运行时接受的token才写入正式输出，拒绝项不直接返回。')],
        edges: [e('h', 'merge', 'hnorm→h_proj(H)', 1), e('embed', 'merge', 'enorm→e_proj(e)', 1), e('merge', 'block', 'draft H [T,4,7168]', 2), e('block', 'head', '完整HC hidden', 3), e('head', 'verify', 'candidate tokens', 4, true)],
        steps: [s('融合token与四路状态', '两个输入分别归一化并投影；embedding路径广播到四路后相加。', ['h', 'embed', 'merge']), s('执行独立predictor', 'draft block只用SWA窗口，保持mHC与MoE结构，返回完整HC状态。', ['block']), s('在compute_logits中折叠', 'draft的hc_head、norm与head产生候选logits；并不把此层接到普通主干末尾必经路径。', ['head']), s('交给验证流程', '候选经主模型验证后由运行时决定接受多少个token。', ['verify'])]
      }
    }
  };
  const model = window.ARCH_MODELS.deepseek_v4_pro;
  for (const component of Object.values(model.components)) {
    component.notes.push('投影、norm、专家与mHC参数均由checkpoint加载；图保留影响理解的源节点，其余固定权重在说明中交代。张量是逻辑形状，不代表特定TP/EP物理分片。');
  }
  model.components.block.notes.push('可选MTP也复用block类，但其Attention压缩率为0：只保留SWA；本页主干CSA/HCA分支不适用于该额外层。');
})();
