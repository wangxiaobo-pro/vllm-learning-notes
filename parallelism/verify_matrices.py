#!/usr/bin/env python3
"""Recompute the six teaching examples with Python's standard library.

Usage: python verify_matrices.py [path/to/matrix-examples.json]
This verifies arithmetic and logical shards, not a GPU/NCCL implementation.
Stored validation/verification flags are deliberately never consulted.
"""

import argparse
import json
import math
from pathlib import Path
import sys


class Checks:
    def __init__(self):
        self.count = 0
        self.max_error = 0.0

    def equal(self, actual, expected, label):
        self.count += 1
        if isinstance(expected, dict):
            if not isinstance(actual, dict) or actual.keys() != expected.keys():
                raise ValueError(f"{label}: dictionary keys differ")
            for key in expected:
                self.equal(actual[key], expected[key], f"{label}.{key}")
        elif isinstance(expected, list):
            if not isinstance(actual, list) or len(actual) != len(expected):
                raise ValueError(f"{label}: list lengths differ")
            for i, (a, b) in enumerate(zip(actual, expected)):
                self.equal(a, b, f"{label}[{i}]")
        elif isinstance(expected, (int, float)) and not isinstance(expected, bool):
            if not isinstance(actual, (int, float)) or isinstance(actual, bool):
                raise ValueError(f"{label}: expected a number, got {actual!r}")
            error = abs(actual - expected)
            if not math.isfinite(actual) or not math.isfinite(expected):
                raise ValueError(f"{label}: non-finite value")
            self.max_error = max(self.max_error, error)
            if not math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10):
                raise ValueError(f"{label}: stored={actual!r}, recomputed={expected!r}")
        elif actual != expected:
            raise ValueError(f"{label}: stored={actual!r}, recomputed={expected!r}")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def shape(matrix):
    require(isinstance(matrix, list) and bool(matrix), "empty/non-list matrix")
    require(all(isinstance(row, list) for row in matrix), "matrix rows must be lists")
    width = len(matrix[0])
    require(width > 0 and all(len(row) == width for row in matrix), "ragged/empty matrix")
    return len(matrix), width


def transpose(matrix):
    shape(matrix)
    return [list(column) for column in zip(*matrix)]


def matmul(a, b):
    rows, inner = shape(a)
    inner_b, columns = shape(b)
    require(inner == inner_b, f"matmul incompatible shapes: {shape(a)} @ {shape(b)}")
    return [[sum(a[i][k] * b[k][j] for k in range(inner))
             for j in range(columns)] for i in range(rows)]


def add_matrices(matrices):
    rows, columns = shape(matrices[0])
    require(all(shape(m) == (rows, columns) for m in matrices), "SUM shape mismatch")
    return [[sum(m[i][j] for m in matrices) for j in range(columns)] for i in range(rows)]


def relu(matrix):
    return [[max(0, value) for value in row] for row in matrix]


def linear_out_in(x, weight, bias):
    z = matmul(x, transpose(weight))
    require(len(bias) == len(z[0]), "bias shape mismatch")
    return [[value + bias[j] for j, value in enumerate(row)] for row in z]


def softmax(scores):
    maximum = max(scores)
    exponentials = [math.exp(s - maximum) for s in scores]
    denominator = sum(exponentials)
    return [value / denominator for value in exponentials], maximum + math.log(denominator)


def attention(q, k, v, causal=False):
    nq, dim = shape(q)
    nk, kd = shape(k)
    nv, _ = shape(v)
    require(dim == kd and nk == nv, "attention Q/K/V shape mismatch")
    require(not causal or nq == nk, "causal example expects square self-attention")
    scores, probabilities, outputs, lses = [], [], [], []
    for t, query in enumerate(q):
        end = t + 1 if causal else nk
        row = [sum(a * b for a, b in zip(query, key)) / math.sqrt(dim)
               for key in k[:end]]
        p, lse = softmax(row)
        scores.append(row + [None] * (nk - end))
        probabilities.append(p + [0.0] * (nk - end))
        outputs.append(matmul([p], v[:end])[0])
        lses.append(lse)
    return {"scores": scores, "probabilities": probabilities, "O": outputs, "LSE": lses}


