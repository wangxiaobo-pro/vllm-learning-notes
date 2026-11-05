# Model graph data contract

Each data file is a classic browser script: `window.ARCH_MODELS.<id> = { ... };`.
The loader initializes `window.ARCH_MODELS = {}`. Keep data offline and no network calls.

Model: `{ id, name, subtitle, summary, checked, revision, stats:[{label,value}], sources:[{id,label,url,local?}], root:'overview', components:{ [componentId]: Component } }`.

Component: `{ title, parent?:componentId, intro:[paragraphs], inputs:string, outputs:string, notes:[strings], sources:[sourceIds], nodes:[Node], edges:[Edge], steps:[Step] }`.

Node: `{ id, label, detail, kind, col, row, target?:componentId, description?:string }`.
Use 1–3 columns (col=0,1,2); integer row starting 0. A label should be short (ideally <=16 Chinese characters), detail <=30 chars. Full explanation belongs in `description` and component `intro`.
Kinds: `tokens`, `streams`, `stack`, `gather`, `scatter`, `vision`, `hash`, `cache`, `router`, `experts`, `shared`, `sum`, `attention`, `selection`, `logits`, `sample`, `draft`, `state`, `verify`.
Optional node visual metadata: `{ expertCount, selectedExperts, streamCount }`.

Edge: `{ from, to, label, step, optional?:boolean }`; step is 1-based. Prefer row-adjacent flows; local branching edges are fine. Labels should identify tensors or state, not merely 'next'.

Step: `{ title, text, focus:[nodeIds] }`. Steps must reflect actual call/data flow and explain inputs→operation→outputs. `focus` can include multiple concurrent nodes.

Every major node in overview MUST target a real component. Build detailed components for layer stack, individual block, attention, MoE, embeddings/head, and model-specific modules. Leaf operator nodes may omit target; their description is shown as a detail selection. Components can be shared within one model through target references. All source IDs must resolve. Mark algorithm semantics, source implementation, and teaching example separately. Never invent encoder/decoder splits or speculative support.

Use Chinese explanations, 0-based model layer indices, explicit dimensions and source caveats. Reference checked official configs and owning local functions with line numbers. No model execution or performance claims.
