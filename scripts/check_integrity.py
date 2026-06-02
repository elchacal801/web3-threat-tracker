"""Guard against silent dataset collapse.

Every ingester in the daily workflow runs with continue-on-error, so a broken
upstream feed (e.g. ScamSniffer, ~74% of the data) could silently shrink the
dataset and still publish a gutted lookup feed. This module fails the pipeline
when the dataset drops implausibly far below a floor or below the previous run.
"""
import json
import subprocess
import sys
from pathlib import Path

STATS_PATH = Path(__file__).parent.parent / "data" / "exports" / "stats.json"
MIN_TOTAL = 300_000
MAX_DROP_FRAC = 0.4
MAJOR_SOURCE_MIN = 1000


def check_integrity(new_stats, prior_stats=None, *, min_total=MIN_TOTAL,
                    max_drop_frac=MAX_DROP_FRAC) -> list[str]:
    """Return a list of integrity problems (empty == healthy)."""
    problems = []
    total = new_stats.get("total", 0)
    if total < min_total:
        problems.append(f"total {total} is below floor {min_total}")

    if prior_stats:
        prior_total = prior_stats.get("total", 0)
        if prior_total and total < prior_total * (1 - max_drop_frac):
            problems.append(
                f"total dropped {prior_total} -> {total} "
                f"(more than {int(max_drop_frac * 100)}%)"
            )
        new_by_source = new_stats.get("by_source", {})
        for src, cnt in prior_stats.get("by_source", {}).items():
            if cnt >= MAJOR_SOURCE_MIN and new_by_source.get(src, 0) == 0:
                problems.append(f"major source '{src}' collapsed {cnt} -> 0")

    return problems


def _load_prior_stats() -> dict | None:
    """Load the committed (HEAD) stats.json for comparison, if available."""
    try:
        out = subprocess.run(
            ["git", "show", "HEAD:data/exports/stats.json"],
            capture_output=True, text=True, check=True,
            cwd=str(Path(__file__).parent.parent),
        )
        return json.loads(out.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError, FileNotFoundError):
        return None


def main():
    with open(STATS_PATH, encoding="utf-8") as f:
        new_stats = json.load(f)
    problems = check_integrity(new_stats, _load_prior_stats())
    if problems:
        print("Dataset integrity check FAILED:")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"Dataset integrity OK: {new_stats.get('total')} entries")


if __name__ == "__main__":
    main()
