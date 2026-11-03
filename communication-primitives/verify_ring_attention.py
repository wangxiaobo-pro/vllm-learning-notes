#!/usr/bin/env python3
"""Independently verify the saved three-rank Ring Attention example.

Usage: python verify_ring_attention.py [path/to/ring-attention-example.json]
Every saved round is checked by recomputing stable softmax statistics from
all visible keys encountered so far, rather than replaying the saved states.
Separate stress tests compare an online update with the same dense reference.
Only the Python standard library is used; no GPU/runtime claim is made.
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
                    label + ": expected a number")
            require(math.isfinite(actual) and math.isfinite(expected), label + ": non-finite number")
            self.max_error = max(self.max_error, abs(actual - expected))
            require(math.isclose(actual, expected, rel_tol=1e-12, abs_tol=1e-12),
                    f"{label}: saved={actual!r}, recomputed={expected!r}")
        else:
            require(type(actual) is type(expected) and actual == expected,
                    f"{label}: saved={actual!r}, recomputed={expected!r}")


def finite_tree(value, label="data"):
    """JSON null is allowed; NaN/Infinity anywhere is rejected."""
    if isinstance(value, dict):
        for key, item in value.items():
            finite_tree(item, label + "." + key)
    elif isinstance(value, list):
        for i, item in enumerate(value):
            finite_tree(item, f"{label}[{i}]")
    elif isinstance(value, float):
        require(math.isfinite(value), label + ": NaN/Infinity")


def initial_state(width):
    return {"m": None, "l": 0.0, "u": [0.0] * width, "O": None}


def dense_statistics(scores, values, visible):
    """Recompute the max-shifted sums directly over an explicit key set."""
    if not visible:
        return initial_state(len(values[0]))
    maximum = max(scores[i] for i in visible)
    exponentials = [math.exp(scores[i] - maximum) for i in visible]
    denominator = math.fsum(exponentials)
    numerator = [math.fsum(w * values[i][j] for i, w in zip(visible, exponentials))
                 for j in range(len(values[0]))]
    return {"m": maximum, "l": denominator, "u": numerator,
            "O": [value / denominator for value in numerator]}


def dense_probabilities(scores, masked):
    allowed = [i for i, hidden in enumerate(masked) if not hidden]
    if not allowed:
        return [0.0] * len(scores)
    maximum = max(scores[i] for i in allowed)
    numerators = [0.0 if hidden else math.exp(score - maximum)
                  for score, hidden in zip(scores, masked)]
    denominator = math.fsum(numerators)
    return [value / denominator for value in numerators]


def online_update(state, score, value, masked):
    """Used only by stress tests, never to validate saved JSON round states."""
    if masked:
        return {"m": state["m"], "l": state["l"], "u": state["u"][:],
                "O": None if state["O"] is None else state["O"][:]}
    maximum = score if state["m"] is None else max(state["m"], score)
    old_scale = 0.0 if state["m"] is None else math.exp(state["m"] - maximum)
    new_scale = math.exp(score - maximum)
    denominator = old_scale * state["l"] + new_scale
    numerator = [old_scale * u + new_scale * v for u, v in zip(state["u"], value)]
    return {"m": maximum, "l": denominator, "u": numerator,
            "O": [u / denominator for u in numerator]}


def ring_schedule(size):
    """Simulate each rank sending its resident origin to the next rank."""
    resident = list(range(size))
    schedule = [[] for _ in range(size)]
    for round_number in range(size):
        for rank in range(size):
            schedule[rank].append(resident[rank])
        if round_number < size - 1:
            next_resident = [None] * size
            for rank, origin in enumerate(resident):
                next_resident[(rank + 1) % size] = origin
            resident = next_resident
    return schedule


def verify_example(data, c):
    finite_tree(data)
    q, k, v = data["Q"], data["K"], data["V"]
    size = len(q)
    require(size == 3 and len(k) == size and len(v) == size, "expected three ranks/tokens")
    require(all(isinstance(row, list) and len(row) == 2 for matrix in (q, k, v) for row in matrix),
            "expected Q/K/V rows of width two")
    c.equal(data["d_k"], 2, "d_k")
    c.equal(data["d_v"], 2, "d_v")
    c.equal(data["score_scale"], 1.0 / math.sqrt(2), "score_scale")
    c.equal(data["positions"], list(range(size)), "global token positions")
    c.equal(data["initial_state"], initial_state(2), "initial state")
    ring = data["ring"]
    c.equal(ring["ranks"], size, "ring size")
    c.equal(ring["round_count"], size, "compute round count")
    c.equal(ring["exchange_count"], size - 1, "exchange count")
    c.equal(ring["send_to_by_rank"], [(r + 1) % size for r in range(size)], "send direction")
    c.equal(ring["receive_from_by_rank"], [(r - 1) % size for r in range(size)], "receive direction")
    schedule = ring_schedule(size)
    for rank in range(size):
        c.equal(schedule[rank], [(rank - t) % size for t in range(size)], "ring direction formula")
        c.equal(sorted(schedule[rank]), list(range(size)), "ring origin coverage")
    scores = [[math.fsum(a * b for a, b in zip(query, key)) / math.sqrt(2)
               for key in k] for query in q]
    require(set(data["modes"]) == {"full", "causal"}, "expected full and causal modes")
    for mode_name in ("full", "causal"):
        mode = data["modes"][mode_name]
        c.equal([r["rank"] for r in mode["ranks"]], list(range(size)), mode_name + ".ranks")
        mask_matrix, probabilities, reference, outputs = [], [], [], []
        for rank, saved in enumerate(mode["ranks"]):
            label = f"{mode_name}.rank{rank}"
            c.equal(saved["query_position"], rank, label + ".query_position")
            c.equal(saved["initial_state"], initial_state(2), label + ".initial_state")
            c.equal(len(saved["rounds"]), size, label + ".round count")
            masked = [mode_name == "causal" and pos > rank for pos in range(size)]
            mask_matrix.append(masked)
            encountered = []
            previous = initial_state(2)
            for t, step in enumerate(saved["rounds"]):
                origin = schedule[rank][t]
                c.equal(step["round"], t, label + ".round")
                c.equal(step["origin"], origin, label + ".origin")
                c.equal(step["key_position"], origin, label + ".key_position")
                c.equal(step["score"], scores[rank][origin], label + ".score")
                c.equal(step["masked"], masked[origin], label + ".mask")
                if not masked[origin]:
                    encountered.append(origin)
                # Independent prefix reference: rebuild all visible sums.
                expected = dense_statistics(scores[rank], v, encountered)
                state = {key: step[key] for key in ("m", "l", "u", "O")}
                c.equal(state, expected, f"{label}.round{t}.prefix softmax")
                if masked[origin]:
                    c.equal(state, previous, f"{label}.round{t}.masked zero contribution")
                previous = expected
            allowed = [i for i in range(size) if not masked[i]]
            full = dense_statistics(scores[rank], v, allowed)
            probs = dense_probabilities(scores[rank], masked)
            direct_output = [math.fsum(probs[i] * v[i][j] for i in range(size)) for j in range(2)]
            c.equal(previous["O"], direct_output, label + ".ring versus dense attention")
            c.equal(full["O"], direct_output, label + ".dense numerator versus probabilities")
            c.equal(saved["output"], direct_output, label + ".output")
            probabilities.append(probs)
            reference.append(direct_output)
            outputs.append(previous["O"])
        c.equal(mode["dense_scores"], scores, mode_name + ".dense_scores")
        c.equal(mode["dense_masked"], mask_matrix, mode_name + ".dense_masked")
        c.equal(mode["dense_probabilities"], probabilities, mode_name + ".dense_probabilities")
        c.equal(mode["reference"], reference, mode_name + ".dense reference")
        c.equal(mode["output"], outputs, mode_name + ".output matrix")


def verify_stability(c):
    values = [[1.0, 0.0], [0.0, 2.0], [3.0, 1.0]]
    # Naive exp(score) would overflow for positive 10000; max shifting must not.
    for scores in ([10000.0, 9999.0, -10000.0],
                   [-10000.0, -10001.0, -9999.0],
                   [10000.0, 10000.0, 10000.0]):
        for order in ring_schedule(3):
            state, visible = initial_state(2), []
            for origin in order:
                state = online_update(state, scores[origin], values[origin], False)
                visible.append(origin)
                finite_tree(state, "large-score state")
                c.equal(state, dense_statistics(scores, values, visible), "large-score prefix")
            c.equal(state["O"], dense_statistics(scores, values, [0, 1, 2])["O"],
                    "large-score order independence")
    state = initial_state(2)
    for score, value in zip([10000.0, -10000.0, 20000.0], values):
        state = online_update(state, score, value, True)
        finite_tree(state, "all-masked state")
        c.equal(state, initial_state(2), "all-masked block remains empty without NaN")
    # A visible block arriving after masked blocks must initialize cleanly.
    state = online_update(state, -10000.0, values[1], False)
    c.equal(state, dense_statistics([-10000.0], [values[1]], [0]), "first visible block")
    previous = {"m": state["m"], "l": state["l"], "u": state["u"][:], "O": state["O"][:]}
    state = online_update(state, 20000.0, [999.0, -999.0], True)
    finite_tree(state, "masked-after-visible state")
    c.equal(state, previous, "masked high score contributes exactly zero")
    c.equal(dense_statistics([1.0, 2.0], values[:2], []), initial_state(2),
            "dense empty-key reference")
    c.equal(dense_probabilities([1.0, 2.0], [True, True]), [0.0, 0.0],
            "all-masked probabilities")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_path", nargs="?", type=Path,
                        default=Path(__file__).with_name("ring-attention-example.json"))
    args = parser.parse_args()
    checks = Checks()
    try:
        data = json.loads(args.json_path.read_text(encoding="utf-8-sig"))
        verify_example(data, checks)
        print("PASS full/causal: every round matches independent prefix softmax and dense attention.")
        verify_stability(checks)
        print("PASS stress cases: large scores, all-masked/leading-masked blocks, direction and coverage.")
    except (OSError, ValueError, KeyError, TypeError, IndexError, ZeroDivisionError, OverflowError) as error:
        print(f"FAIL Ring Attention: {error}", file=sys.stderr)
        return 1
    print(f"PASS {checks.count} comparisons; max_abs_error={checks.max_error:.3g}.")
    print("Standard-library arithmetic only; no GPU/distributed runtime claim.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
