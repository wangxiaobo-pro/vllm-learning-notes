#!/usr/bin/env python3
"""Verify the three-rank training DP example without third-party packages.

Usage: python verify_training_dp.py [path/to/training-dp.json]
Recomputes forward, loss, per-rank gradients, their average, and SGD updates.
Also differentiates the full-batch mean loss, including a finite-difference
check. This is an arithmetic check, not a distributed GPU execution test.
"""

import argparse
import json
import math
from pathlib import Path
import sys


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check(actual, expected, label, tolerance=1e-10):
    if isinstance(expected, list):
        require(isinstance(actual, list) and len(actual) == len(expected),
                f"{label}: wrong length/type")
        for i, (a, b) in enumerate(zip(actual, expected)):
            check(a, b, f"{label}[{i}]", tolerance)
    else:
        require(isinstance(actual, (int, float)) and not isinstance(actual, bool),
                f"{label}: expected a finite number")
        require(math.isfinite(actual) and math.isfinite(expected),
                f"{label}: non-finite number")
        require(math.isclose(actual, expected, rel_tol=tolerance, abs_tol=tolerance),
                f"{label}: stored={actual!r}, recomputed={expected!r}")


def shape(matrix):
    require(isinstance(matrix, list) and bool(matrix), "empty/non-list matrix")
    require(all(isinstance(row, list) and row for row in matrix), "empty/non-list row")
    width = len(matrix[0])
    require(all(len(row) == width for row in matrix), "ragged matrix")
    return len(matrix), width


def matmul(a, b):
    rows, inner = shape(a)
    other_inner, columns = shape(b)
    require(inner == other_inner, "incompatible matrix shapes")
    return [[sum(a[i][k] * b[k][j] for k in range(inner))
             for j in range(columns)] for i in range(rows)]


def transpose(a):
    shape(a)
    return [list(column) for column in zip(*a)]


def subtract(a, b):
    require(shape(a) == shape(b), "subtraction shape mismatch")
    return [[x - y for x, y in zip(ra, rb)] for ra, rb in zip(a, b)]


def scaled(a, factor):
    return [[factor * value for value in row] for row in a]


def mean_loss(x, target, weight):
    error = subtract(matmul(x, weight), target)
    return 0.5 * sum(value * value for row in error for value in row) / len(x)


def verify(data):
    world_size = data["world_size"]
    ranks = data["ranks"]
    x, target, weight = data["X"], data["T"], data["W"]
    rate = data["learning_rate"]
    require(world_size == 3 and len(ranks) == world_size, "expected three ranks")
    require([r["rank"] for r in ranks] == list(range(world_size)), "rank IDs/order differ")
    require(shape(x) == (3, 2) and shape(target) == (3, 2), "expected three 2D samples")
    require(shape(weight) == (2, 2), "expected complete 2x2 W")
    require(isinstance(rate, (int, float)) and math.isfinite(rate) and rate > 0,
            "invalid learning rate")
    gradients, losses = [], []
    for i, rank in enumerate(ranks):
        prefix = f"rank{i}"
        check(rank["X"], [x[i]], prefix + ".X")
        check(rank["T"], [target[i]], prefix + ".T")
        check(rank["W"], weight, prefix + ".replicated W")
        y = matmul([x[i]], weight)
        residual = subtract(y, [target[i]])
        loss = 0.5 * sum(value * value for row in residual for value in row)
        gradient = matmul(transpose([x[i]]), residual)
        check(rank["Y"], y, prefix + ".Y")
        check(rank["residual"], residual, prefix + ".residual")
        check(rank["loss"], loss, prefix + ".loss")
        check(rank["G"], gradient, prefix + ".G")
        gradients.append(gradient)
        losses.append(loss)
    summed = [[sum(g[i][j] for g in gradients) for j in range(2)] for i in range(2)]
    averaged = scaled(summed, 1.0 / world_size)
    next_weight = subtract(weight, scaled(averaged, rate))
    check(data["gradient_sum"], summed, "gradient_sum")
    check(data["gradient_mean"], averaged, "gradient_mean")
    check(data["Wnext"], next_weight, "Wnext")
    check(data["losses"], losses, "losses")
    check(data["loss_sum"], sum(losses), "loss_sum")
    check(data["loss_mean"], sum(losses) / world_size, "loss_mean")
    for i, rank in enumerate(ranks):
        check(rank["gradient_after_allreduce"], averaged, f"rank{i}.synchronized gradient")
        check(rank["Wnext"], next_weight, f"rank{i}.identical update")
    # Independent full-batch route: no per-rank gradient or stored result is used.
    batch_residual = subtract(matmul(x, weight), target)
    batch_gradient = scaled(matmul(transpose(x), batch_residual), 1.0 / len(x))
    check(averaged, batch_gradient, "rank mean versus full-batch gradient")
    check(data["batch_gradient_mean"], batch_gradient, "stored full-batch gradient")
    check(data["loss_mean"], mean_loss(x, target, weight), "full-batch mean loss")
    # Check the derivative directly against the scalar mean-loss function.
    epsilon = 1e-6
    numerical = [[0.0, 0.0], [0.0, 0.0]]
    for i in range(2):
        for j in range(2):
            plus, minus = [row[:] for row in weight], [row[:] for row in weight]
            plus[i][j] += epsilon
            minus[i][j] -= epsilon
            numerical[i][j] = (mean_loss(x, target, plus) - mean_loss(x, target, minus)) / (2 * epsilon)
    check(batch_gradient, numerical, "full-batch finite-difference gradient", tolerance=1e-8)
    return max(abs(batch_gradient[i][j] - numerical[i][j]) for i in range(2) for j in range(2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_path", nargs="?", type=Path,
                        default=Path(__file__).with_name("training-dp.json"))
    args = parser.parse_args()
    try:
        data = json.loads(args.json_path.read_text(encoding="utf-8-sig"))
        error = verify(data)
    except (OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        print(f"FAIL training DP: {exc}", file=sys.stderr)
        return 1
    print("PASS training DP: forward/loss, three local gradients, SUM/3, identical SGD updates.")
    print("PASS full-batch equivalence; finite-difference max_abs_error=" + format(error, ".3g"))
    print("Standard-library arithmetic only; no GPU/distributed runtime claim.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
