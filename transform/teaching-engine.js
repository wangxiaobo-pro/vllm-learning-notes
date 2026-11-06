/*
 * A fully calculated, deterministic teaching Transformer.
 * The small fixed parameters below are NOT trained model weights.
 * All intermediate values use JavaScript double precision; round only in the UI.
 * Tensor convention: [batch, token, feature], heads [batch, head, token, feature].
 */
const ToyEngine = (() => {
  'use strict';

  const VOCAB = ['<pad>', '猫', '追', '老鼠', '鸟', '吃', '米', '<eos>'];
  const EXAMPLES = [[1, 2, 3, 7], [4, 5, 6, 7]];
  const EPSILON = 1e-5;
  const HEADS = 2;
  const HEAD_DIM = 4;

  // Fixed arithmetic construction rather than an unseeded random generator.
  // The definition and salt completely determine every visible parameter.
  const matrix = (rows, cols, salt, scale = 0.025) =>
    Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) =>
      (((i + 1) * 13 + (j + 1) * 7 + salt * 11 + (i + 1) * (j + 1) * 3) % 17 - 8) * scale));
  const mapRows = (tensor, fn) => tensor.map(sample => sample.map(fn));
  const dot = (x, y) => x.reduce((sum, value, i) => sum + value * y[i], 0);
  const multiplyRow = (row, weight) => weight[0].map((_, j) =>
    row.reduce((sum, value, i) => sum + value * weight[i][j], 0));
  const linear = (tensor, weight) => mapRows(tensor, row => multiplyRow(row, weight));
  const add = (a, b) => a.map((sample, n) => sample.map((row, t) => row.map((value, d) => value + b[n][t][d])));
  const softmax = row => {
    const max = Math.max(...row);
    const exponentials = row.map(x => Math.exp(x - max));
    const sum = exponentials.reduce((a, b) => a + b, 0);
    return exponentials.map(x => x / sum);
  };
  const silu = value => value / (1 + Math.exp(-value));

  function rmsNorm(input, gamma = Array(8).fill(1), epsilon = EPSILON) {
    const squares = mapRows(input, row => row.map(x => x * x));
    const meanSquare = mapRows(squares, row => [row.reduce((a, b) => a + b, 0) / row.length]);
    const rms = mapRows(meanSquare, row => [Math.sqrt(row[0] + epsilon)]);
    const normalized = input.map((sample, b) => sample.map((row, t) => row.map(x => x / rms[b][t][0])));
    const output = mapRows(normalized, row => row.map((x, d) => x * gamma[d]));
    return { input, squares, meanSquare, rms, normalized, gamma, epsilon, output };
  }

  function splitHeads(tensor) {
    return tensor.map(sample => Array.from({ length: HEADS }, (_, h) =>
      sample.map(row => row.slice(h * HEAD_DIM, (h + 1) * HEAD_DIM))));
  }

  function mergeHeads(tensor) {
    return tensor.map(sample => sample[0].map((_, t) => sample.flatMap(head => head[t])));
  }

  // Adjacent coordinate pairs: (0,1), (2,3). theta_i = position / 10000^(2*i/d_head).
  function rope(tensor) {
    return tensor.map(sample => sample.map(head => head.map((row, t) => {
      const result = [];
      for (let pair = 0; pair < HEAD_DIM / 2; pair++) {
        const angle = t / Math.pow(10000, 2 * pair / HEAD_DIM);
        const cosine = Math.cos(angle), sine = Math.sin(angle);
        const x = row[2 * pair], y = row[2 * pair + 1];
        result.push(x * cosine - y * sine, x * sine + y * cosine);
      }
      return result;
    })));
  }

  function swiglu(input, wg, wu, wd) {
    const gate = linear(input, wg);
    const up = linear(input, wu);
    const activated = mapRows(gate, row => row.map(silu));
    const gated = activated.map((sample, b) => sample.map((row, t) => row.map((x, d) => x * up[b][t][d])));
    const output = linear(gated, wd);
    return { input, wg, wu, gate, up, activated, gated, wd, output };
  }

  function blockForward(input, layerIndex = 0) {
    const salt = layerIndex * 8;
    const gamma1 = Array.from({ length: 8 }, (_, d) => 0.96 + ((d + layerIndex) % 5) * 0.02);
    const gamma2 = Array.from({ length: 8 }, (_, d) => 0.98 + ((d + layerIndex * 2) % 4) * 0.02);
    const norm1 = rmsNorm(input, gamma1);
    const wq = matrix(8, 8, salt + 1);
    const wk = matrix(8, 8, salt + 2);
    const wv = matrix(8, 8, salt + 3);
    const qFlat = linear(norm1.output, wq);
    const kFlat = linear(norm1.output, wk);
    const vFlat = linear(norm1.output, wv);
    const qBefore = splitHeads(qFlat), kBefore = splitHeads(kFlat), v = splitHeads(vFlat);
    const q = rope(qBefore), k = rope(kBefore);
    const scores = q.map((sample, b) => sample.map((head, h) =>
      head.map(query => k[b][h].map(key => dot(query, key)))));
    const scale = Math.sqrt(HEAD_DIM);
    const scaled = scores.map(sample => sample.map(head => head.map(row => row.map(x => x / scale))));
    const masked = scaled.map(sample => sample.map(head => head.map((row, t) =>
      row.map((x, j) => j > t ? -Infinity : x))));
    const attention = masked.map(sample => sample.map(head => head.map(softmax)));
    const context = attention.map((sample, b) => sample.map((head, h) => head.map(weights =>
      Array.from({ length: HEAD_DIM }, (_, d) => weights.reduce((sum, a, t) => sum + a * v[b][h][t][d], 0)))));
    const merged = mergeHeads(context);
    const wo = matrix(8, 8, salt + 4);
    const attnOut = linear(merged, wo);
    const residual1 = add(input, attnOut);
    const norm2 = rmsNorm(residual1, gamma2);
    const ffn = swiglu(norm2.output, matrix(8, 16, salt + 5), matrix(8, 16, salt + 6), matrix(16, 8, salt + 7));
    const mlp = ffn.output;
    const output = add(residual1, mlp);
    return {
      index: layerIndex, input, norm1, wq, wk, wv, qFlat, kFlat, vFlat, qBefore, kBefore, v, q, k,
      scores, scale, scaled, masked, attention, context, merged, wo, attnOut, residual1, norm2,
      wg: ffn.wg, wu: ffn.wu, gate: ffn.gate, up: ffn.up, activated: ffn.activated,
      gated: ffn.gated, wd: ffn.wd, mlp, output
    };
  }

  function run({ batch = 2, layers = 3, inputIds = null } = {}) {
    batch = Number(batch); layers = Number(layers);
    if (![1, 2, 4, 8].includes(batch)) throw new RangeError('batch must be 1, 2, 4, or 8');
    if (!Number.isInteger(layers) || layers < 2 || layers > 6) throw new RangeError('layers must be an integer from 2 to 6');
    const sequenceLength = inputIds ? inputIds[0].length : 4;
    if (inputIds && (inputIds.length !== batch || !sequenceLength || inputIds.some(row => row.length !== sequenceLength || row.some(id => !Number.isInteger(id) || id < 0 || id >= VOCAB.length)))) throw new RangeError("inputIds must be equal-length rows of valid vocabulary IDs");
    const config = { batch, layers, B: batch, T: sequenceLength, d: 8, h: 2, dh: 4, dff: 16, L: layers, V: 8,
      epsilon: EPSILON, ropeTheta: 10000, trained: false, dtype: 'JavaScript float64',
      sampling: 'greedy argmax', batchRepeats: batch > 2 };
    const ids = inputIds ? inputIds.map(row => row.slice()) : Array.from({ length: batch }, (_, b) => EXAMPLES[b % EXAMPLES.length].slice());
    const texts = ids.map(row => row.map(id => VOCAB[id]).join(' '));
    const embeddingTable = [
      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
      [0.2, 0.6, -0.1, 0.3, 0.4, -0.2, 0.1, 0.5],
      [-0.3, 0.2, 0.5, 0.1, -0.1, 0.4, 0.6, 0.2],
      [0.4, -0.1, 0.7, 0.2, 0.0, 0.3, -0.2, 0.5],
      [0.5, 0.1, 0.2, -0.2, 0.6, 0.3, 0.0, -0.1],
      [0.1, 0.4, -0.3, 0.6, 0.2, 0.0, 0.5, -0.2],
      [-0.2, 0.3, 0.4, 0.0, 0.5, -0.1, 0.2, 0.6],
      [0.3, -0.2, 0.1, 0.5, -0.3, 0.6, 0.4, 0.2]
    ];
    const embedding = ids.map(sample => sample.map(id => embeddingTable[id].slice()));
    const blocks = [];
    let hidden = embedding;
    for (let layer = 0; layer < layers; layer++) {
      const block = blockForward(hidden, layer);
      blocks.push(block);
      hidden = block.output;
    }
    const finalNorm = rmsNorm(hidden, [1.0, 0.98, 1.02, 1.0, 1.04, 0.96, 1.02, 1.0]);
    const lmWeight = matrix(8, 8, 101, 0.04);
    const logits = linear(finalNorm.output, lmWeight);
    const lastLogits = logits.map(sample => [sample[sample.length - 1].slice()]);
    const probs = mapRows(lastLogits, softmax);
    const nextIds = probs.map(sample => [sample[0].reduce((best, p, i, row) => p > row[best] ? i : best, 0)]);
    const nextTokens = nextIds.map(row => VOCAB[row[0]]);
    const appendedIds = ids.map((row, b) => [...row, nextIds[b][0]]);
    const ropeCos = Array.from({ length: sequenceLength }, (_, t) => [Math.cos(t), Math.cos(t / 100)]);
    const ropeSin = Array.from({ length: sequenceLength }, (_, t) => [Math.sin(t), Math.sin(t / 100)]);
    const causalMask = Array.from({ length: sequenceLength }, (_, t) => Array.from({ length: sequenceLength }, (_, j) => j > t ? -Infinity : 0));
    return { config, vocab: VOCAB.slice(), ids, texts, embeddingTable, embedding, blocks, finalNorm, lmWeight,
      logits, lastLogits, probs, nextIds, nextTokens, appendedIds, ropeCos, ropeSin, causalMask,
      note: '所有矩阵数字均由这套固定、未训练的 mini Transformer 参数实际计算；为教学演示，预测没有语言意义。显示可四舍五入，计算使用完整双精度。B 大于 2 时循环使用两条输入；文本中的 <eos> 在这里是教学输入标记，演示继续计算一次 next-token，不执行真实服务的停止策略。' };
  }

  return { run, matrix, linear, rmsNorm, softmax, blockForward, swiglu };
})();