def network(x, weights):
    z = matmul(x, weights["W1"])
    h = relu(z)
    return z, h, matmul(h, weights["W2"])


def verify_lm_head(c, stored, y, weights, label):
    logits = matmul(y, weights["Whead"])
    if "logitsAllRows" in stored:
        c.equal(stored["logitsAllRows"], logits, label + ".logitsAllRows")
    last = logits[-1]
    best = max(range(len(last)), key=last.__getitem__)
    require(sum(value == last[best] for value in last) == 1, label + ": tied argmax")
    c.equal(stored["lastRowLogits"], last, label + ".lastRowLogits")
    c.equal(stored["argmax0Based"], best, label + ".argmax")
    c.equal(stored["selectedToken"], weights["vocabulary"][best], label + ".token")


def verify_tp(data, c):
    weights, tp = data["network"], data["tp"]
    z, h, y = network(tp["X"], weights)
    for field, value in (("fullZ", z), ("fullH", h), ("fullY", y)):
        c.equal(tp[field], value, "TP." + field)
    partials, features = [], []
    for rank in tp["ranks"]:
        ids = rank["intermediateFeatures"]
        features += ids
        w1 = [[row[i] for i in ids] for row in weights["W1"]]
        w2 = [weights["W2"][i] for i in ids]
        rz, rh, ry = network(tp["X"], {"W1": w1, "W2": w2})
        for key, value in (("X", tp["X"]), ("W1Shard", w1), ("W2Shard", w2),
                           ("Z", rz), ("H", rh), ("partialY", ry)):
            c.equal(rank[key], value, f"TP.rank{rank['rank']}.{key}")
        c.equal(tp[f"Y{rank['rank']}"], ry, f"TP.Y{rank['rank']}")
        partials.append(ry)
    c.equal(sorted(features), list(range(len(weights["W2"]))), "TP.feature partition")
    summed = add_matrices(partials)
    c.equal(summed, y, "TP.recomputed SUM versus full network")
    c.equal(tp["Ysum"], summed, "TP.Ysum")
    for rank, stored in enumerate(tp["postAllReduceYPerRank"]):
        c.equal(stored, summed, f"TP.postAllReduce.rank{rank}")
    verify_lm_head(c, tp, y, weights, "TP")


def verify_dp(data, c):
    weights = data["network"]
    inputs, outputs = [], []
    for rank in data["dp"]["ranks"]:
        label = f"DP.rank{rank['rank']}"
        for key in ("W1", "W2", "Whead"):
            c.equal(rank[key], weights[key], label + ".replicated." + key)
        z, h, y = network(rank["X"], weights)
        for key, value in (("Z", z), ("H", h), ("Y", y)):
            c.equal(rank[key], value, label + "." + key)
        verify_lm_head(c, rank, y, weights, label)
        inputs.extend(rank["X"])
        outputs.extend(y)
    c.equal(outputs, network(inputs, weights)[2], "DP.independent requests versus batched arithmetic")


def verify_record(c, record, rows, values, label):
    c.equal(record["rows"], rows, label + ".rows")
    c.equal(record["shape"], list(shape(values)), label + ".shape")
    c.equal(record["values"], values, label + ".values")


