/* Llama 2 7B: basic causal MHA + Dense SwiGLU, based on the owning vLLM forward. */
(() => {
  'use strict';
  const rev='295c062db8a48ea73bbd05d1174cb37d24bf86f9';
  const hf='01c7f73d771dfac7d292323805ebc428287df4f9';
  const gh=(file,line)=>`https://github.com/vllm-project/vllm/blob/${rev}/${file}#L${line}`;
  const file='vllm/model_executor/models/llama.py';
  const n=(id,label,detail,kind,col,row,target,description)=>({id,label,detail,kind,col,row,...target?{target}:{},description});
  const e=(from,to,label,step,optional=false)=>({from,to,label,step,optional});
  const components={};
  function add(id,title,parent,intro,inputs,outputs,nodes,edges,sources,notes=[]){
    const rows=[...new Set(nodes.map(v=>v.row))].sort((a,b)=>a-b);
    components[id]={title,parent,intro:[intro],inputs,outputs,nodes,edges,sources,notes,
      steps:rows.map(row=>({title:nodes.filter(v=>v.row===row).map(v=>v.label).join(' / '),text:nodes.filter(v=>v.row===row).map(v=>v.description).join(' '),focus:nodes.filter(v=>v.row===row).map(v=>v.id)}))};
  }
  const sources=[
    {id:'official',label:'Meta Llama 2 官方参考实现：7B 默认维度、MHA、RoPE、SwiGLU',url:'https://github.com/meta-llama/llama/blob/llama_v2/llama/model.py'},
    {id:'card',label:'Meta 官方模型卡：7B 为 4k 上下文且不使用 GQA',url:'https://github.com/meta-llama/llama/blob/main/MODEL_CARD.md'},
    {id:'paper',label:'Llama 2 论文：Transformer、RMSNorm、SwiGLU、32k tokenizer',url:'https://arxiv.org/html/2307.09288v2#S2.SS2'},
    {id:'checkpoint',label:'官方 Llama-2-7b-hf 仓库身份与 revision（配置下载需授权）',url:'https://huggingface.co/api/models/meta-llama/Llama-2-7b-hf'},
    {id:'forward',label:'LlamaModel.forward：embedding → 32 layers → final Norm',url:gh(file,406),local:`E:/code/vllm/${file}:406–454`},
    {id:'block',label:'LlamaDecoderLayer.forward：branch/residual 与融合加法',url:gh(file,313),local:`E:/code/vllm/${file}:313–333`},
    {id:'attention',label:'LlamaAttention.forward：QKV → RoPE → Attention → o_proj',url:gh(file,125),local:`E:/code/vllm/${file}:125–249；forward:224–234`},
    {id:'mlp',label:'LlamaMLP.forward：合并 gate/up 投影与 SiLU 乘法',url:gh(file,82),local:`E:/code/vllm/${file}:82–122`},
    {id:'embed',label:'VocabParallelEmbedding.forward：本轮 ID 查参数表',url:gh('vllm/model_executor/layers/vocab_parallel_embedding.py',518),local:'E:/code/vllm/vllm/model_executor/layers/vocab_parallel_embedding.py:518；unquantized embedding:84–85'},
    {id:'norm',label:'RMSNorm / fused_add_rms_norm 的数学定义',url:gh('vllm/ir/ops/layernorm.py',10),local:'E:/code/vllm/vllm/ir/ops/layernorm.py:10–21、44–63；layers/layernorm.py:74–94'},
    {id:'rope',label:'RoPE：positions 查 cos/sin，分别旋转 Q/K',url:gh('vllm/model_executor/layers/rotary_embedding/base.py',160),local:'E:/code/vllm/vllm/model_executor/layers/rotary_embedding/base.py:80–103、160–218'},
    {id:'cache',label:'Attention：缓存对象、ForwardContext 与 KV 更新',url:gh('vllm/model_executor/layers/attention/attention.py',488),local:'E:/code/vllm/vllm/model_executor/layers/attention/attention.py:488–582、696–743、782–789'},
    {id:'silu',label:'SiluAndMul：gate 激活乘 up 分支',url:gh('vllm/model_executor/layers/activation.py',116),local:'E:/code/vllm/vllm/model_executor/layers/activation.py:116–145'},
    {id:'head',label:'LlamaForCausalLM：独立 LM head 与 compute_logits',url:gh(file,484),local:`E:/code/vllm/${file}:484–518、534–560`},
    {id:'logits',label:'LogitsProcessor：hidden 到 vocabulary logits',url:gh('vllm/model_executor/layers/logits_processor.py',101),local:'E:/code/vllm/vllm/model_executor/layers/logits_processor.py:101–128'},
    {id:'runner',label:'GPU runner：选定 hidden 行 → compute_logits → sampler',url:gh('vllm/v1/worker/gpu/model_runner.py',1590),local:'E:/code/vllm/vllm/v1/worker/gpu/model_runner.py:1590–1627'}
  ];

  add('overview','基础主线：文本 → 32 层 → 下一 token',null,
    '选用 Llama 2 7B 作为最基础的 decoder-only 示例：每层都用普通多头因果注意力（MHA）与 Dense SwiGLU。先看 hidden 主线，再进入 Q/K/V、缓存、残差和输出头。图示使用单个请求 T=4；S 是此前已缓存 token 数。',
    'Tokenizer / runner 提供 input_ids [T]、positions [T]、请求有效长度与缓存元数据；checkpoint 加载 embedding、各层投影 / Norm / FFN 和 LM head 参数。默认示例 T=4、无 TP 切分。',
    '模型 forward 返回最终 normalized hidden [T,4096]；runner 选择预测位置得到 logits [N,32000]，外部 sampler 选新 token。确认 ID 与新的 position 进入下一轮。',[
      n('embed','Token 查表','IDs [4] → h [4,4096]','tokens',0,0,'embedding','Tokenizer 把文本转为 ID，runner 打包本轮 IDs；embedding 用这些索引读取参数表行，生成送往 L0 的 hidden。'),
      n('metadata','位置与历史 KV','positions / 每层独立 K、V','cache',1,0,'kv_cache','Runner 提供 positions、有效长度、块表 / 槽位；各 Attention 层持有自己此前写入的 K/V，当前层读取它们而非跨层共用一张 KV。'),
      n('stack','Causal Decoder ×32','L0–31：MHA + Dense FFN','stack',0,1,'decoderstack','32 层顺序更新 token hidden；每层使用自己的权重与历史 KV。实现将 FFN branch 和 residual 分开返回，下一层 Norm 时接续加回。'),
      n('head','最终 Norm 与 LM head','hidden [T,4096] → logits','logits',0,2,'head','最后一层 FFN branch 先与 residual 相加并做最终 RMSNorm；forward 返回 hidden，随后 runner 调用 compute_logits 投影到32000维词表。'),
      n('sample','选择下一 token','logits + 策略 → ID','sample',0,3,'head','普通生成由外部 sampler 根据温度等策略选择 token。预填充4个 token 时通常取最后位置预测第5个，采样的 ID 尚未经过 embedding / KV 计算。'),
      n('next','进入下一轮','新 ID / position，复用旧 KV','state',0,4,'kv_cache','新 ID 在下一轮查 embedding，经过相同32层；各层只新增这个位置的 K/V，并读取已有历史，继续产生后续 token。')
    ],[e('embed','stack','h [T,4096]',2),e('metadata','stack','positions + 当前层历史 KV / 元数据',2),e('stack','head','末层 FFN branch + residual',3),e('head','sample','选定位置 logits [N,32000]',4),e('sample','next','新 token ID；更新生成状态',5),e('next','embed','下一轮 input_ids',1),e('next','metadata','新的 position / 有效长度',1)],
    ['official','card','paper','forward','head','runner','cache'],
    ['这里的 Llama 指 Llama 2 7B：32 个 Q heads、32 个 K/V heads，每头128维。Llama 2 70B 与后续 Llama 版本可能使用 GQA，不能套用本页所有尺寸。',
     '该基础 checkpoint 没有独立 Encoder、MoE、MLA、Engram、mHC 或 DSpark。Prefill / decode 是同一模型的两种执行阶段。',
     `官方 HF API 核对了仓库 revision ${hf}；gated config 未直接下载。尺寸由 Meta 公开参考实现、模型卡和论文交叉核对，forward 以 vLLM ${rev.slice(0,8)} 为据。参考代码 max_seq_len=2048 是运行缓冲默认值，模型卡的训练上下文是4k。`,
     '图展示未分片的逻辑张量；未运行模型或测量 GPU/NPU 性能。箭头所画数学步骤不等于实际 kernel 数量。']);

  add('embedding','Embedding：ID 怎样变成向量','overview',
    'ID 是词表行号，不是4096维向量。Embedding 对每个 token 读一行学习参数，词序信息则由另一条 positions 分支在 Attention 内引入。',
    'Tokenizer 输出的本轮 IDs [4]；已加载 embedding 权重 E [32000,4096]；或调用方直接提供 inputs_embeds [4,4096]。',
    'h0 [4,4096] → L0 input_layernorm，同时保留作首层 residual；positions [4] 另由 runner 传给各层 RoPE，不加到 embedding 上。',[
      n('ids','上游 token IDs','例如 t0、t1、t2、t3','tokens',0,0,null,'上游 tokenizer 决定每个文本片段的词表 ID；runner 按本轮顺序提供 input_ids [4]，作为 embedding 查行地址。'),
      n('table','学习的参数表 E','[32000,4096]','cache',1,0,null,'模型加载阶段把 checkpoint 的 token embedding 参数放入 E；forward 读取选中的行，不在线更新参数。'),
      n('gather','逐 ID 读取一行','h0[i,:] = E[id_i,:]','gather',0,1,null,'第i个 token ID 读取 E 对应行；4个 ID 产生4行，每行4096个特征，按输入顺序组成 h0。'),
      n('external','可选 inputs_embeds','调用方直接传 [4,4096]','state',1,1,null,'若 LlamaModel.forward 收到 inputs_embeds，则以它替代本次 embedding 查表结果；这是一种接口入口，不说明本模型自带视觉塔。'),
      n('residual','建立首层 residual','h0 [4,4096]','streams',0,2,'block','L0 的 residual 初始为 None；进入首层时将 h0 保留下来，RMSNorm(h0) 进入 Attention，原 h0 用于第一次 residual add。'),
      n('positions','平行的位置输入','runner → positions [4]','state',1,2,null,'positions 表示这些 token 在请求序列中的绝对位置；它送给每层 RoPE，不能画成把一个位置 embedding 向量加到 h0。'),
      n('rotary','各层 RoPE 的输入','positions 随层调用传递','selection',1,3,'rope','同一组绝对 positions 随模型层循环传给各层 Attention；每层在自己的 Q/K 上应用该位置旋转，embedding 本身不消费它。')
    ],[e('ids','gather','词表行索引 [4]',2),e('table','gather','固定 E 参数',2),e('gather','residual','h0 [4,4096]',3),e('external','residual','替代查表的 inputs_embeds',3,true),e('positions','rotary','positions [T]，独立于 embedding',4)],
    ['paper','forward','embed','block','rope'],['词表32000由官方 tokenizer 说明确定；图上 t0…t3 是符号，不是假造的真实编码结果。','Embedding 与 LM head 是不同参数表。本文 xWᵀ 使用 PyTorch [out,in] 权重约定。']);

  add('decoderstack','32 层如何依次传递 hidden','overview',
    '所有层结构相同，参数和 KV cache 各自独立。为了读清主线，把中间层分组显示；L0–31 每层都实际执行 Attention 和完整 Dense FFN。',
    '首层 h0 [T,4096]；positions；32层各自的权重与历史 K/V；若做 PP，中间 stage 接收 branch / residual，这里画未分 PP 的逻辑链。',
    'L31 的 FFN branch f31 [T,4096] 与 Attention 后 residual r31 [T,4096] → 最终 fused add + RMSNorm，得到模型 forward 返回值。',[
      n('input','Embedding 输入','h0 [4,4096]；residual=None','tokens',0,0,'embedding','Embedding 提供 h0；首层尚无分离的 residual，由 L0 入口建立它。'),
      n('first','L0：首个 block','RMSNorm → MHA → FFN','stack',0,1,'block','L0 保留 h0，完成 Attention 残差更新并计算 FFN；返回 f0 与 r0，数学上的下一层 hidden 是 f0+r0。'),
      n('middle1','L1–15：重复相同结构','每层独立权重、独立 KV','stack',0,2,'block','每层 input_layernorm 先接续加回上一层 FFN，再归一化供本层 Attention；输出新的 FFN branch/residual 给后层。'),
      n('middle2','L16–30：继续更新','仍为 MHA + Dense SwiGLU','stack',0,3,'block','后半主干保持相同的因果 Attention 与 Dense FFN，hidden 宽度始终4096；只有内容和各层状态持续变化。'),
      n('last','L31：最后一个 block','返回 f31 与 r31','stack',0,4,'block','最后一层也不在返回前单独物化 FFN residual sum；f31 与 r31 交给模型末端的 Norm。'),
      n('final','最终 add + RMSNorm','RMSNorm(f31 + r31)','gather',0,5,'head','模型末端 self.norm(hidden_states,residual) 加回最后 FFN branch 并归一化，产生 [T,4096] 给 runner。')
    ],[e('input','first','h0；positions 独立传入',2),e('first','middle1','f0 + r0（分离传递）',3),e('middle1','middle2','f15 / r15',4),e('middle2','last','f30 / r30',5),e('last','final','f31 / r31',6)],
    ['official','forward','block'],['分组只为缩短图，不是把15层并行成一次操作；不存在 Encoder/Decoder 两段结构。']);

  add('block','一个 block：两次残差相加','decoderstack',
    '数学上 h′ = h + Attention(RMSNorm(h))，h_next = h′ + FFN(RMSNorm(h′))。本地 vLLM 把第二次相加推迟到下一层入口（最后层则在模型末 Norm），以便与 RMSNorm 融合。图同时标出数学边界与实际返回字段。',
    'L0 接收 embedding h0，residual=None；其余层接收上一层 FFN branch f_prev 和 residual r_prev，各 [T,4096]。另有 positions、当前层 cache / 权重。',
    '当前层实际返回 (f,r)：f 是 FFN 输出，r 是 h+attn_out。下一层 input_layernorm 或模型最终 Norm 接续计算 f+r；逻辑层输出 h_next=f+r。',[
      n('input','接收 branch / residual','L0 特例：只有 embedding','streams',0,0,null,'来自上一层的 hidden_states 是 FFN branch，residual 是上次 Attention 后的主干值；L0 则只有 embedding，没有待加回的 FFN。'),
      n('entry','还原本层 h','h = f_prev + r_prev','sum',0,1,null,'非首层先把两份 [T,4096] 相加得到本层完整 hidden h；这就是上一层的第二次 residual add，实际与本层 input RMSNorm 融合。L0 直接令 h=embedding。'),
      n('norm1','Attention RMSNorm','x = RMSNorm(h)','gather',0,2,'rmsnorm','对 h 的每个 token 沿4096特征维归一化，得到 x 供本层 Attention；未归一化 h 保留作残差。'),
      n('attn','多头因果 Attention','x → a [T,4096]','attention',0,3,'attention','x 生成 Q/K/V，结合 positions 与本层历史 KV 做因果注意力，再 o_proj 得 a，返回本层残差加法。'),
      n('add1','第一次 residual add','r = h + a','sum',0,4,null,'保留的 h 加 Attention 输出 a 得 r；vLLM 将这次相加和 post_attention_layernorm 融合，但 r 本身仍作为未归一化残差保留。'),
      n('norm2','FFN RMSNorm','z = RMSNorm(r)','gather',0,5,'rmsnorm','post_attention_layernorm 用独立的学习 scale 归一化 r，得到 z 交给 Dense FFN；r 不会被 z 替换。'),
      n('ffn','Dense SwiGLU','z → f [T,4096]','shared',0,6,'dense','所有 token 执行同一套本层 gate/up/down 投影，输出 f；没有 router、TopK 专家选择或 shared/routed 分路。'),
      n('return','本层实际返回','hidden_states=f，residual=r','streams',0,7,null,'LlamaDecoderLayer.forward 返回 f 与 r 两个字段；它们表示待相加的主干两部分，不是 mHC 的多条 residual stream。'),
      n('add2','第二次 add：延后执行','h_next = f + r','sum',0,8,'rmsnorm','下一层 input_layernorm（若本层是L31则最终 Norm）接续执行 f+r 并归一化。图中这是跨调用边界的第二次残差相加。')
    ],[e('input','entry','上一层 f_prev / r_prev',2),e('entry','norm1','完整 h [T,4096]',3),e('norm1','attn','normalized x [T,4096]',4),e('attn','add1','Attention 输出 a',5),e('entry','add1','保留的 h',5),e('add1','norm2','r=h+a',6),e('norm2','ffn','normalized z',7),e('ffn','return','FFN branch f',8),e('add1','return','保留 residual r',8),e('return','add2','两份待相加的 [T,4096]',9)],
    ['block','norm','attention','mlp'],['本图的 add 与 Norm 拆分是数学展开；本地 fused_add_rms_norm 同时返回归一化结果及更新的 residual。','每个 Norm 的 scale 是不同 checkpoint 参数；不是反复使用全模型唯一一组 Norm 权重。']);

  add('attention','MHA：Q、K、V 到底怎样使用','block',
    '本配置有32个 Q heads 和32个 K/V heads，每头128维；第h个 Q head 使用第h个 K/V head，没有 GQA 共享。下面将融合注意力展开为打分、因果屏蔽、softmax 和 V 加权，方便追踪数学含义。',
    'Attention RMSNorm 输出 x [T,4096]；当前层 Wq/Wk/Wv/Wo；positions [T]；本层历史 K/V 各 [S,32,128]；请求长度、块表与 slot metadata。',
    'Attention 输出 a [T,4096] → 本层第一次 residual add；本轮旋转后的 K 与未旋转 V 写入该层 cache，供后续轮次使用。',[
      n('x','归一化输入 x','[4,4096]','tokens',0,0,null,'本层 input RMSNorm 生成 x；每个 token 的4096维特征分别参与 Q、K、V 三个线性投影。'),
      n('weights','当前层的投影权重','Wq / Wk / Wv / Wo','cache',1,0,null,'checkpoint 提供各 [4096,4096] 的 Q/K/V 与输出投影参数；vLLM 将前三者装入一个 qkv_proj，数学上仍是三个映射。'),
      n('qkv','QKV 投影并拆头','Q、K、V 各 [T,32,128]','gather',0,1,null,'qkv_proj 得 [T,12288]，沿最后维拆成 Q/K/V，再把每份4096拆为32×128；输出三种张量给各自后续路径。'),
      n('rope','对 Q / K 加位置旋转','Qrot、Krot；V 保持原值','selection',0,2,'rope','由 positions 查 cos/sin，按每头维度旋转 Q 和 K；Qrot 用于当前打分，Krot 将进入本层缓存，V 不做 RoPE。'),
      n('cache','本层 KV 写入与读取','旧 S + 当前 T 个 K/V','cache',1,2,'kv_cache','当前 Krot / V 依据 slot_mapping 写入本层请求缓存；Attention 通过元数据读取此前历史及本轮因果可见部分，得到逻辑 Kall/Vall。'),
      n('score','逐头 QKᵀ 打分','scores [32,T,S+T]','attention',0,3,null,'对每个头，用当前 Qrot 与可见历史 Kall 点积，再除以√128；第i行是当前 query 对各 key 位置的相关性分数。'),
      n('mask','位置与因果范围','只允许 key_pos ≤ query_pos','state',2,0,null,'runner 的 positions、有效长度与请求边界送给 RoPE、缓存寻址和因果判断；未来 token 和其他请求的 key 被排除，不能只按物理缓存位置判断可见性。'),
      n('softmax','沿 key 维 softmax','P [32,T,S+T]','selection',0,4,null,'将无效位置屏蔽后，在每个 head/query 的 key 维归一化打分，得到权重 P；每个有效行的权重和为1，随后用于加权 V。'),
      n('value','P 对 V 加权求和','Oheads [T,32,128]','sum',0,5,null,'每个 query/head 以 P 为系数加权历史与当前 Vall 的128维值向量，得到单个128维 head 输出；不是把 K 向量当作最终内容。'),
      n('output','拼头与 o_proj','[T,4096] → a [T,4096]','scatter',0,6,null,'将32个 head 的128维输出合并为4096维，经本层 Wo 投影得到 a，返回 block 与保留的 h 做第一次残差相加。')
    ],[e('x','qkv','x [T,4096]',2),e('weights','qkv','Wq / Wk / Wv 参数',2),e('qkv','rope','Q、K [T,32,128]',3),e('mask','rope','绝对 positions [T]',3),e('qkv','cache','当前 V [T,32,128]',3),e('rope','cache','当前 Krot [T,32,128]',3),e('mask','cache','请求长度 / 块表 / 槽位',3),e('rope','score','当前 Qrot',4),e('cache','score','Kall [S+T,32,128]',4),e('score','softmax','缩放后的 QKᵀ',5),e('mask','softmax','请求内因果有效范围',5),e('softmax','value','权重 P',6),e('cache','value','Vall [S+T,32,128]',6),e('value','output','合并前32个 head 输出',7),e('weights','output','Wo [4096,4096]',7)],
    ['official','attention','cache','rope'],['positions 由 runner 同时传给 RoPE 与 Attention 元数据；本图 cache 子组件详细展开历史、槽位和请求边界来源。','FlashAttention 等后端可边计算边归约，不必显式存储完整 scores/P 或 dense mask。这里展示数学依赖，不声称每个框对应独立分配或 kernel。','S+T 是逻辑候选 KV 范围；本轮较早 query 不能看到同轮更晚 token。']);

  add('rope','RoPE：位置怎样改变 Q / K','attention',
    'RoPE 通过位置相关旋转影响 Q 与 K 的点积。它不把位置 embedding 加到 token hidden，也不对 V 做同样旋转。',
    '本层未旋转 Q/K 各 [T,32,128]；runner 的 positions [T]；根据 theta=10000、head_dim=128 初始化的 cos/sin 表。',
    'Qrot [T,32,128] → 当前 Attention 打分；Krot [T,32,128] → 本层 KV cache。V 沿原分支进入缓存 / 加权求和。',[
      n('qk','来自 QKV 投影','Q、K 各 [4,32,128]','tokens',0,0,null,'qkv_proj 分离后的 Q、K 尚未携带 RoPE 旋转；它们分别进入同一种位置变换，但向量数值与参数来源不同。'),
      n('positions','绝对 positions','例如0、1、2、3；续写为4','state',1,0,null,'runner 给出每个 token 在自身请求中的序列位置；decode 的新 token 用延续的位置，不能每轮都从0重新开始。'),
      n('angles','频率 / cos / sin 表','θⱼ = 10000^(−2j/128)','cache',1,1,null,'初始化以固定基底10000生成每对维度的频率，再为各 position 计算 cos(pθj)、sin(pθj)；这是非学习的旋转表，不是 Attention KV。'),
      n('gather','按 position 查旋转参数','每 token 对应64组 cos/sin','gather',0,2,null,'用 positions 在 cos/sin 缓冲中查行，为本轮各 token 的64对旋转维度提供角度参数，供 Q 与 K 同时使用。'),
      n('rotate','逐对二维旋转','(u,v) → (u cos−v sin,u sin+v cos)','selection',0,3,null,'将每头128维按实现约定配成64对，用同一 token 的角度分别旋转 Q/K。vLLM HF 路径采用 NeoX 半维配对布局；转换后的权重与布局一致。'),
      n('qout','Qrot 的消费者','当前 query → QKᵀ 打分','attention',0,4,'attention','旋转后的 Q 仅参与当前位置的 Attention；标准自回归 KV cache 不需要保存历史 Q。'),
      n('kout','Krot 的消费者','写本层 KV → 本轮及未来读取','cache',1,4,'kv_cache','旋转后的 K 写入对应序列位置，后续 query 可以按自己的 position 与该历史 K 点积；V 通过另一条未旋转分支提供值。')
    ],[e('positions','gather','本轮 positions [T]',3),e('angles','gather','cos/sin 初始化表',3),e('qk','rotate','Q / K 的每头128维',4),e('gather','rotate','按位置选出的 cos/sin',4),e('rotate','qout','Qrot [T,32,128]',5),e('rotate','kout','Krot [T,32,128]',5)],
    ['official','rope','attention'],['二维旋转公式说明数学语义；相邻复数布局与 HF 的半维配对布局不能直接混用索引，权重转换会匹配布局。','RoPE 表与 checkpoint 权重、请求的 K/V cache 是三种不同状态来源。']);

  add('kv_cache','KV cache：Prefill 与 Decode 的共同记忆','overview',
    '每一层缓存自己的 K/V。以单请求为例：Prefill 处理4个 prompt token，建立4个位置；随后 decode 处理一个新 token，新增一个位置并读取前4个位置。相同模型、不同 T 和 S，不是另一个 Decoder 网络。',
    '本层当前 Krot/V 各 [T,32,128]；此前该请求该层的 K/V [S,32,128]；runner 提供 positions、请求长度、block table、slot_mapping；当前 Qrot [T,32,128]。',
    '有效 Kall/Vall 的逻辑形状为 [S+T,32,128]，供当前层 Attention；更新后的缓存保留给后续轮次。图不把逻辑序列布局等同于实际 paged-cache 字节布局。',[
      n('current','当前层的新 K / V','Krot 与 V [T,32,128]','tokens',0,0,'attention','本层 QKV 投影产生 V，RoPE 产生 Krot；只把 K/V 作为新的缓存内容，Q 用完即交出当前输出。'),
      n('old','以前轮次保存的内容','本请求、本层历史 K/V','cache',1,0,null,'此前该层 forward 写入 S 个有效位置的 Krot/V。不同层用不同权重生成不同缓存，不从上一层直接搬来同一份 K/V。'),
      n('meta','Runner 管理的映射','positions / 长度 / block / slot','state',1,1,null,'Runner 在 forward context 中设置请求范围和层对应 slot_mapping，负责逻辑 token 到实际缓存槽位的定位；这些元数据不是 K/V 张量本身。'),
      n('write','写入当前 token 槽位','本层 cache ← 新 Krot / V','scatter',0,2,null,'Attention 层读取自己的 cache 对象和槽位映射，将本轮 Krot/V 写入相应位置。后端可把写入融合进 Attention，或通过独立更新算子建立先后依赖。'),
      n('read','按请求读可见历史','Kall / Vall + causal 范围','gather',0,3,null,'通过请求 block table、有效长度与 query 位置读取已有和新写入的 K/V；逻辑总长度 S+T，但每个 query 仅访问自己的因果前缀。'),
      n('query','当前 Qrot','本轮 query [T,32,128]','tokens',1,3,null,'当前层的 Qrot 是读取这份 cache 的查询；它来自本轮 hidden，不是从历史 KV 反推得到，也不会追加到 KV cache。'),
      n('attention','当前 Attention 消费','Qrot + Kall / Vall → heads','attention',0,4,'attention','当前 Q 与可见 K 打分、softmax 后加权 V；输出返回当前 block，cache 则继续存在。'),
      n('future','后续轮次继续复用','S ← S+T；下一 query 位置递增','state',0,5,null,'此次有效 K/V 留给下一轮同一层；新采样 token 只有在下一次 forward 计算后才拥有自己的 K/V，不能在采样那一刻凭空生成 cache。')
    ],[e('current','write','当前 Krot / V',3),e('meta','write','当前层 slot_mapping',3),e('old','write','已有 cache 存储对象',3),e('write','read','更新后的本层缓存',4),e('meta','read','请求块表 / 有效长度 / positions',4),e('read','attention','因果可见 Kall / Vall',5),e('query','attention','Qrot',5),e('write','future','保留下来的有效 K/V',6),e('future','old','下一轮的历史部分',1)],
    ['attention','cache','forward'],['无缓存命中的初次 prefill：T=4，S=0，逻辑新 K/V 各 [4,32,128]，4个 query 按下三角因果范围读取。','紧接的单 token decode：T=1，S=4，新增 K/V 各 [1,32,128]，当前 query 可读逻辑5个位置。缓存复用、分块 prefill 或多请求调度会改变 T/S，但不改变这条数据依赖。','K/V 以页块、量化或后端专用布局存储时，物理维度可以不同。图中的 [S,32,128] 表示未做 TP 的逻辑内容。']);

  add('rmsnorm','RMSNorm 与融合残差：逐 token 归一化','block',
    'RMSNorm 沿一个 token 的特征维计算均方根，再乘学习 scale。它不减去均值，也不会把不同 token 的 hidden 混在一起。带 residual 时先相加，再进行同一套归一化。',
    '当前 branch x [T,4096]；可选 residual r [T,4096]；该 Norm 独立的 checkpoint scale γ [4096]；epsilon=1e−5。',
    '无 residual：normalized hidden [T,4096]。有 residual：返回 (normalized(x+r), updated_residual=x+r)，前者给 Attention/FFN/LM head，后者供下一次残差相加。',[
      n('x','当前输入 x','branch [T,4096]','tokens',0,0,null,'调用方可以是 embedding、上一层 FFN 或当前 Attention 输出；它提供需要归一化或先加回残差的当前 branch。'),
      n('r','可选 residual r','上游保留的 [T,4096]','streams',1,0,null,'融合路径传入保留的 residual；例如 Attention 后传入层入口 h，下一层入口传入上一层 Attention 后的 r。首次 L0 不需要输入 residual 相加。'),
      n('add','先取待归一化的 u','有 r：u=x+r；否则 u=x','sum',0,1,null,'如果提供 residual，先以高精度求 x+r 并保留更新残差；否则直接处理 x。后续归一化使用 u，输出的 normalized 值不会替代未归一化 residual。'),
      n('scale','独立学习参数 γ','γ [4096]；epsilon=1e−5','cache',1,1,null,'checkpoint 为当前 Norm 提供每个特征一个 scale；Attention Norm、FFN Norm 和 final Norm 各有自己的参数。epsilon 用于数值稳定。'),
      n('mean','平方后沿特征求平均','m = mean(u², hidden_dim)','gather',0,2,null,'对每个 token 的4096个特征平方并平均，得到 [T,1]；此操作不跨 token 归约，也不先减均值。'),
      n('normalize','除 RMS 并乘 γ','y = u / √(m+eps) × γ','scatter',0,3,null,'取 m+epsilon 的平方根倒数，逐特征缩放 u 再乘 γ；得到与输入同形状的 normalized y。'),
      n('out','分别交给两个消费者','y 与可选 updated residual','streams',0,4,null,'normalized y 进入下一个子层；融合路径另将未归一化的 u 作为 residual 返回，供未来残差连接使用。')
    ],[e('x','add','当前 x',2),e('r','add','可选保留的 r',2,true),e('add','mean','u [T,4096]',3),e('mean','normalize','每 token 均方 m [T,1]',4),e('add','normalize','原 u [T,4096]',4),e('scale','normalize','γ [4096] + epsilon',4),e('normalize','out','normalized y [T,4096]',5),e('add','out','融合路径保留 residual=u',5,true)],
    ['block','norm','official'],['当前源码 fused_add_rms_norm 可融合或原地更新；图上的数学步骤不代表发生了多次独立显存往返。']);

  add('dense','Dense SwiGLU：所有 token 都走同一套 FFN','block',
    'Llama 2 7B 的每层 FFN 中间宽度为11008，输入和输出均为4096。gate 是逐特征非线性门，不是 MoE router；每个 token 都执行本层同一套 gate/up/down 参数。',
    'FFN RMSNorm 输出 z [T,4096]；本层 Wgate/Wup 各 [11008,4096]，Wdown [4096,11008]；本配置没有这些投影的 bias。',
    'f = (SiLU(zWgateᵀ) ⊙ zWupᵀ) Wdownᵀ，形状 [T,4096]。f 作为 FFN branch 与未归一化 residual r 分开返回，之后在下一 Norm 加回。',[
      n('z','FFN normalized 输入','z [4,4096]','tokens',0,0,null,'当前 block 的 post_attention_layernorm 生成 z；同一 z 同时交给 gate 与 up 投影，原 residual r 由 block 另外保留。'),
      n('weights','本层 FFN 参数','Wgate / Wup / Wdown','cache',1,0,null,'checkpoint 为每个 layer 提供独立的三组 Dense 参数；本层所有 token 都使用它们，不根据 token 选择不同专家。'),
      n('gate','gate_proj','g = zWgateᵀ [T,11008]','gather',0,1,null,'z 经 gate 权重投影为11008维门分支 g；vLLM 与 up 分支一起装在 gate_up_proj 输出中，之后按最后维拆开。'),
      n('up','up_proj','u = zWupᵀ [T,11008]','gather',1,1,null,'同一 z 经独立 Wup 生成 u；它提供被非线性 gate 逐元素调制的中间内容。'),
      n('silu','SiLU 激活 gate','a = g × sigmoid(g)','selection',0,2,null,'对 gate 分支 g 的每个元素应用 SiLU，得到 a；这里不做 TopK，也不在 token 之间归一化概率。'),
      n('mul','逐元素门控','m = a ⊙ u [T,11008]','sum',0,3,null,'将激活后的 gate a 与 up 分支 u 对应元素相乘，得到仍为11008维的中间激活 m。'),
      n('down','down_proj','f = mWdownᵀ [T,4096]','scatter',0,4,null,'Wdown 将11008维中间激活映回4096维，形成当前 FFN branch f，返回给 block；它尚未与主 residual 相加。'),
      n('return','回到 residual 路径','返回 f；下一 Norm 计算 f+r','streams',0,5,'block','本层返回 f 和旁路的 r；下一层 input RMSNorm 或模型 final Norm 才完成 f+r，保持与 block 图中相同的执行边界。')
    ],[e('z','gate','同一 z [T,4096]',2),e('z','up','同一 z [T,4096]',2),e('weights','gate','Wgate 参数',2),e('weights','up','Wup 参数',2),e('gate','silu','g [T,11008]',3),e('silu','mul','SiLU(g)',4),e('up','mul','u [T,11008]',4),e('mul','down','门控激活 m',5),e('weights','down','Wdown 参数',5),e('down','return','FFN branch f [T,4096]',6)],
    ['official','mlp','silu','block'],['Meta 7B 参考实现从4×4096开始，取2/3后向上对齐到256的倍数，得到11008；这里的形状是该基础模型的配置，不是任意 Llama 都一样。','源码 gate_up_proj 可一次产生 [T,22016]；图把两个数学分支分开，便于看清乘法的两个输入。']);

  add('head','最终 Norm、词表打分与采样','overview',
    '最后一个 Transformer block 结束不意味着已经生成新词。还需补上最后残差、做 final RMSNorm、选择预测位置、投影词表，再由外部 sampler 选择 token。',
    'L31 返回的 FFN branch f31 与 residual r31，各 [T,4096]；final Norm scale；独立 LM head [32000,4096]；runner 的选行索引与采样参数。',
    'forward 返回 normalized hidden [T,4096]；compute_logits 产生所选 N 行 logits [N,32000]；sampler 产生 token IDs 供请求输出及下一轮 embedding，IDs 由 tokenizer 解码为文本。',[
      n('pair','L31 的两个返回字段','f31 / r31 各 [T,4096]','streams',0,0,'block','最后 block 返回 FFN branch 与 Attention 后 residual；此刻还没有把 f31 加回 r31。'),
      n('norm','最后 add + RMSNorm','y = RMSNorm(f31+r31)','gather',0,1,'rmsnorm','LlamaModel 的 final Norm 先合并最后两份状态，再按独立 Norm 参数归一化，得到 y [T,4096]。'),
      n('return','forward 返回 hidden','y [T,4096] → runner','tokens',0,2,null,'LlamaForCausalLM.forward 返回 model_output，不在这里调用 sampler；正常基础路径得到 y，runner 接着决定哪些位置需要 logits。'),
      n('select','选需要预测的行','T 行 → N 行 selected hidden','selection',0,3,null,'Runner 根据本轮请求和采样位置选择 y 的行；单请求4-token prefill 通常取最后一行，单token decode 则取当前行。'),
      n('weight','独立 LM head 权重','Whead [32000,4096]','cache',1,3,null,'LM head 参数由 checkpoint 加载，与输入 embedding 是独立矩阵；它把选中的4096维 hidden 映射为词表32000个候选分数。'),
      n('logits','compute_logits','selected y × Wheadᵀ','logits',0,4,null,'模型的 compute_logits 调用 LogitsProcessor 读取 LM head，输出 [N,32000] logits；分数本身还不是 token ID 或最终概率。'),
      n('params','Runner 预测与采样配置','选行索引 / 采样策略 / RNG','state',1,0,null,'Runner 根据本轮请求生成需要预测的 hidden 行索引，交给选行步骤；请求的 temperature / top-p 等采样配置与随机状态另交 sampler。它们不是模型 forward 的输出。'),
      n('sample','外部 sampler','词表分数 → 新 token ID','sample',0,5,null,'Runner 的 sampler 消费 logits 与采样配置，选出新 token ID；它不是第33个 Transformer block，也不在此刻生成新 token 的 KV。'),
      n('next','文本输出与下一轮','ID → 解码文本 / 后续 embedding','tokens',0,6,'embedding','确认 ID 由 tokenizer 转成输出文本片段，同时加入请求历史；下一次 forward 才将这个 ID 查表并计算该位置各层 K/V。')
    ],[e('pair','norm','f31 + r31',2),e('norm','return','normalized y [T,4096]',3),e('return','select','forward hidden [T,4096]',4),e('params','select','runner 计算的预测行索引',4),e('select','logits','selected y [N,4096]',5),e('weight','logits','Whead 参数',5),e('logits','sample','logits [N,32000]',6),e('params','sample','采样规则与随机状态',6),e('sample','next','新 token IDs',7)],
    ['forward','norm','head','logits','runner','paper'],['本页只画基础普通生成；仓库中可选 Eagle 等适配接口不代表 Llama 2 7B checkpoint 自带独立草稿网络。']);

  window.ARCH_MODELS.llama={
    id:'llama',name:'Llama 2 7B',subtitle:'基础模型 · 32 层 · 标准 MHA · Dense SwiGLU',
    summary:'从最基础的因果 Transformer 开始：token 查表，32 层 RMSNorm → 多头注意力 → Dense FFN，最后经 LM head 和外部采样产生新 token。逐层看清 Q/K/V、RoPE、两次残差相加和历史缓存。',
    checked:'2026-11-05',revision:`vLLM ${rev}；Meta Llama 2 公开实现 / 模型卡 / 论文；HF 仓库元数据 ${hf.slice(0,8)}（未下载 gated config）`,root:'overview',
    stats:[{label:'主干',value:'32 层 / hidden 4096'},{label:'Attention',value:'32 Q heads = 32 KV heads'},{label:'每头 / FFN',value:'128 / 11008'},{label:'词表 / 上下文',value:'32000 / 4096 tokens'}],
    sources,components
  };
})();
