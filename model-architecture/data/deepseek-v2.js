/* Original DeepSeek-V2: official checkpoint + vLLM inference source, not V2-Lite/V3. */
(() => {
  'use strict';
  const rev='295c062db8a48ea73bbd05d1174cb37d24bf86f9';
  const hf='4461458f186c35188585855f28f77af5661ad489';
  const file='vllm/model_executor/models/deepseek_v2.py';
  const gh=(path,line)=>`https://github.com/vllm-project/vllm/blob/${rev}/${path}#L${line}`;
  const n=(id,label,detail,kind,col,row,target,description,extra={})=>({id,label,detail,kind,col,row,...(target?{target}:{}),description,...extra});
  const e=(from,to,label,step,optional=false)=>({from,to,label,step,...(optional?{optional}: {})});
  const s=(title,text,focus)=>({title,text,focus});
  const components={};
  const put=(id,title,parent,intro,inputs,outputs,nodes,edges,steps,sources,notes=[])=>{
    components[id]={title,...(parent?{parent}:{}),intro:[intro],inputs,outputs,nodes,edges,steps,sources,notes};
  };
  put('overview','DeepSeek V2：从文本到下一 token',null,
    '先沿普通 Decoder 的主线读：Embedding → 60 层 → Final RMSNorm → LM head → 外部采样。相对基础 Llama，主要变化在 Attention 内部的 MLA，以及 L1 起的 MoE。本页展开 vLLM 启用 MLA 的压缩缓存路径；T=4 是教学 token 数，S 是包含本轮在内的有效历史长度，逻辑维度省略 TP/EP 切分。',
    'Tokenizer / runner 提供 IDs [T]、positions [T]、请求边界与各层历史缓存；checkpoint 已加载 embedding、60 层参数与独立 LM head。',
    '模型 forward 返回 normalized hidden [T,5120]；runner 选择预测位置并调用 compute_logits 得 [N,102400]，sampler 产生新 token ID，交给请求状态与下一轮输入。',[
      n('embed','文本 IDs → Embedding','[4] → [4,5120]','tokens',0,0,'embedding','上游 tokenizer 产生离散 IDs，runner 组织本轮输入；查 checkpoint embedding 表得到连续向量，送入 L0。'),
      n('history','每层自己的历史缓存','latent 512 + RoPE key 64','cache',1,0,'cache','此前 forward 为每层保存压缩 KV 和位置 key；runner 提供当前请求的有效长度、位置和缓存索引，各层读取自己的历史。'),
      n('stack','顺序执行 60 个 block','L0 Dense；L1–59 MoE','stack',0,1,'decoderstack','单路 hidden 逐层经过两个 RMSNorm、MLA 和 FFN；每层 Attention 写入自身 KV，保留普通 residual add。'),
      n('mla','MLA 低秩注意力','128 heads；KV cache 576维','attention',1,1,'attention','本层 normalized hidden 直接投影出512维 KV latent 和64维位置 key；结合当前 Q 与因果历史得到 Attention 输出，回到该 block。'),
      n('moe','细粒度 MoE','160 选 6 + 2 shared','experts',1,2,'moe','L1–59 的 FFN 将每 token 分给6个路由专家，同时执行2个共享专家；加权合成单个5120维输出，返回普通残差流。',{expertCount:160,selectedExperts:6}),
      n('head','Final Norm 与 LM head','hidden → 102400 词表分数','logits',0,2,'head','L59 返回的 FFN branch 与 residual 在最终 RMSNorm 合并；forward 返回 hidden，compute_logits 随后投影到词表。'),
      n('sample','外部采样与下一轮','logits → token ID → 新位置','sample',0,3,'head','sampler 根据词表分数与采样参数选 token；请求状态记录新 ID，下一轮再经过 embedding，并复用每层已计算的有效历史。')
    ],[e('embed','stack','输入 hidden [4,5120]',2),e('history','stack','positions / 本层有效 cache',2),e('stack','mla','每层 Attention normalized x',2),e('mla','stack','Attention 输出 [4,5120]',2),e('stack','moe','L≥1 的 FFN normalized x',3),e('moe','stack','MoE 输出 [4,5120]',3),e('stack','head','末层 FFN branch + residual',3),e('head','sample','选中位置 logits [N,102400]',4),e('sample','embed','下一轮 token IDs',1)],
    [s('把 ID 变成向量','文本 IDs 查表得到 hidden；positions 与历史缓存由 runner 另行提供。',['embed','history']),s('逐层做注意力','60 层各自从当前 hidden 生成 Q、压缩 KV 与位置 key，再读取本层历史并完成因果 Attention。',['stack','mla']),s('逐层做 FFN，最后归一化','L0 用 Dense FFN，L1–59 用 MoE；普通残差连接贯穿各层，最终合并并 RMSNorm。',['stack','moe','head']),s('选择下一 token','runner 调用 LM head / sampler，新 ID 被请求状态消费并成为后续轮输入。',['sample'])],
    ['config','official','model','block','head'],['这里对应原版 DeepSeek-V2，60层、hidden5120；不是 V2-Lite、V3 或 V4。基础路径不加入 Engram、mHC、DSA indexer 或 DSpark。','图示采用官方 BF16 配置与单请求逻辑；没有运行模型或测量性能。源码的 FP16 防溢出、通信和后端融合分支不等于架构新增模块。']);

  put('embedding','Embedding：ID 与位置各走哪条路','overview',
    'token ID 用来查词向量；位置编号在 Attention 的 RoPE 中使用，不是再查一张绝对位置 embedding 表。两者由 runner 对齐打包。',
    '本轮 IDs [T]、positions [T]；checkpoint 的 E [102400,5120]；也可由调用方直接提供 inputs_embeds [T,5120]。',
    '查表得到 h [T,5120] → L0；positions 与请求/缓存元数据 → 每层 MLA。模型最初 residual=None，L0 将 h 作为初始 residual。',[
      n('ids','Tokenizer / runner IDs','本轮整数 IDs [4]','tokens',0,0,null,'tokenizer 把文本切成 ID；runner 取本轮应计算的位置，并把对应 IDs 送到 embedding 查表。'),
      n('weights','已加载 embedding 表','E [102400,5120]','cache',1,0,null,'checkpoint 加载 E 的全部逻辑词表行；本轮 forward 只读取所需行，权重不会随生成 token 改写。'),
      n('lookup','按 ID gather 行','E[IDs] → h [4,5120]','gather',0,1,null,'对每个 ID 取一行5120维向量，按本轮 token 顺序组成 h；若输入已有 inputs_embeds，则直接采用调用方向量。'),
      n('positions','独立的位置与请求信息','positions / 长度 / cache 索引','state',1,1,null,'runner 保留每 token 的位置与请求边界，并给 Attention 配置缓存读写位置；这些元数据不当作 hidden 向量相加。'),
      n('layer','进入 L0','h → input RMSNorm / residual','stack',0,2,'block','L0 将输入 h 保留为 residual，RMSNorm(h) 送入 MLA；以后层接收上一层传回的 branch/residual。'),
      n('rope','每层 MLA 读取 positions','只旋转 Q/K 的 RoPE 部分','attention',1,2,'attention','各层投影出自己的位置 Q 和 K，再用相同 positions 计算 RoPE；位置 key 进入本层 KV cache。')
    ],[e('ids','lookup','ID 行索引',2),e('weights','lookup','checkpoint E',2),e('lookup','layer','h [4,5120]',3),e('positions','rope','位置编号 / 请求元数据',3)],
    [s('准备 ID 与参数','runner 提供离散 IDs，模型加载阶段已建立 embedding 表。',['ids','weights']),s('查出词向量','ID gather 得到本轮 h；位置、请求边界和缓存索引仍独立保留。',['lookup','positions']),s('交给各自消费者','h 进入 L0，positions 进入每层 MLA 的 RoPE 与因果缓存逻辑。',['layer','rope'])],['config','model','mla']);

  put('decoderstack','60 层：第一层 Dense，之后 MoE','overview',
    '层号从0开始。每层都是因果 Decoder block；没有另一个 Encoder。Attention 结构一致，FFN 类型由 first_k_dense_replace=1 与 moe_layer_freq=1 决定。',
    'Embedding 的 h [T,5120]；positions；60层各自的权重与请求历史 KV；初始 residual=None。',
    'L59 的 FFN branch 与 residual → 最终 RMSNorm；各层更新后的压缩 cache 留给该层下次调用。',[
      n('entry','初始 hidden','h [4,5120]；residual=None','streams',0,0,'embedding','Embedding 产生单路 h，首次进入 L0 时尚无独立 residual 参数。'),
      n('first','L0：MLA + Dense FFN','Dense 5120→12288→5120','stack',0,1,'block','L0 先做 MLA 与 Attention residual add，再运行全 token 共用的 Dense SwiGLU；输出 branch/residual 供 L1。'),
      n('later','L1–59：MLA + MoE','连续59层，各层参数独立','stack',0,2,'block','各层先完成自身 MLA，再将 FFN normalized hidden 送入160选6与2共享专家，逐层传递结果。'),
      n('cache','每层独立 cache','Lℓ 的 latent / key 仅归 Lℓ','cache',1,2,'cache','Lℓ 历史由此前同一层 forward 写入；它既不从 L0 统一产生，也不在所有层之间共享同一份 KV 向量。'),
      n('end','最终 residual 合并','branch + residual → Final Norm','gather',0,3,'head','模型循环结束后，最终 RMSNorm 将 L59 的 FFN branch 加回 residual 再归一化，形成模型返回 hidden。')
    ],[e('entry','first','h [4,5120]',2),e('cache','first','L0 自己的有效历史',2),e('first','cache','本轮 L0 的 latent / 位置 key',2),e('first','later','L0 branch / residual',3),e('cache','later','L1–59 各自的有效历史',3),e('later','cache','本轮 L1–59 新 latent / 位置 key',3),e('later','end','L59 branch / residual',4)],
    [s('开始','第一层接收 embedding hidden。',['entry']),s('第一层用 Dense','L0 的 Attention 是 MLA，FFN 是中间维12288的 Dense SwiGLU。',['first']),s('后59层用 MoE','L1–59 使用各自 MLA cache 和 MoE 参数，逐层更新 hidden。',['later','cache']),s('合并最后残差','最终 Norm 消费最后的 branch/residual，而不是直接把尚未相加的 branch 交给 LM head。',['end'])],['config','block','model'],['若使用 PP，实际进程只循环所属层并传 IntermediateTensors；本图展示完整逻辑60层，不把设备间传递混入基础架构。']);

  put('block','一个 block：两次 Norm 与两条残差','decoderstack',
    '按数学等价顺序画两次 residual add，方便从输入一路跟踪到输出。当前 vLLM 为融合 Add+RMSNorm，将 FFN 输出保留为 branch，延后到下一层 input_layernorm（末层到 final norm）再加回 residual。',
    '本层有效输入 u [T,5120]：L0 来自 embedding，其余层为上一 branch+residual；本层 Norm/MLA/FFN 权重；positions 与本层缓存。',
    '语义上 u_next = (u + MLA(RMSNorm(u))) + FFN(RMSNorm(u + MLA(...)))；源码返回 FFN branch 与 Attention 后 residual，交下一层融合相加。',[
      n('u','本层输入 u','语义 hidden [4,5120]','streams',0,0,null,'L0 的 u 是 embedding；其他层由上一 FFN branch 与 residual 相加得到。u 同时进入 Norm，并保留给 Attention residual add。'),
      n('norm1','Attention RMSNorm','u → normalized x','gather',0,1,null,'对每个token计算 u / √(mean(u²)+1e−6)，再逐元素乘checkpoint的γ；结果供MLA，原u沿残差支路保留。这不是减均值的LayerNorm。'),
      n('attention','MLA','x + 历史 → attn_out','attention',0,2,'attention','本层 MLA 从 normalized x 生成 Q、压缩 KV 和位置 key，读取因果历史，返回 attn_out [4,5120]。'),
      n('add1','第一次残差相加','r = u + attn_out','sum',0,3,null,'保留的 u 与 Attention 输出逐元素相加得到 r；r 是 FFN 归一化的输入，也是第二条残差支路。'),
      n('norm2','FFN RMSNorm','r → normalized f','gather',0,4,null,'post_attention_layernorm 融合残差相加与 r / √(mean(r²)+1e−6) ⊙ γ；使用它自己的γ。归一化f送本层FFN，未归一化r继续保留。'),
      n('dense','L0：Dense SwiGLU','中间宽度12288','shared',0,5,'ffn','只有第一层使用 Dense FFN；全部 token 使用同一组 gate/up/down 权重，输出 branch [4,5120]。'),
      n('moe','L1–59：MoE','160选6 + 2 shared','experts',1,5,'moe','从第二层开始，normalized f 由路由与共享专家处理，合成为 FFN branch [4,5120]。',{expertCount:160,selectedExperts:6}),
      n('add2','第二次残差相加','u_next = r + branch','sum',0,6,null,'数学上把 FFN 输出加回 r；源码将 branch/r 成对返回，下一 input RMSNorm 或 final RMSNorm 完成这次相加，语义结果仍是 u_next。')
    ],[e('u','norm1','u [4,5120]',2),e('norm1','attention','normalized x',3),e('attention','add1','attn_out [4,5120]',4),e('u','add1','保留 residual u',4),e('add1','norm2','r [4,5120]',5),e('norm2','dense','L0 的 normalized f',6),e('norm2','moe','L≥1 的 normalized f',6),e('dense','add2','Dense FFN branch',7),e('moe','add2','MoE FFN branch',7),e('add1','add2','保留 residual r',7)],
    [s('恢复本层输入','从 embedding 或上一层 branch/residual 得到本层语义输入 u。',['u']),s('第一次归一化','RMSNorm(u) 供 MLA，同时保留 u。',['norm1']),s('计算 MLA','Attention 返回与 hidden 同宽的单路结果。',['attention']),s('更新 Attention 残差','u + attn_out 得到 r。',['add1']),s('第二次归一化','RMSNorm(r) 供 FFN，同时保留 r。',['norm2']),s('按层号选 FFN','L0 Dense，其余59层 MoE；两条画线表示配置二选一。',['dense','moe']),s('更新 FFN 残差','FFN branch 加回 r，实际 vLLM 在下一 Norm 中融合此加法。',['add2'])],['block','norm','config'],['官方 BF16 下走本图主线；当前通用源码还有 FP16 防溢出缩放分支，不能把该特殊实现缩放误画成所有 dtype 必经的额外模型层。']);

  put('attention','MLA：Q、压缩 KV 与 RoPE 分开看','block',
    '低秩 latent 是直接从当前 normalized hidden 投影产生的，不是先计算完整 K/V 再压缩。Q 的128维 noPE部分不做旋转；只有64维位置部分做 RoPE。所有层保留完整因果历史的低秩表示，没有 V3.2/V4 的 TopK 稀疏索引器。',
    '本层 input RMSNorm 输出 x [T,5120]；本层投影/Norm/RoPE 参数；positions [T]；此前该层的有效 latent 与位置 key。',
    'Attention 输出 [T,5120] → 本层第一次 residual add；新的 normalized cKV [T,512] 与旋转后的 kR [T,64] → 本层 cache。',[
      n('x','本层 normalized x','[4,5120]','tokens',1,0,null,'本层 input RMSNorm 产生 x；它同时供 Q 下投影、KV联合下投影，权重来自该层 checkpoint。'),
      n('qdown','Q 下投影与 Norm','5120 → 1536','gather',0,1,null,'x 经 q_a_proj 得到1536维 latent，q_a_layernorm 归一化后交 q_b_proj；这是原版 V2 的分支，不使用 Lite 的无 Q-low-rank 配置。'),
      n('kvdown','KV 联合下投影','5120 → 512 + 64','gather',2,1,null,'x 经 kv_a_proj_with_mqa 产生576维输出，拆成512维 cKV 和64维未旋转 kR；cKV 经过自己的 RMSNorm。'),
      n('qsplit','Q 上投影并拆分','128 heads × (128 + 64)','scatter',0,2,null,'normalized Q latent 经 q_b_proj 扩展成128个192维头，拆为 qC [4,128,128] 与 qR [4,128,64]。qC 不旋转。'),
      n('pos','位置来源与 YaRN','runner positions [4]','state',1,2,null,'runner 提供当前绝对位置；官方 YaRN/RoPE 配置决定旋转频率及注意力缩放修正。位置并不是从 hidden 反推出的。'),
      n('kvparts','两份 KV 表示','cKV [4,512]；kR [4,64]','cache',2,2,null,'normalized cKV 代表本 token 各头共享的内容 latent；独立的 kR 代表位置 key。两者后续写入同一层的逻辑压缩缓存。'),
      n('rope','只旋转 qR / kR','qC 与 cKV 保持不旋转','attention',1,3,null,'positions 作用于 qR 和 kR 的64维位置子空间，得到旋转后的 qR/kR；128维 qC 和512维 cKV 不进入 RoPE。'),
      n('cache','写入并读取本层缓存','历史 + 当前 → [S,576]','cache',2,4,'cache','把当前 normalized cKV 和旋转 kR 写入请求对应槽位；与此前历史构成该层可见 KV，实际物理分页/量化格式由后端决定。'),
      n('core','MLA Attention core','当前 Q + 有效历史 → 各头输出','attention',0,4,'mla_compute','当前 qC/qR 与缓存内容进行因果 Attention；可用展开 K/V 或权重吸收的等价算法，输出各头 value 表征。'),
      n('out','拼接 heads → o_proj','128 ×128 → 5120','scatter',0,5,null,'将128个128维 Attention 输出拼接为16384维，再用 o_proj 映射回5120维，交本层 Attention residual add。')
    ],[e('x','qdown','x + Q 下投影参数',2),e('x','kvdown','x + KV 下投影参数',2),e('qdown','qsplit','normalized Q latent [4,1536]',3),e('kvdown','kvparts','cKV 经 Norm；独立 kR',3),e('qsplit','rope','qR [4,128,64]',4),e('kvparts','rope','kR [4,64]',4),e('pos','rope','positions / YaRN 参数',4),e('kvparts','cache','normalized cKV [4,512]',5),e('rope','cache','旋转 kR [4,64]',5),e('qsplit','core','未旋转 qC [4,128,128]',5),e('rope','core','旋转 qR [4,128,64]',5),e('cache','core','有效 cKV / kR 历史',5),e('core','out','每头 output [4,128,128]',6)],
    [s('读取本层 x','Attention 的输入来自 block 内第一次 RMSNorm。',['x']),s('从 x 直接生成低秩表示','Q 与 KV 分别投影，KV 输出中还包含解耦的位置 key。',['qdown','kvdown']),s('拆开内容与位置','Q 上投影为每头 noPE / RoPE 两部分；KV 保留内容 latent 与独立位置 key。',['qsplit','kvparts','pos']),s('应用位置旋转','只旋转 qR / kR，保持内容 latent 可被后续权重吸收。',['rope']),s('读写缓存并做因果 Attention','当前 KV 写入本层缓存；当前 Q 查询该请求有效历史，未来位置被 mask。',['cache','core']),s('返回 hidden 宽度','各头结果经输出投影返回 [4,5120]。',['out'])],['config','mla','mla_math','attn_init'],['当前 vLLM MLA wrapper 可把 Q/KV 下投影及归一化融合；图中拆开的是可追踪的数学数据依赖，不表示固定 kernel 数量。','核心 MLA cache 逻辑每 token 为512+64个值；不能据此对量化、对齐、分页后的实际字节占用作未测量承诺。']);

  put('cache','MLA cache：到底存了什么','attention',
    '一层、一个请求的逻辑缓存由 normalized cKV 和已旋转 kR 组成。它是低秩的内容/位置表示；不会把128个头的完整 K、V 长期各存一份。下面 S 含当前 T 个新位置。',
    '本层新 cKV [T,512]、RoPE(kR) [T,64]；此前该层 cache [S−T,576]；runner 提供位置、有效长度、块表与槽位。',
    '更新后的本层 cache [S,576] → 本层 MLA core；其有效历史供之后轮次复用。当前 Q 只参与本次计算，不作为这份 KV cache 存储。',[
      n('current','本轮新 KV 表示','cKV [4,512] + kR [4,64]','tokens',0,0,'attention','MLA 直接从本轮 x 生成 normalized cKV，并把位置 key 旋转好；这些新记录准备写入本层缓存。'),
      n('old','此前同一层的记录','同一请求 [S−4,576]','cache',1,0,null,'历史记录来自此前同一层的 forward；不同层、不同请求拥有各自有效范围，不能因为位置编号相同就认为是同一物理缓存。'),
      n('metadata','Runner 缓存元数据','positions / length / slots','state',1,1,null,'推理框架为本轮提供逻辑位置与物理缓存槽位映射、请求长度；它决定写入和可见范围，并不是待 Attention 相乘的 KV 向量。'),
      n('write','写入当前记录','逻辑一行 = 512 + 64','scatter',0,1,null,'将 cKV 与已旋转 kR 存到该层、该请求的新位置；图示逻辑拼接，实际存储可按后端分页与打包。'),
      n('valid','有效因果历史','[S,576] = 内容 + 位置','cache',0,2,null,'此前记录加当前记录形成有效历史；prefill 中每个 query 只看此前及自身位置，decode 新 query 读取已有前缀。'),
      n('query','本轮 Q，不长期缓存','qC / qR 来自当前 x','tokens',1,2,null,'当前 Q 来源是该层当前 hidden 的 Q 分支；每轮重新计算，交给 Attention core，不作为长期 KV 历史保存。'),
      n('consume','MLA core 消费','Q + 有效 KV + causal mask','attention',0,3,'mla_compute','按请求边界和因果 mask 读取有效 cache；可临时展开 K/V 或在 latent 空间求 Attention，最终返回各头输出。'),
      n('reuse','留给下一轮','S 更新，已有记录继续有效','state',0,4,null,'已确认请求继续生成时，该层的历史无需重新由旧 token 投影；下一轮只补新 token 的记录，并用新的 query 读取。')
    ],[e('current','write','当前输入 IDs 对应的新 KV',2),e('metadata','write','物理写入槽位',2),e('write','valid','本轮已写记录',3),e('old','valid','此前该层有效记录',3),e('metadata','valid','请求边界 / 有效长度',3),e('valid','consume','内容 latent + 位置 key',4),e('query','consume','当前 qC / qR',4),e('valid','reuse','持久有效 cache 状态',5)],
    [s('区分新数据与历史','新记录由本轮投影产生，旧记录来自此前同一层。',['current','old']),s('根据元数据写 cache','Runner 提供槽位，后端写入本轮 normalized cKV / 旋转 kR。',['write','metadata']),s('确定可见历史','有效长度与因果位置限制本次可读记录，当前 Q 单独准备。',['valid','query']),s('读取计算','MLA core 用当前 Q 查询历史 latent / key，计算本轮 Attention。',['consume']),s('跨轮复用','保留有效记录；后续轮只追加新记录并重算当前 query。',['reuse'])],['mla','cache','mla_math','reference'],['Prefill 与 decode 使用同一组模型参数。区别在本轮 query 数量和历史长度，后端可以因此选择不同等价计算方式。','本轮 cache 写入对应本轮输入 IDs；之后 sampler 刚选出的下一 token 只有 ID，要等它进入后续 forward 才生成自己的 KV。','官方 Transformers 参考实现及 vLLM 的非压缩 fallback 会先展开各头 K/V，再使用其 Attention cache；这里的 [S,576] 专指启用 MLA 的压缩路径，不把参考实现的实际缓存伪称为 latent cache。']);

  put('mla_compute','同一个 MLA：展开计算与权重吸收','attention',
    '两列表示等价的两种计算组织，不是串行做两次 Attention。左列把 latent 临时展开成各头 K/V；右列把 K 的上投影移到 Q 一侧，在512维 latent 空间聚合，再做 V 的上投影。常见后端分别用于较长 prefill 和短 decode，但选择仍受后端、形状与配置影响。',
    '当前 qC [T,128,128]、旋转 qR [T,128,64]；有效 c [S,512]、旋转 kR [S,64]；每头 WUK [512,128]、WUV [512,128]；causal mask 与 YaRN 修正后的 scale。',
    '任一路径都返回每头 value 输出 [T,128,128] → 父图 Attention 的 o_proj。输出投影在父图接续执行；临时完整 K/V 或 latent 聚合值不是新增持久缓存。',[
      n('inputs','共同输入与权重','Q / cKV / kR / WUK / WUV','tokens',1,0,null,'Q 来自当前层投影，c/kR 来自有效 cache，WUK/WUV 来自该层 kv_b_proj 参数；两条数学路径消费同一组值。'),
      n('expand','路径 A：展开 K/V','Kc = cWUK；V = cWUV','scatter',0,1,null,'对每个头用缓存 c 乘该头 WUK/WUV，临时形成 Kc [S,128,128] 与 V [S,128,128]；位置 key kR 仍单独提供。'),
      n('absorb','路径 B：变换 Q','qLatent = qC × WUKᵀ','gather',2,1,null,'把每头 qC 的128维内容 query 与 WUK 的转置相乘，得到 qLatent [T,128,512]；缓存保持 c [S,512]，无需先为每头展开 Kc。'),
      n('score_a','展开空间的分数','qC·Kc + qR·kR','attention',0,2,null,'每头内容点积与位置点积相加，经配置 scale 与 causal mask 后 softmax，得到 Attention 权重 P [T,128,S]。'),
      n('score_b','latent 空间的分数','qLatent·c + qR·kR','attention',2,2,null,'同一内容点积被结合律改写到512维 latent 空间；位置项、scale、mask 和 softmax 相同，因此得到同样语义的 P。'),
      n('mask','位置与缩放依据','causal mask / YaRN scale','state',1,2,null,'请求位置与长度定义 causal mask，RoPE/YaRN 配置决定缩放修正；两路径必须使用一致的可见范围和 scale。'),
      n('value_a','按 P 汇总已展开 V','P × V → [4,128,128]','sum',0,3,null,'Attention 权重对历史各头 V 加权求和，直接得到每头128维输出。'),
      n('value_b','先汇总 latent 再上投影','P × c → 512维 → ×WUV','sum',2,3,null,'先用 P 对512维缓存 c 加权得到 [4,128,512]，再乘每头 WUV 得 [4,128,128]，等价于对已展开 V 加权。'),
      n('out','返回相同形状的各头结果','core output [4,128,128]','scatter',1,4,null,'任一路径都返回128个128维头，交给父图Attention中的o_proj节点；父图随后拼接并投影到5120维，本子图不再执行一次输出投影。')
    ],[e('inputs','expand','cache c + WUK / WUV',2),e('inputs','absorb','qC + WUK',2),e('expand','score_a','临时各头 Kc',3),e('inputs','score_a','qC / qR / kR',3),e('absorb','score_b','qLatent [4,128,512]',3),e('inputs','score_b','c / qR / kR',3),e('mask','score_a','同一 mask 与 scale',3),e('mask','score_b','同一 mask 与 scale',3),e('score_a','value_a','P [4,128,S]',4),e('expand','value_a','临时各头 V',4),e('score_b','value_b','P [4,128,S]',4),e('inputs','value_b','cache c + WUV',4),e('value_a','out','路径 A 的每头结果',5),e('value_b','out','路径 B 的每头结果',5)],
    [s('共享输入','两条路径用同一 Q、有效 latent/key、投影参数及因果约束。',['inputs']),s('选择计算组织','A 展开 K/V；B 把 K 上投影吸收到 Q 变换里，实际后端选其一。',['expand','absorb']),s('计算相同语义的分数','结合律改变点积的位置，不改变内容项与 RoPE 位置项的含义。',['score_a','score_b','mask']),s('计算 value 加权和','A 对已展开 V 加权；B 先聚合 latent 再用 WUV 上投影。',['value_a','value_b']),s('返回父图','两种方式都返回128个128维头，父图的o_proj继续消费它。',['out'])],['mla_math','prefill','attn_init'],['这是实数数学等价与后端组织说明；有限精度、量化和不同 kernel 可能带来数值差异，图不声称逐 bit 相同。','源码中的 q_b_proj 按头包含 Q 内容/位置两部分，kv_b_proj 按头包含 K 内容/V 两部分。Q/KV latent 的 RMSNorm 已在上游执行，本图不再重复计算。']);

  put('moe','MoE：路由专家与共享专家怎样合并','block',
    '路由器只决定哪些专家以及各自权重；被分发的是 normalized hidden 本身。2个共享专家不占6个路由名额，最终与路由输出相加。',
    'FFN RMSNorm 输出 f [T,5120]；本层 router 权重、160组路由专家参数、2组共享专家参数；官方 routing 配置。',
    'Σ(selected 16×softmax_score_i×Expert_i(f)) + Shared1(f) + Shared2(f)，得到 [T,5120] FFN branch → 普通 residual add。',[
      n('f','本层 FFN normalized f','[4,5120]','tokens',0,0,null,'post_attention_layernorm 产生 f；它同时送入 router、选中路由专家和共享专家，不把 gate 分数当作专家输入。'),
      n('weights','本层参数来源','router / routed / shared 权重','cache',1,0,null,'模型加载阶段从 checkpoint 放置各专家与 router 的权重；逻辑专家数量不等于分布式部署后的本 rank 物理专家数。'),
      n('router','分组限选 Router','8组取3组，再从中选6专家','router',0,1,'router','f 经过 router 投影及 softmax 得160个分数，先按组最大值选择3个候选组，再选6个专家和缩放后的权重。'),
      n('routed','被选中的6个专家','每专家 5120→1536→5120','experts',0,2,'ffn','把每个 token 的 f 分给该 token 选中的6个专家，各自执行 SwiGLU，并按对应路由权重汇总。',{expertCount:160,selectedExperts:6}),
      n('shared','始终执行2个共享专家','各1536；可合并为3072宽','shared',1,2,'ffn','共享专家对每个 token 都计算，不需 TopK 选择；本地实现可将两个1536宽 SwiGLU 合为一个3072宽的等价 MLP。'),
      n('sum','合并 routed 与 shared','scaled routed sum + shared sum','sum',0,3,null,'接收 routed 分支已经包含16倍路由权重的加权和，再加两个 shared outputs；这里不再次缩放，形成唯一 FFN branch。'),
      n('residual','返回 block 残差流','FFN branch [4,5120]','streams',0,4,'block','MoE 返回5120维 branch；block 保留 Attention 后 residual，下一 Norm 将 branch 加回，继续下一层。')
    ],[e('f','router','normalized f',2),e('weights','router','router weight / 配置',2),e('router','routed','6个专家 IDs + 16×scores',3),e('f','routed','专家实际输入 f',3),e('f','shared','共享专家实际输入 f',3),e('weights','routed','所选 routed 参数',3),e('weights','shared','shared 参数',3),e('routed','sum','路由加权输出之和',4),e('shared','sum','两个 shared output 之和',4),e('sum','residual','合并 FFN branch',5)],
    [s('准备 hidden 与参数','所有分支消费同一个 normalized f，各自参数由 checkpoint 提供。',['f','weights']),s('生成路由计划','softmax分数先限组再Top6，返回专家IDs与权重。',['router']),s('计算专家','6个选中路由专家与2个共享专家分别运行 SwiGLU。',['routed','shared']),s('按权重合并','路由权重已包含16倍缩放，再把共享结果相加。',['sum']),s('交回残差','MoE 输出的形状与 Dense FFN 相同，都作为单路 branch 返回。',['residual'])],['config','moe','router','dense'],['本图展示逻辑 dispatch / combine，不承诺某个 TP/EP/AllToAll 后端的实际数据搬运方式；本页没有运行分布式推理。']);

  put('router','V2 Router：先限组，再 Top6','moe',
    '原版 V2 使用 softmax 与 group_limited_greedy：160个专家分8组，每组20个；按组内最大分数取3组，再从这些组的专家中选6个。最终实际用到的组数可以少于3。',
    '本层 FFN normalized f [T,5120]；checkpoint router 权重 [160,5120]；n_group=8、topk_group=3、top_k=6、routed_scale=16。',
    '专家 IDs [T,6] 与 mixing weights [T,6] → routed dispatch/combine；权重是选中原 softmax 分数×16，不对这6个分数重新归一化。',[
      n('input','输入 f 与 router 权重','[4,5120] × [5120,160]','tokens',0,0,null,'FFN Norm 的 f 与该层 gate weight 进行线性投影，权重在模型加载时取得。'),
      n('scores','160 路 softmax 分数','scores [4,160]','logits',0,1,null,'router logits 沿160个专家做 softmax，得到原始分数；后续选择和组合权重都以这些分数为依据。'),
      n('groups','分8组，各取最大值','[4,8,20] → [4,8]','selection',0,2,null,'把160个分数视为8组，每组20个，以组内最大分数作为group_score；这是无 correction bias 的V2路径。'),
      n('choose','选择3个候选组','Top3 groups → 允许60个专家','selection',0,3,null,'按8个 group_score 选3组，将其他5组的专家屏蔽；下一步只在允许的60个专家中选。'),
      n('top','在候选中选6个','Top6 expert IDs + 原scores','router',0,4,null,'从保留的原 softmax scores 中取Top6，得到 IDs 和对应分数；并非强制每个候选组固定挑2个。'),
      n('scale','不重归一化，只乘16','weights = selected_scores ×16','gather',0,5,null,'norm_topk_prob=false，所选6项不除以自身总和；routed_scaling_factor=16形成组合权重，供专家结果加权。'),
      n('dispatch','交给专家分发与合并','IDs [4,6] + weights [4,6]','experts',0,6,'moe','专家 IDs 决定每 token 的 f 发给哪些专家；权重在合并专家输出时使用，shared专家另行计算。',{expertCount:160,selectedExperts:6})
    ],[e('input','scores','160路 gate logits',2),e('scores','groups','原 softmax scores',3),e('groups','choose','8个组最大值',4),e('choose','top','允许组 / expert mask',5),e('scores','top','原 softmax scores',5),e('top','scale','6个选中分数',6),e('top','dispatch','6个专家 IDs',7),e('scale','dispatch','16×选中分数',7)],
    [s('做路由投影','normalized f 与 gate 权重生成专家 logits。',['input']),s('生成 softmax 分数','对全部160专家做softmax。',['scores']),s('生成组分数','每组20专家，取组内最大分数。',['groups']),s('先限组','挑出3个候选组，屏蔽其他组。',['choose']),s('再选专家','从候选组内的原分数选6个专家。',['top']),s('设置组合权重','不做Top6重归一化，直接把原选中分数乘16。',['scale']),s('交给 MoE','IDs 控制分发，weights 控制合并。',['dispatch'])],['config','router','moe'],['不要套用 V3 的 noaux_tc：当前 V2 配置没有 e_score_correction_bias，也不用“组内前2分数之和”作为组分数。']);

  put('ffn','Dense / 单个专家：SwiGLU 的内部','block',
    '所有 FFN 都是 gate、up 两支投影与一个 down 投影。差别是中间宽度与谁收到哪些 token：L0 Dense 为12288；单个 routed/shared expert 为1536；2个 shared 可等价合为3072。',
    '已归一化 x [N,5120]；本 MLP 的 Wgate、Wup、Wdown。Dense/shared 的 N 为所处理 token 数，routed 的 N 为被分到该专家的 token 数。',
    '(SiLU(xWgate) ⊙ (xWup)) Wdown [N,5120] → Dense residual branch 或 MoE 的 routed/shared 汇总。',[
      n('x','本 MLP 的 token hidden','x [N,5120]','tokens',0,0,null,'L0 Dense 接收全部本轮 normalized hidden；路由专家只接收被选中 token；共享专家也处理当前token，输入始终是hidden而非router分数。'),
      n('weights','当前 MLP 的参数','Wgate / Wup / Wdown','cache',1,0,null,'checkpoint 为每个 Dense/专家保存独立 gate、up、down 参数；这里把矩阵画成右乘方向，实际存储权重可转置。'),
      n('gate','Gate 线性投影','g = xWgate [N,I]','gather',0,1,null,'x 与 Wgate 投影到中间宽度 I，得到门控激活输入 g；随后先对g应用SiLU。'),
      n('up','Up 线性投影','u = xWup [N,I]','gather',1,1,null,'同一 x 经 Wup 得到内容分支 u；它与SiLU(g)形状一致，供逐元素相乘。'),
      n('multiply','SiLU 与逐元素乘','a = SiLU(g) ⊙ u','sum',0,2,null,'SiLU 仅作用于 gate 分支g，再与u逐元素相乘形成[N,I]；vLLM 的 gate_up_proj 与 SiluAndMul 可融合实现这些语义步骤。'),
      n('down','Down 线性投影','aWdown → [N,5120]','scatter',0,3,null,'down_proj 将中间宽度映射回5120；Dense输出返回block，专家输出交给对应的MoE组合。'),
      n('consumer','交给对应消费者','Dense add / MoE combine','sum',0,4,null,'L0 Dense 输出成为FFN branch；routed输出乘router权重再求和，shared输出直接相加，最后都回到普通残差主干。')
    ],[e('x','gate','x [N,5120]',2),e('x','up','同一个 x',2),e('weights','gate','Wgate',2),e('weights','up','Wup',2),e('gate','multiply','g [N,I]',3),e('up','multiply','u [N,I]',3),e('multiply','down','a [N,I]',4),e('weights','down','Wdown',4),e('down','consumer','MLP 输出 [N,5120]',5)],
    [s('确定输入与权重','token是否到达该专家由上游决定，本页只计算MLP。',['x','weights']),s('两个线性分支','相同x分别生成gate与up。',['gate','up']),s('门控','SiLU(g)与u逐元素相乘。',['multiply']),s('回到hidden宽度','down投影输出5120维。',['down']),s('返回','按Dense或专家身份交给残差加法或MoE汇总。',['consumer'])],['config','dense','moe']);

  put('head','Final Norm、词表投影与外部采样','overview',
    'Transformer forward 结束时拿到的是 hidden，不是文本。最后还要合并残差、归一化，runner 再调用 LM head 得到词表分数，sampler 才选择下一个 ID。',
    'L59 的 FFN branch与residual，各 [T,5120]；最终Norm与独立LM head权重；runner的预测位置选择与采样参数。',
    'forward 返回 hidden [T,5120]；compute_logits 返回 [N,102400]；sampler 产生新 token IDs → 请求输出与后续 embedding。N 为需要预测的选中位置数。',[
      n('branch','L59 FFN branch','未加回的 [4,5120]','tokens',0,0,null,'最后一层MoE输出branch，block返回它时仍把residual单独保留；不能直接把branch当完整hidden送LM head。'),
      n('residual','L59 的 residual','Attention 后的 [4,5120]','streams',1,0,null,'最后一层Attention输出已经加回的residual，经FFN旁路保留，等待与FFN branch相加。'),
      n('norm','合并 + 最终 RMSNorm','Norm(branch + residual)','gather',0,1,null,'final RMSNorm将branch加回residual，再用已加载Norm权重归一化；这是model.forward返回的normalized hidden。'),
      n('selected','Runner 选取预测位置','hidden [N,5120]','selection',0,2,null,'runner依据采样需求选择hidden行；普通prefill常取请求最后位置，decode取当前新位置，不能把T个输入都默认为要同时输出T个新token。'),
      n('weights','独立 LM head 权重','Whead [102400,5120]','cache',1,2,null,'checkpoint加载词表输出矩阵；tie_word_embeddings=false，因此它与输入embedding是不同参数。'),
      n('logits','compute_logits','selected hidden → [N,102400]','logits',0,3,null,'LM head和logits processor将每个选中hidden投影成102400个词表分数；compute_logits是wrapper的独立方法，不在decoder层循环中。'),
      n('params','采样配置 / 随机状态','greedy 或温度等参数','state',1,3,null,'请求采样参数与随机状态由推理框架提供；它们控制如何从logits得到token，属于外部sampler输入。'),
      n('sample','采样下一个 ID','logits + params → token','sample',0,4,null,'外部sampler根据分数和配置选择token ID；其结果交给请求状态，随后可解码为文本。'),
      n('next','更新请求并继续','新 ID / 新 position / 旧 KV','state',0,5,'embedding','新ID进入已生成序列，后续轮由runner安排其embedding与位置；旧token已生成的每层KV继续复用，不需要把整个前缀重新计算。')
    ],[e('branch','norm','FFN branch',2),e('residual','norm','保留 residual',2),e('norm','selected','forward 返回 hidden [4,5120]',3),e('selected','logits','选中 hidden [N,5120]',4),e('weights','logits','LM head 参数',4),e('logits','sample','词表分数 [N,102400]',5),e('params','sample','采样参数 / RNG',5),e('sample','next','新 token ID',6)],
    [s('取最后两份状态','L59的branch与residual还需相加。',['branch','residual']),s('结束model.forward','final Norm返回完整normalized hidden。',['norm']),s('选择预测位置','runner准备待计算logits的hidden行及独立head参数。',['selected','weights']),s('计算词表分数','compute_logits得到每个预测位置的词表分数；采样参数由请求提供。',['logits','params']),s('外部采样','sampler读取分数和参数选择新ID。',['sample']),s('衔接下一轮','请求状态消费ID，安排新位置计算并继续使用历史cache。',['next'])],['model','head','config','norm'],['本页展示基础自回归推理路径；没有把其他系统可附加的外部draft模型当作原版V2内置组件。']);

  window.ARCH_MODELS.deepseek_v2={
    id:'deepseek_v2',name:'DeepSeek V2',subtitle:'基础对照：60层 · MLA · 1 Dense + 59 MoE',
    summary:'以原版 DeepSeek-V2 为例，沿普通 Decoder 主线展开两项变化：MLA 将内容与位置 key 存为512+64维压缩历史；MoE 在第一层之后使用160选6路由专家与2个共享专家。每个组件可继续进入，查看实际张量来源、计算与下一消费者。',
    checked:'2026-11-05',revision:`官方 HF ${hf.slice(0,8)} · vLLM ${rev.slice(0,10)} · 基础 BF16 路径静态分析`,
    stats:[{label:'层数 / hidden',value:'60 / 5120'},{label:'FFN',value:'1 Dense + 59 MoE'},{label:'Attention',value:'128 heads · MLA'},{label:'缓存逻辑宽度',value:'512 latent + 64 RoPE'},{label:'专家',value:'160选6 + 2 shared'}],
    sources:[
      {id:'config',label:'官方 DeepSeek-V2 配置：原版60层、MLA维度与V2路由参数',url:`https://huggingface.co/deepseek-ai/DeepSeek-V2/blob/${hf}/config.json`},
      {id:'official',label:'DeepSeek 官方模型说明：MLA 与 DeepSeekMoE',url:'https://github.com/deepseek-ai/DeepSeek-V2'},
      {id:'reference',label:'官方 Transformers 参考实现：Attention 与 MoE 数学展开',url:`https://huggingface.co/deepseek-ai/DeepSeek-V2/blob/${hf}/modeling_deepseek.py`},
      {id:'model',label:'vLLM Model.forward：embedding、层循环、final RMSNorm',url:gh(file,1508),local:`E:/code/vllm/${file}:1508–1590`},
      {id:'block',label:'DecoderLayer：层型选择与延迟融合 residual add',url:gh(file,1249),local:`E:/code/vllm/${file}:1249–1424`},
      {id:'attn_init',label:'MLA 初始化：Q/KV维度、投影参数与缩放',url:gh(file,1000),local:`E:/code/vllm/${file}:1000–1247`},
      {id:'mla',label:'MLA wrapper.forward：低秩投影、Norm、RoPE、core与输出投影',url:gh('vllm/model_executor/layers/mla.py',163),local:'E:/code/vllm/vllm/model_executor/layers/mla.py:163–256'},
      {id:'mla_math',label:'MLA core 文档：展开MHA与吸收MQA的数学数据流',url:gh('vllm/model_executor/layers/attention/mla_attention.py',25),local:'E:/code/vllm/vllm/model_executor/layers/attention/mla_attention.py:25–144'},
      {id:'cache',label:'MLA cache update：normalized latent 与旋转 key 写入',url:gh('vllm/model_executor/layers/attention/mla_attention.py',1400),local:'E:/code/vllm/vllm/model_executor/layers/attention/mla_attention.py:1400–1450'},
      {id:'prefill',label:'MLA compute-friendly prefill：临时展开 latent 后计算Attention',url:gh('vllm/model_executor/layers/attention/mla_attention.py',3180),local:'E:/code/vllm/vllm/model_executor/layers/attention/mla_attention.py:3180–3270'},
      {id:'moe',label:'DeepseekV2MoE：shared宽度、分组路由配置与experts调用',url:gh(file,291),local:`E:/code/vllm/${file}:291–436`},
      {id:'router',label:'grouped_topk：V2无bias时group max、Top3组、Top6与缩放',url:gh('vllm/model_executor/layers/fused_moe/router/grouped_topk_router.py',84),local:'E:/code/vllm/vllm/model_executor/layers/fused_moe/router/grouped_topk_router.py:84–184'},
      {id:'dense',label:'DeepseekV2MLP：gate/up、SiLU乘法与down',url:gh(file,244),local:`E:/code/vllm/${file}:244–289`},
      {id:'norm',label:'RMSNorm：residual相加、均方根归一化与参数缩放',url:gh('vllm/model_executor/layers/layernorm.py',37),local:'E:/code/vllm/vllm/model_executor/layers/layernorm.py:37–107'},
      {id:'head',label:'模型wrapper：forward返回hidden，compute_logits独立调用',url:gh(file,1965),local:`E:/code/vllm/${file}:1965–1982`}
    ],root:'overview',components
  };
})();
