/* Evidence-backed architecture data. Logical tensor shapes omit TP/EP sharding. */
(() => {
  const N = (id, label, detail, kind, col, row, target, description) => ({id, label, detail, kind, col, row, ...(target ? {target} : {}), ...(description ? {description} : {})});
  const E = (from, to, label, step, optional = false) => ({from, to, label, step, ...(optional ? {optional} : {})});
  const S = (title, text, ...focus) => ({title, text, focus});
  const C = (title, parent, intro, inputs, outputs, sources, nodes, edges, steps, notes = []) => ({title, parent, intro, inputs, outputs, sources, nodes, edges, steps, notes});
  const components = {};

  components.overview = C('Kimi K3：混合注意力自回归主干', null,
    ['从已核验的官方配置出发：93 层自回归主干交错使用 69 个 KDA 与 24 个 gated MLA，hidden size 为 7168。它没有 CED 的 encoder/decoder 分段。', '本图沿本地 vLLM / Ascend forward 展开。文本和视觉 embedding 汇合后进入同一主干；AttnRes 沿网络深度选择残差来源，KDA 递推状态与 MLA 历史 KV 则沿 token 时间轴保存上下文。'],
    'input_ids [T]；可选 pixel_values、grid_thws；positions 与请求缓存元数据',
    'forward 返回 [T,7168] hidden；外部 compute_logits 与 sampler 产生 token', ['config','card','asc_model','nv_model','mm'],
    [N('text','文本输入与嵌入','[T] → [T,7168]','tokens',0,0,'embeddings'), N('vision','视觉输入与投影','MoonViT-V2 → 文本维度','vision',1,0,'vision'), N('merge','合并模型输入','统一 inputs_embeds [T,7168]','gather',0,1,'embeddings'), N('stack','93 层混合主干','69 KDA + 24 gated MLA','stack',0,2,'stack'), N('depth','AttnRes 深度残差','当前 prefix + 历史 block 表征','streams',1,2,'attnres'), N('history','按层请求缓存','KDA state / MLA latent KV','cache',1,3,'caches'), N('head','输出混合与 LM head','最终 Norm 在 compute_logits','logits',0,4,'head')],
    [E('text','merge','文本 embedding',1),E('vision','merge','视觉 embedding',1,true),E('merge','stack','[T,7168]',2),E('depth','stack','按子层混合残差',2),E('history','stack','历史 state / KV',2),E('stack','history','更新本层 state / KV',2),E('stack','head','pre-norm hidden',3)],
    [S('准备统一输入','文本查表；视觉分支独立编码并映射到 7168 维，再由多模态输入流程合并。','text','vision','merge'),S('执行混合主干','按 L0→L92 顺序运行；每层的注意力类型由配置决定，AttnRes 与本层缓存参与各自的数据路径。','stack','depth','history'),S('产生下一 token','最终 output AttnRes 返回 hidden；runner 选取需要的行，再调用最终 RMSNorm、LM head 与 sampler。','head')],
    ['层号全部为 0-based；官方 full_attn_layers / kda_layers 列表使用 1-based，已转换。','T 是本轮扁平化 token 数；所有形状是未按 TP/EP 切分的逻辑形状。仅静态源码分析，未执行模型或 NPU 推理。','官方基础 config 的 num_nextn_predict_layers=0；本图不将仓库中的可选 DSpark/MTP 实现视作基础权重已启用的主干。']);

  components.embeddings = C('输入 embedding 与多模态合并','overview',
    ['文本词表精确大小为 163840；文本 embedding 和 LM head 不共享权重。视觉 token 经过 projector 后使用相同的 7168 维接口。', '多模态编码由 embed_multimodal 等输入准备接口完成。模型 forward 可以直接接收已经合并好的 inputs_embeds；不应把每个 decode forward 都画成重新执行视觉编码。'],
    'input_ids [T]；可选视觉 embedding [M,7168] 与媒体占位位置', 'inputs_embeds / hidden [T,7168]', ['config','nv_model','mm'],
    [N('ids','token IDs','[T]；词表 163840','tokens',0,0),N('table','词嵌入查表','VocabParallelEmbedding','gather',0,1, null,'逻辑权重 [163840,7168]；实际权重可按 TP 切分。'),N('image','视觉特征','[M,7168]','vision',1,1,'vision'),N('merge','替换媒体占位嵌入','保持输入 token 的排列','gather',0,2),N('ready','主干输入','[T,7168] + positions','streams',0,3,'stack')],
    [E('ids','table','token index',1),E('table','merge','文本向量',2),E('image','merge','媒体位置向量',2,true),E('merge','ready','inputs_embeds',3)],
    [S('文本查表','ID 定位词嵌入行，形成每个位置的 7168 维输入。','ids','table'),S('合并视觉位置','有媒体输入时，已投影的视觉特征交给多模态输入准备流程，填入媒体占位位置。','image','merge'),S('进入模型','第一 PP stage 使用 inputs_embeds，或在没有它时调用 embed_input_ids。后续 PP stage 从 intermediate_tensors 接收表征。','ready')]);

  const mlaLayers = Array.from({length:23},(_,i)=>4*i+3).concat(92);
  const mlaSet = new Set(mlaLayers);
  const stackNodes = [], stackEdges = [], stackSteps = [];
  for (let i=0;i<93;i++) {
    const mla=mlaSet.has(i), row=Math.floor(i/3), col=row%2===0?i%3:2-i%3;
    stackNodes.push(N(`l${i}`,`L${i} · ${mla?'gated MLA':'KDA'}`,i===0?'Dense FFN；AttnRes':'Stable LatentMoE；AttnRes',mla?'attention':'state',col,row,i===0?'dense_block':mla?'mla_block':'kda_block',`第 ${i+1} 个 Transformer 层；注意力权重、KDA 状态或 MLA KV 均属于本层，不与另一层共用。${i%12===0?'本层是 AttnRes block 边界。':''}`));
    if(i>0) stackEdges.push(E(`l${i-1}`,`l${i}`,'hidden / 深度残差',i+1));
    stackSteps.push(S(`L${i}：${mla?'gated MLA':'KDA'} + ${i===0?'Dense FFN':'LatentMoE'}`,`先以 Attention AttnRes 构造归一化输入，执行${mla?'带输出门的全局 MLA':'KDA 状态更新'}，再以 FFN AttnRes 构造输入并执行${i===0?'首层 dense MLP':'896 选 16 的 latent MoE 与 2 个 shared experts'}。`,`l${i}`));
  }
  components.stack = C('93 层：真实逐层注意力组合','overview',
    ['L0–L91 由 23 组「3 层 KDA + 1 层 gated MLA」组成，L92 再接一个 gated MLA。因此总计 69 KDA、24 MLA。',`MLA 层为 ${mlaLayers.map(i=>`L${i}`).join('、')}；其余层均为 KDA。L0 使用 dense FFN，L1–L92 使用 MoE。`, '图按箭头蛇形排列；每个方块对应一个真实、独立参数的层。点击进入该类 block，再展开注意力、AttnRes 或 FFN。'],
    'embedding [T,7168]；缓存由各层持有', '完成 L92 后的 prefix / delta / AttnRes block bank', ['config','layer_config','asc_layer','nv_block'], stackNodes, stackEdges, stackSteps,
    ['这是一个连续的自回归主干，没有前半 encoder 与后半 decoder 的切分。','AttnRes block_size=12 表示每 12 个 Transformer 层设置残差分组边界，不改变上述注意力交错顺序。']);

  function makeBlock(title,attentionTarget,dense=false) {
    return C(title,'stack',
      ['先构造注意力的 AttnRes 混合输入，再执行注意力；将注意力输出并入当前 block 的 prefix，随后为 FFN 重新计算 AttnRes 权重。', '源码将 prefix_sum、上一子层的 delta 与历史 block_residual 分开传递，部分加法被延迟到融合算子中。图表示这些张量的数学依赖，不要求每个节点对应独立 kernel。'],
      '当前 prefix [T,7168]、未并入的 delta、历史 block bank [T,B,7168]', 'FFN delta [T,7168] 与更新后的深度残差状态', ['asc_layer','nv_block','attnres_op'],
      [N('prefix','当前层输入','prefix + 前一 FFN delta','streams',0,0),N('bank','历史 block bank','本轮 forward 的深度表征','streams',1,0,'attnres'),N('pre','Attention AttnRes','混合 → input RMSNorm','sum',0,1,'attnres'),N('attn','执行本层注意力',attentionTarget==='mla'?'gated MLA':'KDA','attention',0,2,attentionTarget),N('post','FFN AttnRes','并入 attention delta 后再混合','sum',0,3,'attnres'),N('ffn',dense?'Dense FFN':'Stable LatentMoE',dense?'仅 L0；中间维 33792':'7168 → 3584 → 7168','experts',0,4,dense?'dense':'moe'),N('next','返回下一层','FFN delta + prefix + bank','streams',0,5)],
      [E('prefix','pre','prefix / delta',1),E('bank','pre','历史来源',1),E('pre','attn','[T,7168]',2),E('attn','post','attention delta',3),E('bank','post','历史来源',3),E('post','ffn','FFN normalized x',4),E('ffn','next','FFN delta',5),E('post','next','prefix / bank',5)],
      [S('准备 Attention 输入','更新当前 prefix；在每 12 层边界保存一个完成的残差 block；Attention 专属权重对历史来源与当前 prefix 做混合，并做输入 Norm。','prefix','bank','pre'),S('注意力计算','所选注意力更新自己的 token 历史缓存，返回 [T,7168] 的 attention delta。','attn'),S('准备 FFN 输入','将 attention 输出纳入当前 block；用 FFN 专属 AttnRes 权重重新混合，再做 post_attention RMSNorm。','post','bank'),S('前馈计算',dense?'L0 执行 dense SiTU-GLU MLP。':'其余层执行 routed latent experts 与 shared experts，恢复 7168 维输出。','ffn'),S('返回续点','FFN 输出作为 delta 传出，与 prefix 和 block bank 一起进入下一层；融合路径可延迟执行这次加法。','next')]);
  }
  components.kda_block=makeBlock('KDA + LatentMoE block','kda');
  components.mla_block=makeBlock('Gated MLA + LatentMoE block','mla');
  components.dense_block=makeBlock('L0：KDA + Dense FFN','kda',true);

  components.attnres=C('AttnRes：沿网络深度选择残差来源','overview',
    ['AttnRes 的 softmax 轴是历史残差来源，不是上下文 token。对同一个 token，把此前完成的 block 表征与当前 block 的累计 prefix 放在一起评分，再加权组合。', '每个 Attention 与 FFN 子层各自持有 residual RMSNorm 和 7168→1 的评分投影。边界层 L0、L12、…、L84 写入 bank；93 层全模型需要 8 个 bank 槽位，最终输出还会混合当前未完成 block。'],
    '每个 token 的 prefix [7168]、可选 delta [7168]、B 个有效 bank 向量', '混合 hidden [T,7168]；按边界更新 bank / prefix', ['config','asc_layer','nv_block','attnres_op'],
    [N('prefix','更新当前 prefix','prefix ← prefix + delta','streams',0,0),N('bank','历史 block 表征','[T,B,7168]；B≤8','streams',1,0),N('score','逐来源打分','RMSNorm(source) → 线性标量','selection',0,1),N('softmax','来源轴 softmax','每个 token 独立计算权重','selection',0,2),N('sum','加权原始表征','混合 bank 与当前 prefix','sum',0,3),N('norm','子层输入 Norm','[T,7168] → Attention / FFN','gather',0,4)],
    [E('prefix','score','当前来源',1),E('bank','score','历史来源',1),E('score','softmax','source logits',2),E('softmax','sum','source weights',3),E('prefix','sum','原始 prefix',3),E('bank','sum','原始 block vectors',3),E('sum','norm','mixed hidden',4)],
    [S('构造来源集合','将上一子层 delta 并入 prefix；在 block 边界按源码写入 bank，读取当前有效的历史 block。','prefix','bank'),S('计算来源权重','每个来源先归一化以计算 scalar score，再沿残差来源维 softmax。Attention、FFN、最终输出使用各自评分参数。','score','softmax'),S('混合来源','用 softmax 权重加权原始来源向量，形成新的子层输入。','sum'),S('进入消费者','Attention / FFN 入口继续做它自己的 RMSNorm；最终 output AttnRes 没有这个子层 Norm，最终 Norm 留给 compute_logits。','norm')],
    ['bank 是本轮计算的深度残差暂存，不是跨 token 的 KV cache，也不是 KDA recurrent state。','图中每个来源的一条权重可用于该 token 的全部 7168 个通道；不能误画成 mHC 的固定四路残差。']);

  components.kda=C('KDA：短卷积、遗忘门与 Delta 状态','kda_block',
    ['KDA 每层具有 96 个 head，每 head 的 Q/K/V 维度均为 128。它把长历史更新到每请求、每层的递推矩阵状态，不随每个历史 token 追加一行普通 KV。', '配置 short_conv_kernel_size=4，另有逐通道遗忘门、每 head 的 beta 与输出门。Prefill 使用 chunk 算法，decode 使用 recurrent 更新；两者对应同一状态递推语义。'],
    'normalized x [T,7168]；本层短卷积历史与 recurrent state', 'attention output [T,7168]；更新后的两个状态', ['config','kda','asc_kda','kda_runner','kda_recurrence'],
    [N('x','本层 normalized x','[T,7168]','streams',0,0),N('qkv','投影 Q / K / V','各 [T,96,128]','gather',0,1),N('gates','投影门控参数','forget / beta / output gate','router',1,1),N('conv','因果短卷积','kernel=4；读取并写回 conv state','state',0,2),N('norm','Q / K L2 Norm','按 head 通道归一化','gather',0,3),N('state','KDA 递推状态','每请求 [96,128,128]','state',1,3,'kda_state'),N('update','状态更新与读取','Prefill chunk / Decode recurrent','attention',0,4,'kda_state'),N('ogate','输出 Norm 与门控','RMSNorm(o) × sigmoid(g)','selection',0,5),N('out','输出线性投影','[T,12288] → [T,7168]','gather',0,6)],
    [E('x','qkv','hidden',1),E('x','gates','hidden',1),E('qkv','conv','projected QKV',2),E('conv','norm','causal Q / K',3),E('norm','update','q / k；v 走对应分支',4),E('gates','update','forget / beta',4),E('state','update','旧 recurrent state',4),E('update','state','新 recurrent state',4),E('update','ogate','o [T,96,128]',5),E('gates','ogate','output gate',5),E('ogate','out','门控结果',6)],
    [S('投影数据与门','由 x 产生 QKV、output gate、beta logits 和 forget 参数；Ascend 可将多个投影融合。','x','qkv','gates'),S('加入局部顺序信息','QKV 经过宽度 4 的因果卷积与 SiLU；读取对应请求的卷积状态并写回尾部状态。','conv'),S('规范 Q/K','Prefill 前端或 recurrent kernel 内对 Q/K 做 L2 normalization；V 不做同样的 Q/K 归一化。','norm'),S('更新历史摘要','遗忘门衰减旧矩阵，beta 控制 delta correction，再用当前 Q 读出状态。Prefill 分块实现不表示换了模型。','update','state'),S('控制读出幅度','每 head 输出经过 gated RMSNorm，使用独立的 sigmoid output gate。','ogate'),S('回到 hidden 维','拼接 96 个 head，经过 o_proj 返回 [T,7168]。','out')],
    ['[96,128,128] 为未 TP 切分的逻辑单请求状态；Ascend 采用 [H,V,K] 顺序。cache 分配还含槽位、dtype、checkpoint 等实现字段。','短卷积状态与 recurrent 矩阵是两类状态；不能把它们合并成一个随序列长度增长的 KV 数组。']);

  components.kda_state=C('KDA 单 token 递推：旧状态如何成为新状态','kda',
    ['以下用一个 head 的数学语义展开 NPU recurrent kernel，忽略 batch、head 与 TP 轴。S 的存储顺序为 [V,K]；q/k 为归一化的 128 维向量，q 还包含 attention scale。', '令 G=exp(g)，先按 K 通道遗忘：S̄=Sprev⊙G。再计算 δ=β(v−S̄k)，更新 Snew=S̄+δkᵀ，最后 o=Snew q。它通过当前 key 修正旧状态对 value 的预测。'],
    'Sprev [128,128]；q/k/v [128]；G [128]；β 标量', 'Snew [128,128] 与 o [128]', ['kda_recurrence','kda_runner','asc_kda'],
    [N('old','旧状态 Sprev','来自同请求、同层、同 head','state',0,0),N('gate','遗忘系数 G','逐 K 通道；G=exp(g)','router',1,0),N('decay','衰减状态 S̄','Sprev ⊙ G','state',0,1),N('kv','当前 k / v / beta','数据与更新强度','tokens',1,1),N('delta','预测误差 δ','β × (v − S̄k)','sum',0,2),N('new','写入新状态','Snew = S̄ + δkᵀ','state',0,3),N('query','当前 query q','L2 Norm 后带 scale','tokens',1,3),N('read','读取输出','o = Snew q','attention',0,4)],
    [E('old','decay','Sprev',1),E('gate','decay','G',1),E('decay','delta','旧状态预测 S̄k',2),E('kv','delta','k / v / beta',2),E('delta','new','δ',3),E('decay','new','S̄',3),E('kv','new','k 外积方向',3),E('new','read','Snew',4),E('query','read','q',4)],
    [S('遗忘','将旧矩阵按 key 通道衰减，保留输入相关的历史信息。','old','gate','decay'),S('计算 correction','用衰减状态预测当前 key 对应的 value；真实 v 减预测值，再乘 beta。','kv','delta'),S('更新矩阵','把 δ 与 k 的外积加回衰减状态，得到新状态并保存到请求槽位。','new'),S('读出','用当前 q 读取更新后的矩阵，得到一个 head 的 128 维输出。','query','read')],
    ['这是算法语义展开；实际 chunk prefill、recurrent decode 与融合 kernel 的执行顺序和物理布局可以不同。','recurrent state 保留固定形状的历史摘要；prefill 的临时张量仍可能随本轮 T 增长，不能据此声称总运行内存与长度无关。']);

  components.mla=C('Gated MLA：低秩 KV 与全局因果注意力','mla_block',
    ['24 个 MLA 层读取本层完整可见历史，以 latent KV 缓存减少保存维度，再用输出门控制每个 attention output 通道。此路径没有 DeepSeek V4.1 的跨层 KV source 或 TopK indexer。', '主干明确使用 NoPE：虽然字段仍叫 qk_rope_head_dim=64、k_pe，Kimi K3 主干不施加 RoPE。Q 的 head 维为 128+64=192，V 为 128，latent KV rank 为 512。'],
    'x [T,7168]；本层历史 latent cache 与因果 metadata', 'gated attention output [T,7168]；追加本轮 latent KV', ['config','mla','asc_mla','asc_layer'],
    [N('x','normalized x','[T,7168]','streams',0,0),N('q','Q 低秩投影','7168 → 1536 → 96×192','gather',0,1),N('kv','KV 低秩投影','c_KV 512 + shared K 64','gather',1,1),N('cache','本层 latent cache','历史 [S,512+64]','cache',1,2,'caches'),N('attn','全局因果 MLA','96 heads；输出每 head 128','attention',0,3),N('gate','输出门投影','sigmoid(Wg x) [T,12288]','selection',1,3),N('mul','按通道相乘','attention × output gate','sum',0,4),N('out','o_proj','12288 → 7168','gather',0,5)],
    [E('x','q','hidden',1),E('x','kv','hidden',1),E('kv','cache','当前新增 latent',2),E('q','attn','Q',3),E('cache','attn','本层可见历史',3),E('x','gate','hidden',3),E('attn','mul','attention output',4),E('gate','mul','sigmoid gate',4),E('mul','out','gated [T,12288]',5)],
    [S('准备低秩投影','Q 分支先降到 1536、归一化，再展开到 96×192；KV 分支把 512 维 latent 归一化并保留额外 64 维共享 K。','x','q','kv'),S('写历史缓存','当前 token 新增 [T,576] 逻辑缓存记录，累积为 [S,576]。量化与物理 page 布局由后端决定。','cache'),S('执行因果 Attention','按本请求历史计算全局注意力；prefill 可展开 K/V，decode 可将 Q 的投影吸收到 latent 空间，均产生每 head 128 维结果。','attn','gate'),S('施加输出门','独立 g_proj(x) 经 sigmoid，与 attention 输出逐通道相乘。','mul'),S('恢复 hidden','通过 o_proj 返回 7168 维 attention delta。','out')],
    ['模型主干 use_rope=False；字段名字含 rope 不代表执行旋转。可选 DSpark 构造参数不改变这里的主干事实。','没有在此图引入 TopK 稀疏选择，也没有把 KDA state 当作 MLA 的 KV 输入。']);

  components.moe=C('Stable LatentMoE：宽维路由、窄维专家','kda_block',
    ['L1–L92 使用 896 个 routed experts，每 token 选择 16 个；还有 2 个 shared experts。Router 接收 7168 维输入，而 routed expert 的输入输出处于 3584 维 latent 空间。', '关键顺序：down projection → routed experts 的加权汇总 → latent RMSNorm → up projection → 与 shared 输出相加。latent RMSNorm 位于 routed 输出端，不能误画到 down projection 之前。'],
    'FFN normalized x [T,7168]', 'MoE delta [T,7168]', ['config','asc_moe','routed_transform','nv_moe'],
    [N('x','FFN normalized x','[T,7168]','streams',0,0),N('route','Router 选择专家','7168 → 896；选 16','router',1,1),N('down','降到 latent 空间','7168 → 3584','scatter',0,1),N('experts','16 个 routed experts','各自 3584 → 3072 → 3584','experts',0,2,'experts'),N('weighted','汇总 routed 输出','路由权重加权求和 [T,3584]','sum',0,3),N('normup','RMSNorm → up_proj','3584 → 7168','gather',0,4),N('shared','2 个 shared experts','同一 x；逻辑中间维 2×3072','shared',1,3,'experts'),N('sum','合并两条分支','routed output + shared output','sum',0,5)],
    [E('x','route','原 hidden',1),E('x','down','原 hidden',1),E('down','experts','latent x',2),E('route','experts','expert IDs / weights',2),E('experts','weighted','expert output',3),E('route','weighted','归一化 routing weights',3),E('weighted','normup','latent mixture',4),E('x','shared','原 hidden',2),E('normup','sum','routed [T,7168]',5),E('shared','sum','shared [T,7168]',5)],
    [S('路由与降维','同一个 x 分别送入 896 路 router 与 7168→3584 down projection；router 使用 sigmoid、noaux_tc correction bias 与归一化权重配置。','x','route','down'),S('执行两条专家路径','选择 16 个 routed experts 处理 latent；2 个 shared experts 使用原始 7168 维输入。','experts','shared'),S('合成 routed latent','按所选权重汇总 routed experts 的 3584 维输出。','weighted'),S('恢复到 hidden 空间','对汇总后的 latent 做 RMSNorm，再 up projection 到 7168。','normup'),S('合并 FFN 输出','把 routed 与 shared 的 7168 维结果相加，交给 block 的残差状态。','sum')],
    ['expertCount=896 是每个 MoE 层的逻辑数量；EPLB replicas、EP placement 与物理专家数量是运行时部署概念。','shared experts 在实现中可表示为一个中间维 6144 的等价宽 MLP；它们不占 routed Top16 名额。']);
  components.moe.nodes.find(n=>n.id==='experts').expertCount=896;
  components.moe.nodes.find(n=>n.id==='experts').selectedExperts=16;

  components.experts=C('专家内部：SiTU-GLU 的两路投影','moe',
    ['Routed experts 以 latent 3584 维为输入输出，每个专家的 intermediate size 为 3072。Shared experts 以 7168 维为输入输出，两个共享专家可合并为 intermediate size 6144 的宽 MLP。', '激活函数由配置 hidden_act="situ" 选择 SituAndMul；不能套用普通 SiLU/SwiGLU 的名字。'],
    '单专家输入 x [N,D]；routed D=3584，shared D=7168', 'expert(x) [N,D]；随后由调用者加权或合并', ['config','expert_mlp','asc_moe'],
    [N('x','专家输入 x','D=3584 或 7168','streams',0,0),N('gate','gate projection','[N,I]','router',0,1),N('up','up projection','[N,I]','gather',1,1),N('act','SiTU 激活','作用于 gate 分支','selection',0,2),N('mul','逐元素相乘','SiTU(gate) × up','sum',0,3),N('down','down projection','I → D','gather',0,4)],
    [E('x','gate','x',1),E('x','up','x',1),E('gate','act','gate values',2),E('act','mul','activated gate',3),E('up','mul','up values',3),E('mul','down','gated intermediate',4)],
    [S('两路投影','gate 与 up 读取相同 x，生成 intermediate size 的两个向量；实现可合并为一次 gate_up 投影。','x','gate','up'),S('激活 gate','使用 SiTU，配置 beta=4、linear_beta=25；本图不将其替换为 SiLU。','act'),S('门控相乘','激活后的 gate 与 up 逐元素相乘。','mul'),S('返回专家输出','down projection 恢复该专家输入空间的维度，交给 routed 加权汇总或 shared 合并。','down')]);

  components.dense=C('L0 的 Dense FFN','dense_block',
    ['first_k_dense_replace=1，因此只有 L0 使用 dense FFN。它不经过 router、不选择 experts，也没有 latent MoE down/up bottleneck。'],
    'normalized x [T,7168]', 'dense FFN delta [T,7168]', ['config','asc_layer','expert_mlp'],
    [N('x','L0 normalized x','[T,7168]','streams',0,0),N('proj','两路线性投影','gate / up 各 [T,33792]','gather',0,1),N('act','SiTU-GLU','激活 gate 后与 up 相乘','selection',0,2,'experts'),N('down','down_proj','33792 → 7168','gather',0,3),N('out','返回 FFN delta','送入深度残差流','streams',0,4,'attnres')],
    [E('x','proj','hidden',1),E('proj','act','gate / up',2),E('act','down','gated intermediate',3),E('down','out','[T,7168]',4)],
    [S('扩展中间维','用合并的 gate_up_proj 产生两路 33792 维投影。','x','proj'),S('门控激活','SituAndMul 合成中间表征。','act'),S('回到 hidden','down_proj 输出 7168 维。','down'),S('交给下一层','该 delta 随 prefix 与 AttnRes bank 进入后续层。','out')]);

  components.vision=C('MoonViT-V2 与视觉到文本投影','overview',
    ['官方配置使用 27 层 MoonViT-V2，vision hidden=1024，12 个 attention heads，patch size=14。它是输入视觉编码器，不是将 93 层文本主干划成 CED。', 'vision_tower 先编码各 patch，按 sd2_tpool 聚合时间并将空间 2×2 patch 排成一组；patchmergerv2 再把这 4 个向量拼接到 4096 维，投影到文本 7168 维。'],
    'pixel_values 与 grid_thws；图像或视频帧的网格信息', '每媒体一组 [M,7168] embedding', ['config','vision','projector','mm','asc_vision'],
    [N('pixels','像素与网格','pixel_values / grid_thws','vision',0,0),N('patch','14×14 patch embedding','patch hidden=1024','vision',0,1),N('vit','MoonViT-V2 ×27','视觉 self-attention + MLP','stack',0,2),N('merge','时间池化 / 空间分组','每组 2×2；[M,4,1024]','gather',0,3),N('project','PatchMergerV2','4096 → GELU → 7168','gather',0,4),N('norm','输出 RMSNorm','[M,7168]','gather',0,5),N('text','填入媒体占位位置','并入统一 inputs_embeds','tokens',0,6,'embeddings')],
    [E('pixels','patch','pixels / grid',1),E('patch','vit','patch sequence',2),E('vit','merge','encoded patches',3),E('merge','project','flattened 4096',4),E('project','norm','projected 7168',5),E('norm','text','media embeddings',6)],
    [S('切分并嵌入','按网格把视觉内容转成 14×14 patch 的 1024 维表示，加入视觉位置表征。','pixels','patch'),S('视觉编码','运行 27 层视觉 Transformer，保留对应 patch 顺序。','vit'),S('聚合 patch','sd2_tpool 对同媒体 chunk 的时间轴求均值，并把相邻 2×2 空间 patch 组织为四向量组。图像的时间维为 1。','merge'),S('映射到文本空间','先 flatten 为 4096，再 linear_1(4096→4096)、GELU、linear_2(4096→7168)。','project'),S('归一化输出','patchmergerv2 的 post_norm 产生 7168 维视觉 token。','norm'),S('接回主链','输入准备流程将视觉 embedding 放到对应媒体占位位置，再进入同一 93 层主干。','text')],
    ['空间分组和线性降维是连续两个步骤；不要把 2×2 patch 合并误画成四个向量简单求和。','Ascend ModelSlim 场景可额外做输出旋转；该条件实现不作为官方基本架构的固定节点。']);

  components.caches=C('两类 token 历史与深度暂存','overview',
    ['Kimi K3 的混合注意力必须区分三种状态：KDA recurrent/conv state，MLA token KV，AttnRes 深度 bank。它们的索引轴、生产者、消费者与生命周期不同。'],
    '对应请求、层号、当前位置与运行时 cache slot metadata', '各层注意力更新历史；AttnRes 仅为本轮主干提供深度来源', ['kda','asc_kda','mla','attnres_op'],
    [N('kda','KDA 层','69 个独立层','attention',0,0,'kda'),N('mla','MLA 层','24 个独立层','attention',1,0,'mla'),N('ssm','递推矩阵 + conv state','矩阵每请求 [96,128,128]','state',0,1,'kda_state'),N('kv','按 token 的 latent KV','本层逻辑 [S,576]','cache',1,1,'mla'),N('depth','AttnRes block bank','本轮 [T,B,7168]；B≤8','streams',0,3,'attnres')],
    [E('kda','ssm','写入新状态',1),E('ssm','kda','读取旧状态',1),E('mla','kv','追加当前 latent',2),E('kv','mla','读取因果历史',2)],
    [S('KDA 历史','同一个请求在同一 KDA 层继续从旧状态更新；逻辑矩阵大小不随历史 S 逐 token 增加。','kda','ssm'),S('MLA 历史','每个 MLA 层保存自己的 latent KV，历史 token 增加时记录数量随之增长。','mla','kv'),S('AttnRes 深度','bank 记录当前 forward 中完成的深度分组，不参与跨 token 的 KDA 矩阵递推或 MLA KV 检索。','depth')],
    ['形状为逻辑视图，不代表连续物理分配，也不是设备内存占用实测。','页面不承诺缓存复用、offload、量化或 speculative checkpoint 的特定部署配置。']);

  components.head=C('最终 output AttnRes、Norm 与 logits','overview',
    ['主干结束时，用独立 output AttnRes 把最后 prefix/delta 与有效 block bank 混合，得到 [T,7168] hidden。最终 RMSNorm 不在 KimiLinearModel.forward 尾部执行，而是在 compute_logits 中执行。'],
    'L92 完成后的 prefix / FFN delta / block bank', '需要采样行的 logits [N,163840]；外部 sampler 返回 token IDs', ['nv_model','asc_model','head','config'],
    [N('streams','主干最后状态','prefix + delta + block bank','streams',0,0,'attnres'),N('mix','Output AttnRes','最终来源混合 [T,7168]','sum',0,1,'attnres'),N('return','forward 返回 hidden','尚未最终 RMSNorm','streams',0,2),N('select','runner 选择 logits 行','[N,7168]；N≤T','selection',0,3),N('norm','最终 RMSNorm','compute_logits 内执行','gather',0,4),N('head','Parallel LM head','7168 → 163840','logits',0,5),N('sample','外部 sampler','logits → 下一 token IDs','sample',0,6)],
    [E('streams','mix','最后深度状态',1),E('mix','return','pre-norm hidden',2),E('return','select','hidden rows',3),E('select','norm','待求 logits 的行',4),E('norm','head','normalized hidden',5),E('head','sample','logits',6)],
    [S('混合最终来源','独立 output_attn_res_norm / proj 计算最终深度混合。','streams','mix'),S('返回模型输出','forward 返回未做最终 Norm 的 hidden，调用边界与 logits 计算分开。','return'),S('选择需要的行','服务 runner 根据采样与日志概率需求选取行；教学上的最后一个 token 是常见情形，不代表所有配置。','select'),S('最终归一化','compute_logits 调用 self.model.norm。','norm'),S('映射词表','LogitsProcessor 与 ParallelLMHead 生成 163840 词表上的分数。','head'),S('外部采样','sampler 按请求采样配置选 token；新 token 作为后续 decode 输入。','sample')],
    ['N≤T 是按本轮有效返回行说明的常用逻辑视图；图不展开图捕获 padding 或跨 rank 输出协议。']);

  // Make persistent state provenance and checkpoint parameters explicit on the
  // same graph. These nodes are data sources, not additional forward calls.
  components.overview.edges.push(E('stack','depth','写入本轮深度 bank / prefix',2));
  const kda = components.kda;
  kda.nodes.find(n=>n.id==='state').label='上轮 recurrent state';
  kda.nodes.find(n=>n.id==='state').detail='同请求、同层；初始可为零';
  kda.nodes.find(n=>n.id==='conv').detail='kernel=4 → SiLU';
  kda.edges=kda.edges.filter(e=>!(e.from==='update'&&e.to==='state'));
  kda.edges.find(e=>e.from==='norm'&&e.to==='update').label='normalized q / k';
  kda.nodes.push(N('conv_old','上轮 conv state','请求槽位中的历史 QKV 尾部','state',1,2),N('state_new','本轮新 recurrent state','写回同槽位供后续 token 使用','state',1,4,'kda_state'),N('conv_new','本轮新 conv state','保存当前末尾供下轮使用','state',1,5));
  kda.edges.push(E('conv_old','conv','旧卷积尾部',2),E('conv','conv_new','更新后的卷积尾部',2),E('conv','update','V：不做 Q/K Norm',4),E('update','state_new','新 [96,128,128]',4));
  kda.steps[1].focus.push('conv_old','conv_new');
  kda.steps[3].focus.push('state_new');
  components.kda_state.nodes.push(N('saved','新状态保存到请求槽位','下一个 token 作为 Sprev 读取','state',1,4));
  components.kda_state.edges.push(E('new','saved','Snew [128,128]',3));
  components.kda_state.steps[2].focus.push('saved');

  const ar=components.attnres;
  ar.nodes.find(n=>n.id==='bank').label='前序层写入的 bank';
  ar.nodes.find(n=>n.id==='bank').detail='同一 token 的有效深度来源';
  ar.nodes.push(N('boundary','12 层边界写回','L0、L12、…、L84','state',1,1),N('bank_next','后续子层的 bank','保存完成的 prefix 表征','streams',1,2));
  ar.edges.push(E('prefix','boundary','当前完整 prefix',1,true),E('bank','boundary','已有 block bank',1,true),E('boundary','bank_next','追加有效 block',1));
  ar.steps[0].focus.push('boundary','bank_next');
  ar.notes.push('Attention 边界写入后的 bank 成为后续 FFN / 层的输入；当前 Attention 的有效历史数量由 prev_valid_blocks 控制，不能重复计入当前 prefix。');

  const mla=components.mla;
  mla.nodes.find(n=>n.id==='cache').label='本轮可见 latent KV';
  mla.nodes.push(N('cache_old','上轮 MLA 历史','同请求、同层 [S_old,576]','cache',2,1),N('cache_new','本轮更新后缓存','[S_new,576]；供后续 token','cache',2,3));
  mla.edges.push(E('cache_old','cache','历史 latent 记录',2),E('cache','cache_new','新旧历史合并后的记录',2));
  mla.steps[1].focus.push('cache_old','cache_new');

  function weightSource(key,label,description,targets) {
    const c=components[key];
    c.nodes.push(N('weights',label,'checkpoint 加载；本层独立参数','state',2,0,null,description));
    targets.forEach(([id,param,step])=>c.edges.push(E('weights',id,param,step)));
  }
  weightSource('embeddings','已加载 embedding 表','由 checkpoint 初始化的逻辑 [163840,7168] 词嵌入权重；input_ids 用作行索引。',[['table','embedding weight',1]]);
  weightSource('attnres','本子层评分权重','本层 Attention 或 FFN 各自持有 residual RMSNorm weight 与 [1,7168] res_proj；最终输出拥有另一组独立参数。',[['score','norm / score weight',1],['norm','input Norm weight',4]]);
  weightSource('kda','本层 KDA 权重','由本层 checkpoint 加载的 QKV、门控、卷积、A_log/dt_bias、gated Norm 与 o_proj；不会从另一层共享。',[['qkv','QKV weights',1],['gates','gate / beta weights',1],['conv','conv weights',2],['update','A_log / dt_bias',4],['ogate','RMSNorm weight',5],['out','o_proj weight',6]]);
  weightSource('mla','本层 MLA 权重','独立的 Q/KV 投影、Q/KV Norm、KV 展开、g_proj 和 o_proj 权重；本层历史缓存来自它们此前的执行结果。',[['q','Q weights / Norm',1],['kv','KV weights / Norm',1],['attn','KV up weights',3],['gate','g_proj weight',3],['out','o_proj weight',5]]);
  weightSource('moe','本层 MoE 权重','当前 MoE 层的 router、correction bias、latent down/up、latent Norm、896 组 routed 和 2 组 shared expert 权重。',[['route','router weight / bias',1],['down','latent down weight',1],['experts','选中专家权重',2],['normup','latent Norm / up',4],['shared','shared weights',2]]);
  weightSource('experts','当前专家权重','当前 expert ID 对应 gate/up/down 权重；shared 专家也具有自己的参数，不与 routed 专家共用。',[['gate','gate weight',1],['up','up weight',1],['down','down weight',4]]);
  weightSource('dense','L0 Dense 权重','仅 L0 的 gate/up/down 与 SiTU 参数；没有 routed expert table。',[['proj','gate / up weights',1],['down','down weight',3]]);
  weightSource('vision','视觉 checkpoint 权重','视觉 patch embedding、位置表征、27 层 Transformer、projector 和输出 Norm 的独立参数。',[['patch','patch / position weights',1],['vit','27 层权重',2],['project','projector weights',4],['norm','post Norm weight',5]]);
  weightSource('head','输出层权重','模型最终 Norm 权重与独立 LM head [163840,7168]；LM head 不与 input embedding 绑权重。',[['norm','final Norm weight',4],['head','LM head weight',5]]);

  const io = {
    overview:['上游 tokenizer 的 input_ids [T] 与 positions [T]；输入准备提供可选视觉张量；runner 提供请求缓存元数据','向 runner 返回 pre-norm hidden [T,7168]；compute_logits / sampler 消费采样行并产生下一 token'],
    embeddings:['tokenizer 的 input_ids [T]；vision 组件输出 [M,7168] 与输入准备维护的媒体占位位置','向 L0 输入 inputs_embeds [T,7168]；后续 PP stage 从中间张量而非 embedding 接收输入'],
    stack:['embedding 组件输出 [T,7168]；每层按请求 cache slot 读取历史 token state / KV','L92 的 prefix [T,7168]、FFN delta [T,7168] 与 bank [T,8,7168] 交给 output AttnRes'],
    attnres:['前一子层的 prefix/delta 各 [T,7168]；本轮先前边界层写入的 bank [T,B,7168]；本子层评分权重','混合 hidden [T,7168] 交给本层 Attention / FFN；边界写入 bank 交给后续子层；最终混合交给 head'],
    kda:['本层 Attention AttnRes/Norm 输出 x [T,7168]；同请求同层 cache slot 的 conv tail 与 recurrent [96,128,128]','attention delta [T,7168] 交给本层 FFN AttnRes；新 conv/recurrent 状态写回原请求槽位，供下轮读取'],
    kda_state:['本层前端提供 q/k/v [128]、遗忘 G [128] 与 beta；同请求同 head 前一步保存的 Sprev [128,128]','Snew [128,128] 写回同请求同 head 槽位；o [128] 交给本层 gated RMSNorm 和 o_proj'],
    mla:['本层 Attention AttnRes/Norm 输出 x [T,7168]；各请求同层上轮 cache [S_old,576]；runner 的因果元数据','attention delta [T,7168] 交给本层 FFN AttnRes；各请求 cache [S_new,576] 保存供后续 token 读取'],
    moe:['本层 FFN AttnRes/Norm 输出 x [T,7168]；本层 router、latent 与专家权重','FFN delta [T,7168] 随当前 prefix 和 bank 返回下一层，供其 Attention AttnRes 消费'],
    experts:['routed dispatch 或 shared 分支提供 x [N,D]；D=3584 或 7168；相应 expert ID 的权重','expert(x) [N,D] 交给 routed 加权汇总或 shared 输出合并；该组件不自行更新 residual'],
    dense:['L0 FFN AttnRes/Norm 输出 x [T,7168]；L0 dense 权重','L0 FFN delta [T,7168] 交给 L1 的 Attention AttnRes / prefix 更新'],
    vision:['多模态 processor 提供 pixel_values、grid_thws；每媒体的时空 patch 网格','每媒体 [M,7168] 向量交给 embeddings 组件的占位合并；文本主干读取合并后的序列'],
    caches:['KDA 或 MLA 本层前端的当前数据与 runner cache slot metadata；AttnRes 的当前 prefix / delta','KDA state 和 MLA cache 写回对应层请求槽位供下一 token；AttnRes bank 仅供本轮后续深度子层'],
    head:['L92 输出 prefix/delta 各 [T,7168] 与有效 block bank [T,8,7168]','output AttnRes hidden [T,7168] 返回 runner；所选 N 行产生 logits [N,163840]，交给外部 sampler']
  };
  Object.entries(io).forEach(([key,[inputs,outputs]])=>{components[key].inputs=inputs;components[key].outputs=outputs;});
  ['kda_block','mla_block','dense_block'].forEach(key=>{
    components[key].inputs='前一层提供 prefix/delta [T,7168] 与 bank [T,B,7168]；本层读取其请求历史 cache / state';
    components[key].outputs='本层 FFN delta [T,7168]、当前 prefix 与更新 bank 返回下一层；最后 L92 返回 output AttnRes';
  });
  // Every node's selectable detail has a complete producer→operation→consumer
  // account derived from the same named edges used by the rendered graph.
  Object.values(components).forEach(c=>{
    const byId=new Map(c.nodes.map(n=>[n.id,n]));
    c.nodes.forEach(n=>{
      const incoming=c.edges.filter(e=>e.to===n.id).map(e=>`${byId.get(e.from).label}提供${e.label}`);
      const outgoing=c.edges.filter(e=>e.from===n.id).map(e=>`${e.label}交给${byId.get(e.to).label}`);
      const selectedSteps=c.steps.filter(s=>s.focus.includes(n.id)).map(s=>s.text);
      const detail=n.description || selectedSteps.join(' ') || `${n.label}：${n.detail}。`;
      const source=n.id==='weights'?'checkpoint 权重加载阶段与模型配置':incoming.length?incoming.join('；'):c.inputs;
      n.description=`输入来源：${source}。本步：${detail} 输出去向：${outgoing.length?outgoing.join('；'):c.outputs}。`;
    });
  });
  const exactDescriptions={
    'kda.state':'输入来源：同请求、同 KDA 层在上一已处理 token 后写回的 recurrent cache；新请求根据初始化标记从零状态开始。此节点提供逻辑 [96,128,128] 旧状态，交给本轮 KDA 更新；它不由当前 x 临时重建。',
    'kda.conv_old':'输入来源：同请求同层上轮写回的 conv state。它保存固定卷积尾部，将历史 QKV 与本轮投影 QKV 一起交给宽度 4 的因果卷积；新请求使用初始化后的状态。',
    'kda.state_new':'输入来源：本轮 recurrent 更新或 chunk prefill 的 final_state。写回同请求同层的 recurrent cache 槽位，下一个 token 的本层 KDA 将把它读为旧状态；本轮 attention 输出走独立的输出门分支。',
    'kda.conv_new':'输入来源：本轮 causal_conv1d 的状态更新。保存固定长度的新 QKV 尾部到原请求槽位，下轮同层卷积读取，不送入 o_proj。',
    'kda_state.old':'输入来源：前一个 token 在同请求、层、head 槽位保存的 Snew；首 token 可使用零矩阵。当前读出 [128,128] 的 Sprev，交给本轮逐通道遗忘。',
    'kda_state.gate':'输入来源：本层当前 hidden 生成的 raw forget gate，以及已加载的 A_log、dt_bias。门控函数形成 log decay g，exp(g) 得到逐 K 通道系数 G，供旧状态衰减使用。',
    'kda_state.kv':'输入来源：本层投影和 causal convolution 生成的当前 k/v，以及 beta 投影的 sigmoid。归一化 k 与 v、beta 供预测误差和外积更新消费。',
    'kda_state.query':'输入来源：本层投影和 causal convolution 生成的当前 Q，经 L2 normalization 与 attention scale 得 q。它读取本轮更新后的 Snew，输出当前 head 的 value 向量。',
    'kda_state.saved':'输入来源：δ 外积更新后的 Snew [128,128]。写回同请求同 head 状态槽位，下一个 token 用它作为 Sprev；本轮输出仍单独由 Snew q 交给 gated Norm。',
    'attnres.bank':'输入来源：本轮 forward 中先前 L0/L12/… 边界写入的残差 block；L0 保存的是 embedding 入口表征。当前子层仅读取有效 bank 槽位，分别交给评分与加权混合。此 bank 不是上一轮 token cache。',
    'attnres.bank_next':'输入来源：12 层边界保存的完整 prefix 与此前已有 bank。后续 FFN 或 Transformer 层按其 num_valid_blocks 读取，最终 output AttnRes 也读取所有有效 block；当前 Attention 不重复纳入刚写的当前 prefix。',
    'mla.cache_old':'输入来源：同请求、同 MLA 层此前 token 的 KV 投影与 cache 写入。提供 [S_old,576] 的历史 latent 记录，与本轮新增记录共同构成本轮可见 cache。',
    'mla.cache_new':'输入来源：旧 [S_old,576] 记录与本轮该请求新增 [T_request,576] 记录。按请求 slot/page 元数据写回，S_new=S_old+T_request；后续 token 的同层 MLA 继续读取，别的 MLA 层使用各自缓存。'
  };
  Object.entries(exactDescriptions).forEach(([path,description])=>{const [key,id]=path.split('.');components[key].nodes.find(n=>n.id===id).description=description;});

  window.ARCH_MODELS.kimi_k3 = {
    id:'kimi_k3', name:'Kimi K3', subtitle:'69 KDA + 24 gated MLA · AttnRes · Stable LatentMoE',
    summary:'沿真实 forward 展开 93 层混合自回归主干，区分递推状态、latent KV 与深度残差 bank。',
    checked:'2026-11-05', revision:'vLLM 295c062db8；vLLM-Ascend 94e3e25f；官方 Kimi-K3 config main（本次核验）',
    stats:[{label:'Transformer 层',value:'93 = 69 KDA + 24 MLA'},{label:'Hidden / latent',value:'7168 / 3584'},{label:'Routed / shared',value:'896 选 16 + 2 shared'},{label:'首层 FFN',value:'L0 dense；其余 MoE'},{label:'词表 / 上下文',value:'163840 / 1048576'}],
    sources:[
      {id:'card',label:'官方模型卡：架构、参数与模型摘要',url:'https://huggingface.co/moonshotai/Kimi-K3'},
      {id:'config',label:'官方 config.json：维度、层型、MoE、视觉参数',url:'https://huggingface.co/moonshotai/Kimi-K3/blob/main/config.json'},
      {id:'layer_config',label:'KimiLinearConfig.is_kda_layer：配置层号转 0-based',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/transformers_utils/configs/kimi_linear.py#L157',local:'E:/code/vllm/vllm/transformers_utils/configs/kimi_linear.py:157'},
      {id:'asc_model',label:'AscendKimiLinearModel.forward：输入、循环与最终混合',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f/vllm_ascend/models/kimi_k3.py#L1004',local:'E:/code/vllm-ascend/vllm_ascend/models/kimi_k3.py:1004'},
      {id:'asc_layer',label:'Ascend layer：KDA/NoPE MLA、Dense/MoE、AttnRes',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f/vllm_ascend/models/kimi_k3.py#L499',local:'E:/code/vllm-ascend/vllm_ascend/models/kimi_k3.py:499'},
      {id:'nv_model',label:'KimiLinearModel.forward：深度状态传递与返回边界',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/nvidia/model.py#L1286',local:'E:/code/vllm/vllm/models/kimi_k3/nvidia/model.py:1286'},
      {id:'nv_block',label:'KimiDecoderLayer.forward：AttnRes→Attention→AttnRes→FFN',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/nvidia/model.py#L1007',local:'E:/code/vllm/vllm/models/kimi_k3/nvidia/model.py:1007'},
      {id:'attnres_op',label:'AttnRes kernel：prefix 更新、来源打分与加权',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/nvidia/ops/attn_res.py#L67',local:'E:/code/vllm/vllm/models/kimi_k3/nvidia/ops/attn_res.py:67'},
      {id:'kda',label:'KimiK3DeltaAttention：投影、head shape 与 gated Norm',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/nvidia/kda.py#L544',local:'E:/code/vllm/vllm/models/kimi_k3/nvidia/kda.py:544'},
      {id:'asc_kda',label:'Ascend KDA：卷积、recurrent/chunk 与状态写回',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f/vllm_ascend/ops/kimi_kda.py#L383',local:'E:/code/vllm-ascend/vllm_ascend/ops/kimi_kda.py:383'},
      {id:'kda_runner',label:'KDA runner：Q/K Norm 与 gate 处理参数',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f/vllm_ascend/ops/kda.py#L17',local:'E:/code/vllm-ascend/vllm_ascend/ops/kda.py:17'},
      {id:'kda_recurrence',label:'KDA recurrent kernel：衰减、delta correction、状态读取',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f/vllm_ascend/ops/triton/kda/fused_recurrent_kda.py#L115',local:'E:/code/vllm-ascend/vllm_ascend/ops/triton/kda/fused_recurrent_kda.py:115'},
      {id:'mla',label:'MultiHeadLatentAttention：latent split、NoPE 与 sigmoid gate',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/nvidia/mla.py#L509',local:'E:/code/vllm/vllm/models/kimi_k3/nvidia/mla.py:509'},
      {id:'asc_mla',label:'Ascend MLA wrapper：主干 use_rope=False 与通用后端',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f/vllm_ascend/models/kimi_k3.py#L389',local:'E:/code/vllm-ascend/vllm_ascend/models/kimi_k3.py:389'},
      {id:'asc_moe',label:'AscendKimiMoE：router、latent transforms 与 shared experts',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f/vllm_ascend/models/kimi_k3.py#L259',local:'E:/code/vllm-ascend/vllm_ascend/models/kimi_k3.py:259'},
      {id:'nv_moe',label:'KimiMoE.forward：路由与 latent expert 执行',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/nvidia/model.py#L817',local:'E:/code/vllm/vllm/models/kimi_k3/nvidia/model.py:817'},
      {id:'routed_transform',label:'RoutedOutputTransform：输出 latent Norm 后 up projection',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/amd/linear.py#L136',local:'E:/code/vllm/vllm/models/kimi_k3/amd/linear.py:136'},
      {id:'expert_mlp',label:'KimiMLP：gate_up→SiTU-and-mul→down',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/amd/linear.py#L98',local:'E:/code/vllm/vllm/models/kimi_k3/amd/linear.py:98'},
      {id:'vision',label:'MoonViT3d：patch、encoder、temporal/spatial merge',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/model_executor/models/kimi_k25_vit.py#L647',local:'E:/code/vllm/vllm/model_executor/models/kimi_k25_vit.py:647'},
      {id:'projector',label:'PatchMergerV2：4096→GELU→7168→RMSNorm',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/model_executor/models/kimi_k25_vit.py#L884',local:'E:/code/vllm/vllm/model_executor/models/kimi_k25_vit.py:884'},
      {id:'mm',label:'KimiK3 多模态输入与 language_model.forward',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/nvidia/model.py#L2088',local:'E:/code/vllm/vllm/models/kimi_k3/nvidia/model.py:2088'},
      {id:'asc_vision',label:'Ascend 视觉组件装配与可选输出旋转',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f/vllm_ascend/models/kimi_k3.py#L1306',local:'E:/code/vllm-ascend/vllm_ascend/models/kimi_k3.py:1306'},
      {id:'head',label:'compute_logits：最终 Norm 后调用 LM head',url:'https://github.com/vllm-project/vllm/blob/295c062db8/vllm/models/kimi_k3/nvidia/model.py#L1689',local:'E:/code/vllm/vllm/models/kimi_k3/nvidia/model.py:1689'}
    ],
    root:'overview', components
  };
})();