def verify_ep(ep, c):
    tokens = ep["input"]["rows"]
    x = dict(zip(tokens, ep["input"]["values"]))
    require(len(x) == len(tokens), "EP duplicate input tokens")
    experts = {e["id"]: e for e in ep["experts"]}
    routes = {r["token"]: r for r in ep["routing"]}
    require(set(routes) == set(x), "EP routing tokens differ from inputs")
    owner, seen = {}, []
    for shard in ep["source_shards"]:
        c.equal(shard["values"], [x[t] for t in shard["tokens"]], "EP.source shard")
        for token in shard["tokens"]:
            owner[token] = shard["rank"]
            seen.append(token)
    c.equal(sorted(seen), sorted(tokens), "EP.source token partition")
    weights = {}
    for token, route in routes.items():
        c.equal(route["source_rank"], owner[token], "EP.route source")
        c.equal(sum(choice["weight"] for choice in route["choices"]), 1.0, "EP.router weight sum")
        for choice in route["choices"]:
            expert = choice["expert"]
            require((token, expert) not in weights, "EP duplicate token/expert assignment")
            weights[token, expert] = choice["weight"]
            c.equal(choice["expert_rank"], experts[expert]["owner_rank"], "EP.expert destination")
    results = {}
    for expert_id, expert in experts.items():
        rows = [t for t in tokens if (t, expert_id) in weights]
        inputs = [x[t] for t in rows]
        z = linear_out_in(inputs, expert["W"], expert["bias"])
        y = relu(z)
        for name, values in (("input", inputs), ("linear_output", z), ("output", y)):
            verify_record(c, expert[name], rows, values, f"EP.{expert_id}.{name}")
        results.update({(t, expert_id): row for t, row in zip(rows, y)})
    packed_keys = []
    for packed in ep["packed_by_expert_rank"]:
        keys = [(item["token"], item["expert"]) for item in packed["order"]]
        packed_keys.extend(keys)
        labels = [f"{t}/{e}" for t, e in keys]
        for item in packed["order"]:
            c.equal(item["source_rank"], owner[item["token"]], "EP.packed source")
            c.equal(experts[item["expert"]]["owner_rank"], packed["rank"], "EP.packed owner")
        verify_record(c, packed["dispatch_matrix"], labels, [x[t] for t, _ in keys], "EP.packed dispatch")
        verify_record(c, packed["expert_output_matrix"], labels, [results[k] for k in keys], "EP.packed output")
        c.equal(packed["router_weights"], [weights[k] for k in keys], "EP.packed weights")
        weighted = [[weights[k] * v for v in results[k]] for k in keys]
        verify_record(c, packed["combine_internal_weighted_contributions"], labels, weighted, "EP.weighted contributions")
    c.equal(sorted(packed_keys), sorted(weights), "EP.packed route coverage")
    transfer_keys = []
    for transfer in ep["transfers"]:
        keys = [(item["token"], item["expert"]) for item in transfer["rows"]]
        transfer_keys.extend(keys)
        for token, expert in keys:
            c.equal(transfer["source_rank"], owner[token], "EP.transfer source")
            c.equal(transfer["destination_rank"], experts[expert]["owner_rank"], "EP.transfer destination")
        c.equal(transfer["cross_rank"], transfer["source_rank"] != transfer["destination_rank"], "EP.cross_rank")
        c.equal(transfer["dispatch_values"], [x[t] for t, _ in keys], "EP.dispatch payload")
        c.equal(transfer["combine_reverse_raw_values"], [results[k] for k in keys], "EP.reverse raw payload")
        c.equal(transfer["weights_at_combine"], [weights[k] for k in keys], "EP.combine weights")
    c.equal(sorted(transfer_keys), sorted(weights), "EP.transfer route coverage")
    combined = {}
    for token in tokens:
        choices = routes[token]["choices"]
        width = len(results[token, choices[0]["expert"]])
        combined[token] = [sum(choice["weight"] * results[token, choice["expert"]][d]
                               for choice in choices) for d in range(width)]
    verify_record(c, ep["combined"], tokens, [combined[t] for t in tokens], "EP.combined")
    output_tokens = []
    for shard in ep["output_shards"]:
        output_tokens.extend(shard["tokens"])
        for token in shard["tokens"]:
            c.equal(shard["rank"], owner[token], "EP.combine returns to source")
        c.equal(shard["values"], [combined[t] for t in shard["tokens"]], "EP.output shard")
    c.equal(sorted(output_tokens), sorted(tokens), "EP.output token coverage")


