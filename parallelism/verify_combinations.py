#!/usr/bin/env python3
"""Recompute TP+SP, DP+EP and DP+TP+PP teaching examples.

Usage: python verify_combinations.py [path/to/combo-examples.json]
Uses only the Python standard library. Stored validation flags are ignored.
This checks arithmetic, ownership and logical payloads, not GPU execution.
"""

import argparse
import json
import math
from pathlib import Path
import sys


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Checks:
    def __init__(self):
        self.count = 0
        self.max_error = 0.0

    def equal(self, actual, expected, label):
        self.count += 1
        if isinstance(expected, dict):
            require(isinstance(actual, dict) and actual.keys() == expected.keys(),
                    label + ": dictionary keys differ")
            for key in expected:
                self.equal(actual[key], expected[key], label + "." + key)
        elif isinstance(expected, list):
            require(isinstance(actual, list) and len(actual) == len(expected),
                    label + ": list lengths differ")
            for i, (a, b) in enumerate(zip(actual, expected)):
                self.equal(a, b, f"{label}[{i}]")
        elif isinstance(expected, (int, float)) and not isinstance(expected, bool):
            require(isinstance(actual, (int, float)) and not isinstance(actual, bool),
                    label + ": expected number")
            require(math.isfinite(actual) and math.isfinite(expected), label + ": non-finite number")
            self.max_error = max(self.max_error, abs(actual - expected))
            require(math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10),
                    f"{label}: stored={actual!r}, recomputed={expected!r}")
        else:
            require(actual == expected, f"{label}: stored={actual!r}, recomputed={expected!r}")


def shape(a):
    require(isinstance(a, list) and bool(a), "empty/non-list matrix")
    require(all(isinstance(row, list) and row for row in a), "empty/non-list row")
    width = len(a[0])
    require(all(len(row) == width for row in a), "ragged matrix")
    return len(a), width


def transpose(a):
    shape(a)
    return [list(column) for column in zip(*a)]


def matmul(a, b):
    rows, inner = shape(a)
    other_inner, columns = shape(b)
    require(inner == other_inner, "matmul shape mismatch")
    return [[sum(a[i][k] * b[k][j] for k in range(inner))
             for j in range(columns)] for i in range(rows)]


def relu(a):
    return [[max(0, v) for v in row] for row in a]


def sum_matrices(matrices):
    rows, columns = shape(matrices[0])
    require(all(shape(m) == (rows, columns) for m in matrices), "SUM shape mismatch")
    return [[sum(m[i][j] for m in matrices) for j in range(columns)] for i in range(rows)]


def mlp(x, w1, w2):
    z = matmul(x, w1)
    h = relu(z)
    return z, h, matmul(h, w2)


def rounded(value):
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    if isinstance(value, list):
        return [rounded(item) for item in value]
    return round(value, 4) if isinstance(value, float) else value


def causal_attention(q, k, v):
    count, dim = shape(q)
    require(shape(k) == (count, dim) and len(v) == count, "causal attention shape mismatch")
    scores, probabilities, outputs, lses = [], [], [], []
    for t, query in enumerate(q):
        row = [sum(a * b for a, b in zip(query, key)) / math.sqrt(dim) for key in k[:t + 1]]
        maximum = max(row)
        exponentials = [math.exp(value - maximum) for value in row]
        denominator = sum(exponentials)
        p = [value / denominator for value in exponentials]
        scores.append(row + [None] * (count - t - 1))
        probabilities.append(p + [0.0] * (count - t - 1))
        outputs.append(matmul([p], v[:t + 1])[0])
        lses.append(maximum + math.log(denominator))
    return scores, probabilities, outputs, lses


