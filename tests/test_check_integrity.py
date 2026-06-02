import pytest
from scripts.check_integrity import check_integrity


def _stats(total, by_source=None):
    return {"total": total, "by_source": by_source or {}}


def test_healthy_dataset_has_no_problems():
    new = _stats(450000, {"scamsniffer": 330000, "metamask": 108000})
    prior = _stats(449000, {"scamsniffer": 329000, "metamask": 108000})
    assert check_integrity(new, prior) == []


def test_total_below_floor_is_flagged():
    problems = check_integrity(_stats(1000), min_total=300000)
    assert len(problems) == 1
    assert "floor" in problems[0]


def test_large_total_drop_is_flagged():
    new = _stats(200000, {"scamsniffer": 200000})
    prior = _stats(450000, {"scamsniffer": 330000, "metamask": 108000})
    # 200k floor passes if we lower it; isolate the drop check
    problems = check_integrity(new, prior, min_total=100000, max_drop_frac=0.4)
    assert any("dropped" in p for p in problems)


def test_major_source_collapse_to_zero_is_flagged():
    new = _stats(340000, {"scamsniffer": 330000})  # metamask vanished
    prior = _stats(440000, {"scamsniffer": 330000, "metamask": 108000})
    problems = check_integrity(new, prior, min_total=100000, max_drop_frac=0.9)
    assert any("metamask" in p for p in problems)


def test_no_prior_stats_only_checks_floor():
    assert check_integrity(_stats(450000), None, min_total=300000) == []
    assert len(check_integrity(_stats(1000), None, min_total=300000)) == 1