def verify_pp(pp, c):
    rows = pp["input"]["rows"]
    current = pp["input"]["values"]
    stage_outputs = []
    for stage in pp["stages"]:
        verify_record(c, stage["input"], rows, current, f"PP.{stage['id']}.input")
        z = linear_out_in(current, stage["W"], stage["bias"])
        current = relu(z)
        verify_record(c, stage["linear_output"], rows, z, f"PP.{stage['id']}.linear")
        verify_record(c, stage["output"], rows, current, f"PP.{stage['id']}.output")
        c.equal(stage["local_return"]["values"], current, "PP.local return")
        stage_outputs.append(current)
    verify_record(c, pp["final_hidden"], rows, current, "PP.final hidden")
    c.equal(pp["serial_reference"], current, "PP.serial reference")
    transfers = [edge for edge in pp["edges"] if edge["kind"] == "cross_rank_tensor"]
    c.equal(len(transfers), len(pp["stages"]) - 1, "PP.transfer count")
    for i, edge in enumerate(transfers):
        c.equal(edge["payload"], stage_outputs[i], f"PP.transfer{i}.payload unchanged")
        c.equal(edge["payload"], pp["stages"][i + 1]["input"]["values"], f"PP.transfer{i}.receiver input")


def rounded(value):
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    if isinstance(value, list):
        return [rounded(item) for item in value]
    return round(value, 4) if isinstance(value, float) else value


def verify_sp(sp, c):
    d = sp["full_precision"]
    x = d["X"]
    queries, keys, values = [matmul(x, d[name]) for name in ("Wq", "Wk", "Wv")]
    c.equal(d["initial_rank_token_shards"], {"rank0": x[:2], "rank1": x[2:]}, "SP.token shards")
    c.equal(d["after_all_gather"], {"rank0": x, "rank1": x}, "SP.token All-Gather")
    partials, head_outputs = [], []
    for stored in d["head_calculations"]:
        head = stored["head"]
        q, k, v = [[[row[head]] for row in matrix] for matrix in (queries, keys, values)]
        a = attention(q, k, v, causal=True)
        output_weight = [d["Wo"][head]]
        partial = matmul(a["O"], output_weight)
        expected = {"Q": q, "K": k, "V": v, "causal_scores": a["scores"],
                    "causal_probabilities": a["probabilities"], "LSE": a["LSE"],
                    "attention_head_output": a["O"], "Wo_row": output_weight,
                    "partial_output": partial}
        for name, value in expected.items():
            c.equal(stored[name], value, f"SP.head{head}.{name}")
        partials.append(partial)
        head_outputs.append(a["O"])
    summed = add_matrices(partials)
    concat = [[output[t][0] for output in head_outputs] for t in range(len(x))]
    reference = matmul(concat, d["Wo"])
    c.equal(summed, reference, "SP.recomputed partial SUM versus concatenated heads @ Wo")
    c.equal(d["sum_of_partial_outputs"], summed, "SP.partial SUM")
    c.equal(d["unsharded_concat_head_output"], concat, "SP.concat heads")
    c.equal(d["unsharded_reference"], reference, "SP.reference")
    c.equal(d["reduce_scatter_outputs"], {"rank0": summed[:2], "rank1": summed[2:]}, "SP.token Reduce-Scatter")
    c.equal(sp["display"], rounded(d), "SP.display rounding")