def verify_tpsp(data, c):
    d = data["full_precision"]
    x = d["X"]
    require(shape(x) == (4, 2), "TP+SP example expects 4 tokens and 2 columns")
    c.equal(d["initial_rank_token_shards"], {"rank0": x[:2], "rank1": x[2:]}, "TP+SP.token ownership")
    c.equal(d["after_all_gather"], {"rank0": x, "rank1": x}, "TP+SP.All-Gather")
    qs, ks, vs = [matmul(x, d[name]) for name in ("Wq", "Wk", "Wv")]
    c.equal([r["rank"] for r in d["head_calculations"]], [0, 1], "TP+SP.ranks")
    c.equal([r["head"] for r in d["head_calculations"]], [0, 1], "TP+SP.head partition")
    partials, head_outputs = [], []
    for rank in d["head_calculations"]:
        head = rank["head"]
        q, k, v = [[[row[head]] for row in matrix] for matrix in (qs, ks, vs)]
        scores, probabilities, output, lses = causal_attention(q, k, v)
        row_weight = [d["Wo"][head]]
        partial = matmul(output, row_weight)
        expected = {"Q": q, "K": k, "V": v, "causal_scores": scores,
                    "causal_probabilities": probabilities, "attention_head_output": output,
                    "LSE": lses, "Wo_row": row_weight, "partial_output": partial}
        for key, value in expected.items():
            c.equal(rank[key], value, f"TP+SP.rank{head}.{key}")
        partials.append(partial)
        head_outputs.append(output)
    summed = sum_matrices(partials)
    concat = [[head_outputs[h][t][0] for h in range(2)] for t in range(len(x))]
    reference = matmul(concat, d["Wo"])
    c.equal(summed, reference, "TP+SP.SUM versus full attention projection")
    c.equal(d["sum_of_partial_outputs"], summed, "TP+SP.SUM")
    c.equal(d["unsharded_concat_head_output"], concat, "TP+SP.concat heads")
    c.equal(d["unsharded_reference"], reference, "TP+SP.reference")
    c.equal(d["reduce_scatter_outputs"], {"rank0": summed[:2], "rank1": summed[2:]}, "TP+SP.token Reduce-Scatter")
    c.equal(data["display"], rounded(d), "TP+SP.display rounding")


def check_record(c, record, rows, values, label):
    c.equal(record["rows"], rows, label + ".rows")
    c.equal(record["shape"], list(shape(values)), label + ".shape")
    c.equal(record["values"], values, label + ".values")


def verify_moe(moe, inputs, owners, c):
    tokens = moe["input"]["rows"]
    require(set(tokens) == set(inputs) and len(tokens) == len(inputs), "DP+EP.input token coverage")
    check_record(c, moe["input"], tokens, [inputs[t] for t in tokens], "DP+EP.MoE input")
    experts = {e["id"]: e for e in moe["experts"]}
    routes = {r["token"]: r for r in moe["routing"]}
    require(set(routes) == set(inputs), "DP+EP.route token coverage")
    weights = {}
    for token, route in routes.items():
        c.equal(route["source_rank"], owners[token], "DP+EP.source rank")
        c.equal(sum(choice["weight"] for choice in route["choices"]), 1.0, "DP+EP.weight sum")
        for choice in route["choices"]:
            key = token, choice["expert"]
            require(key not in weights, "DP+EP.duplicate route")
            weights[key] = choice["weight"]
            c.equal(choice["expert_rank"], experts[choice["expert"]]["owner_rank"], "DP+EP.expert rank")
    seen_source = []
    for shard in moe["source_shards"]:
        seen_source.extend(shard["tokens"])
        c.equal(shard["values"], [inputs[t] for t in shard["tokens"]], "DP+EP.source values")
        for token in shard["tokens"]:
            c.equal(shard["rank"], owners[token], "DP+EP.source owner")
    c.equal(sorted(seen_source), sorted(tokens), "DP+EP.source coverage")
    results = {}
    for expert_id, expert in experts.items():
        rows = [t for t in tokens if (t, expert_id) in weights]
        x = [inputs[t] for t in rows]
        z = matmul(x, transpose(expert["W"]))
        require(len(expert["bias"]) == len(z[0]), "DP+EP.bias width")
        z = [[value + expert["bias"][j] for j, value in enumerate(row)] for row in z]
        y = relu(z)
        for field, values in (("input", x), ("linear_output", z), ("output", y)):
            check_record(c, expert[field], rows, values, f"DP+EP.{expert_id}.{field}")
        results.update({(token, expert_id): row for token, row in zip(rows, y)})
    packed_routes = []
    for packed in moe["packed_by_expert_rank"]:
        keys = [(item["token"], item["expert"]) for item in packed["order"]]
        packed_routes.extend(keys)
        labels = [f"{t}/{e}" for t, e in keys]
        for item in packed["order"]:
            c.equal(item["source_rank"], owners[item["token"]], "DP+EP.packed source")
            c.equal(experts[item["expert"]]["owner_rank"], packed["rank"], "DP+EP.packed expert owner")
        check_record(c, packed["dispatch_matrix"], labels, [inputs[t] for t, _ in keys], "DP+EP.packed dispatch")
        check_record(c, packed["expert_output_matrix"], labels, [results[k] for k in keys], "DP+EP.packed output")
        c.equal(packed["router_weights"], [weights[k] for k in keys], "DP+EP.packed weights")
        weighted = [[weights[k] * value for value in results[k]] for k in keys]
        check_record(c, packed["combine_internal_weighted_contributions"], labels, weighted, "DP+EP.weighted contributions")
    c.equal(sorted(packed_routes), sorted(weights), "DP+EP.packed route coverage")
    transferred = []
    for transfer in moe["transfers"]:
        keys = [(item["token"], item["expert"]) for item in transfer["rows"]]
        transferred.extend(keys)
        for token, expert in keys:
            c.equal(transfer["source_rank"], owners[token], "DP+EP.transfer source")
            c.equal(transfer["destination_rank"], experts[expert]["owner_rank"], "DP+EP.transfer destination")
        c.equal(transfer["cross_rank"], transfer["source_rank"] != transfer["destination_rank"], "DP+EP.cross rank")
        c.equal(transfer["dispatch_values"], [inputs[t] for t, _ in keys], "DP+EP.dispatch payload")
        c.equal(transfer["combine_reverse_raw_values"], [results[k] for k in keys], "DP+EP.raw return payload")
        c.equal(transfer["weights_at_combine"], [weights[k] for k in keys], "DP+EP.return weights")
    c.equal(sorted(transferred), sorted(weights), "DP+EP.transfer route coverage")
    combined = {}
    for token in tokens:
        choices = routes[token]["choices"]
        width = len(results[token, choices[0]["expert"]])
        combined[token] = [sum(choice["weight"] * results[token, choice["expert"]][j]
                               for choice in choices) for j in range(width)]
    check_record(c, moe["combined"], tokens, [combined[t] for t in tokens], "DP+EP.combine")
    returned_tokens = []
    for shard in moe["output_shards"]:
        returned_tokens.extend(shard["tokens"])
        c.equal(shard["values"], [combined[t] for t in shard["tokens"]], "DP+EP.return values")
        for token in shard["tokens"]:
            c.equal(shard["rank"], owners[token], "DP+EP.return to source")
    c.equal(sorted(returned_tokens), sorted(tokens), "DP+EP.return coverage")
    return combined


def verify_dpep(data, c):
    config = data["configuration"]
    c.equal(config["physical_gpu_count"], 2, "DP+EP.physical GPU count")
    c.equal(config["data_parallel_size"], 2, "DP+EP.DP size")
    c.equal(config["derived_expert_parallel_size"], 2, "DP+EP.EP size")
    c.equal(data["groups"]["DP"], [[0, 1]], "DP+EP.DP group")
    c.equal(data["groups"]["EP"], [[0, 1]], "DP+EP.EP group")
    c.equal([r["rank"] for r in data["ranks"]], [0, 1], "DP+EP.ranks")
    inputs, owners, dense_outputs = {}, {}, {}
    for rank in data["ranks"]:
        request = rank["request"]
        x = data["inputX"][request]
        tokens = data["request_token_mapping"][request]
        require(len(tokens) == len(x), "DP+EP.request row mapping")
        c.equal(rank["tokens"], tokens, "DP+EP.rank token order")
        c.equal(rank["inputX"], x, "DP+EP.request input")
        c.equal(rank["Wpre"], data["Wpre"], "DP+EP.replicated Wpre")
        c.equal(rank["Wpost"], data["Wpost"], "DP+EP.replicated Wpost")
        y = matmul(x, data["Wpre"])
        c.equal(rank["moeInput"], y, "DP+EP.pre-dense result")
        dense_outputs[request] = y
        for token, row in zip(tokens, y):
            require(token not in inputs, "DP+EP.duplicate request token")
            inputs[token], owners[token] = row, rank["rank"]
        expected_experts = [e["id"] for e in data["moe"]["experts"] if e["owner_rank"] == rank["rank"]]
        c.equal(rank["owned_experts"], expected_experts, "DP+EP.local experts")
    for rank in data["dense_before"]["ranks"]:
        request = rank["request"]
        c.equal(rank["input"], data["inputX"][request], "DP+EP.dense-before input")
        c.equal(rank["W"], data["Wpre"], "DP+EP.dense-before W")
        c.equal(rank["output"], dense_outputs[request], "DP+EP.dense-before output")
    combined = verify_moe(data["moe"], inputs, owners, c)
    for rank in data["ranks"]:
        request = rank["request"]
        returned = [combined[t] for t in rank["tokens"]]
        final = matmul(returned, data["Wpost"])
        c.equal(rank["moeOutput"], returned, "DP+EP.returned hidden")
        c.equal(rank["outputY"], final, "DP+EP.rank final hidden")
        c.equal(data["outputY"][request], final, "DP+EP.final hidden")
    for rank in data["dense_after"]["ranks"]:
        returned = [combined[t] for t in data["request_token_mapping"][rank["request"]]]
        c.equal(rank["input"], returned, "DP+EP.dense-after input")
        c.equal(rank["W"], data["Wpost"], "DP+EP.dense-after W")
        c.equal(rank["output"], matmul(returned, data["Wpost"]), "DP+EP.dense-after output")