def verify_cp(cp, c):
    d = cp["full_precision"]
    q, k, v = d["Q_all_heads"], d["history_K"], d["history_V"]
    c.equal(d["initial_Q_by_rank"], {"rank0": [q[0]], "rank1": [q[1]]}, "CP.initial head shards")
    c.equal(d["Q_after_all_gather_by_rank"], {"rank0": q, "rank1": q}, "CP.Q head All-Gather")
    local, token_indices = [], []
    for shard in d["history_shards"]:
        ids = shard["history_token_indices"]
        token_indices.extend(ids)
        local_k, local_v = [k[i] for i in ids], [v[i] for i in ids]
        c.equal(shard["K"], local_k, "CP.K shard")
        c.equal(shard["V"], local_v, "CP.V shard")
        a = attention(q, local_k, local_v)
        for name, value in a.items():
            c.equal(shard[name], value, f"CP.local rank{shard['rank']}.{name}")
        local.append(a)
    c.equal(sorted(token_indices), list(range(len(k))), "CP.history token partition")
    lses = [a["LSE"] for a in local]
    total_lse = [softmax([row[h] for row in lses])[1] for h in range(len(q))]
    factors = [[math.exp(row[h] - total_lse[h]) for h in range(len(q))] for row in lses]
    corrected = [[[value * factors[r][h] for value in head]
                  for h, head in enumerate(a["O"])] for r, a in enumerate(local)]
    history = add_matrices(corrected)
    for name, value in (("all_gathered_LSE_rank_by_head", lses), ("global_history_LSE", total_lse),
                        ("correction_factors_rank_by_head", factors), ("corrected_O_rank_by_head_dim", corrected),
                        ("history_sum_all_heads_for_explanation", history)):
        c.equal(d[name], value, "CP." + name)
    current = attention(q, d["current_token_K"], d["current_token_V"])
    c.equal(d["current_token_attention_all_heads"], current, "CP.current token attention")
    final_lse = [softmax([total_lse[h], current["LSE"][h]])[1] for h in range(len(q))]
    wh = [math.exp(total_lse[h] - final_lse[h]) for h in range(len(q))]
    wc = [math.exp(current["LSE"][h] - final_lse[h]) for h in range(len(q))]
    final = [[wh[h] * value + wc[h] * current["O"][h][j]
              for j, value in enumerate(head)] for h, head in enumerate(history)]
    for h in range(len(q)):
        rank = f"rank{h}"
        c.equal(d["history_reduce_scatter_outputs"][rank], {"head": h, "O": [history[h]], "LSE": [total_lse[h]]}, "CP.history head Reduce-Scatter." + rank)
        c.equal(d["current_token_attention_by_rank"][rank], {"head": h, "O": [current["O"][h]], "LSE": [current["LSE"][h]]}, "CP.current head." + rank)
        c.equal(d["final_O_by_rank"][rank], [final[h]], "CP.final head." + rank)
    for name, value in (("merge_history_weight", wh), ("merge_current_weight", wc),
                        ("final_LSE", final_lse), ("final_O_all_heads", final)):
        c.equal(d[name], value, "CP." + name)
    history_reference = attention(q, k, v)
    full_reference = attention(q, k + d["current_token_K"], v + d["current_token_V"])
    c.equal(history, history_reference["O"], "CP.recomputed history combine versus unsharded attention")
    c.equal(final, full_reference["O"], "CP.recomputed merge versus unsharded 5-token attention")
    c.equal(final_lse, full_reference["LSE"], "CP.final LSE versus full softmax")
    c.equal(d["unsharded_history_reference"], history_reference, "CP.stored history reference")
    c.equal(d["unsharded_5_token_reference"], full_reference, "CP.stored full reference")
    c.equal(cp["display"], rounded(d), "CP.display rounding")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_path", nargs="?", type=Path,
                        default=Path(__file__).with_name("matrix-examples.json"))
    args = parser.parse_args()
    data = json.loads(args.json_path.read_text(encoding="utf-8-sig"))
    cases = [("TP", verify_tp, data["tpdp"]), ("DP", verify_dp, data["tpdp"]),
             ("EP", verify_ep, data["eppp"]["ep"]), ("PP", verify_pp, data["eppp"]["pp"]),
             ("SP", verify_sp, data["spcp"]["sp"]), ("CP", verify_cp, data["spcp"]["cp"])]
    failed = False
    for name, function, example in cases:
        checks = Checks()
        try:
            function(example, checks)
        except (ValueError, KeyError, TypeError, IndexError) as error:
            failed = True
            print(f"FAIL {name}: {error}", file=sys.stderr)
        else:
            print(f"PASS {name}: {checks.count} comparisons; max_abs_error={checks.max_error:.3g}")
    if failed:
        return 1
    print("All 6 modes passed. Standard-library arithmetic only; no device/runtime claim.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