def verify_dptpp(data, c):
    c.equal(data["config"], {"dp_size": 2, "tp_size": 2, "pp_size": 2,
                             "physical_gpu_count": 8, "world_size_per_dp": 4,
                             "sequence_parallel": False}, "DP+TP+PP.config")
    c.equal([s["pp_stage"] for s in data["stages"]], [0, 1], "DP+TP+PP.stage order")
    c.equal([r["physical_gpu"] for r in data["ranks"]], list(range(8)), "DP+TP+PP.GPU coverage")
    c.equal([r["dp_rank"] for r in data["DPinputs"]], [0, 1], "DP+TP+PP.DP inputs")
    c.equal(data["groups"]["TP_physical_gpu_sets"], [[0, 1], [2, 3], [4, 5], [6, 7]],
            "DP+TP+PP.TP physical devices")
    c.equal(data["groups"]["PP_physical_gpu_sets"], [[0, 2], [1, 3], [4, 6], [5, 7]],
            "DP+TP+PP.PP physical devices")
    c.equal(data["groups"]["per_dp_local_world"], {"world_size": 4, "TP": [[0, 1], [2, 3]],
                                                  "PP": [[0, 2], [1, 3]]},
            "DP+TP+PP.independent local worlds")
    ranks = {(r["dp_rank"], r["pp_stage"], r["tp_rank"]): r for r in data["ranks"]}
    stages = {(s["dp_rank"], s["pp_stage"]): s for s in data["stage_results"]}
    require(len(ranks) == 8 and len(stages) == 4, "DP+TP+PP.duplicate/missing coordinates")
    reference, outputs = {}, {}
    for request_data in data["DPinputs"]:
        dp, request, x = request_data["dp_rank"], request_data["request"], request_data["X"]
        ref = {}
        for stage in data["stages"]:
            pp, w1, w2 = stage["pp_stage"], stage["W1"], stage["W2"]
            z, h, full_y = mlp(x, w1, w2)
            expected = {"dp_rank": dp, "pp_stage": pp, "request": request, "X": x, "Z": z, "H": h, "Y": full_y}
            c.equal(stages[dp, pp], expected, f"DP+TP+PP.dp{dp}.stage{pp}")
            parts, feature_ids = [], []
            intermediate = len(w2)
            require(intermediate % 2 == 0, "TP intermediate cannot be equally split")
            for tp in range(2):
                rank = ranks[dp, pp, tp]
                ids = list(range(tp * intermediate // 2, (tp + 1) * intermediate // 2))
                feature_ids += ids
                w1s, w2s = [[row[i] for i in ids] for row in w1], [w2[i] for i in ids]
                rz, rh, partial = mlp(x, w1s, w2s)
                fields = {"physical_gpu": dp * 4 + pp * 2 + tp,
                          "world_local_rank": pp * 2 + tp, "request": request,
                          "intermediate_features": ids, "X": x, "W1Shard": w1s, "W2Shard": w2s,
                          "Z": rz, "H": rh, "partialY": partial, "Y": full_y}
                for key, value in fields.items():
                    c.equal(rank[key], value, f"DP+TP+PP.gpu{rank['physical_gpu']}.{key}")
                parts.append(partial)
            c.equal(feature_ids, list(range(intermediate)), "DP+TP+PP.feature partition")
            c.equal(sum_matrices(parts), full_y, "DP+TP+PP.TP SUM versus unsharded MLP")
            outputs[dp, pp] = full_y
            ref[f"stage{pp}_hidden"] = full_y
            x = full_y
        ref["final_hidden"] = x
        reference[request] = ref
    c.equal(data["reference"], reference, "DP+TP+PP.serial dense references")
    c.equal([t["dp_rank"] for t in data["pp_transfers"]], [0, 1], "DP+TP+PP.PP transfer coverage")
    for transfer in data["pp_transfers"]:
        dp = transfer["dp_rank"]
        y = outputs[dp, 0]
        flat = [value for row in y for value in row]
        c.equal(transfer["from_pp_stage"], 0, "DP+TP+PP.PP source stage")
        c.equal(transfer["to_pp_stage"], 1, "DP+TP+PP.PP destination stage")
        c.equal(transfer["source_replicated_on_tp"], True, "DP+TP+PP.replicated source")
        c.equal(transfer["original_shape"], list(shape(y)), "DP+TP+PP.original shape")
        c.equal(transfer["numel"], len(flat), "DP+TP+PP.numel")
        c.equal(transfer["numel_divisible_by_tp"], len(flat) % 2 == 0, "DP+TP+PP.slice eligibility")
        c.equal(transfer["full_hidden_before_send"], y, "DP+TP+PP.before send")
        c.equal([t["tp_rank"] for t in transfer["rank_transfers"]], [0, 1], "DP+TP+PP.TP sender coverage")
        size, chunks = len(flat) // 2, []
        for tp, rank_transfer in enumerate(transfer["rank_transfers"]):
            chunk = flat[tp * size:(tp + 1) * size]
            expected = {"tp_rank": tp, "source_physical_gpu": dp * 4 + tp,
                        "destination_physical_gpu": dp * 4 + 2 + tp,
                        "source_world_local_rank": tp, "destination_world_local_rank": 2 + tp,
                        "send_flat_chunk": chunk, "receive_flat_chunk": chunk}
            c.equal(rank_transfer, expected, "DP+TP+PP.flattened PP payload")
            chunks.append(chunk)
        c.equal(transfer["destination_tp_all_gather_chunks"], chunks, "DP+TP+PP.receiver TP All-Gather")
        gathered = [value for chunk in chunks for value in chunk]
        columns = len(y[0])
        reconstructed = [gathered[i:i + columns] for i in range(0, len(gathered), columns)]
        c.equal(reconstructed, y, "DP+TP+PP.All-Gather reshape")
        c.equal(transfer["reconstructed_hidden_per_destination_tp_rank"], [reconstructed, reconstructed],
                "DP+TP+PP.receiver replicated hidden")
        for tp in range(2):
            c.equal(ranks[dp, 1, tp]["X"], reconstructed, "DP+TP+PP.next stage consumes reconstructed hidden")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_path", nargs="?", type=Path,
                        default=Path(__file__).with_name("combo-examples.json"))
    args = parser.parse_args()
    try:
        data = json.loads(args.json_path.read_text(encoding="utf-8-sig"))
        cases = [("TP+SP", verify_tpsp, data["tpsp"]),
                 ("DP+EP", verify_dpep, data["dpep"]),
                 ("DP+TP+PP", verify_dptpp, data["dptpp"])]
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"FAIL reading combination data: {error}", file=sys.stderr)
        return 1
    failed = False
    for name, function, example in cases:
        checks = Checks()
        try:
            function(example, checks)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError) as error:
            failed = True
            print(f"FAIL {name}: {error}", file=sys.stderr)
        else:
            print(f"PASS {name}: {checks.count} comparisons; max_abs_error={checks.max_error:.3g}")
    if failed:
        return 1
    print("All 3 combinations passed. Standard-library arithmetic; no GPU/runtime claim.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
