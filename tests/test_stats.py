# tests/test_stats.py
import json
import pytest
from scripts.models import Entry
from scripts.stats import generate_stats


def _make_entries():
    return [
        Entry(domain="a.com", type="traditional_domain", severity="MALICIOUS",
              confidence="HIGH", tags=["phishing", "drainer"], sources=["metamask", "scamsniffer"],
              first_seen="2026-01-01T00:00:00Z", last_seen="2026-01-01T00:00:00Z", added_by="automated"),
        Entry(domain="b.com", type="traditional_domain", severity="SUSPICIOUS",
              confidence="LOW", tags=["typosquat"], sources=["scamsniffer"],
              first_seen="2026-02-01T00:00:00Z", last_seen="2026-02-01T00:00:00Z", added_by="automated"),
        Entry(domain="c.com", type="ens", severity="MALICIOUS",
              confidence="MEDIUM", tags=["phishing"], sources=["manual"],
              first_seen="2026-03-01T00:00:00Z", last_seen="2026-03-01T00:00:00Z", added_by="manual"),
    ]


def test_total_count():
    stats = generate_stats(_make_entries())
    assert stats["total"] == 3


def test_by_severity():
    stats = generate_stats(_make_entries())
    assert stats["by_severity"]["MALICIOUS"] == 2
    assert stats["by_severity"]["SUSPICIOUS"] == 1


def test_by_confidence():
    stats = generate_stats(_make_entries())
    assert stats["by_confidence"]["HIGH"] == 1
    assert stats["by_confidence"]["LOW"] == 1
    assert stats["by_confidence"]["MEDIUM"] == 1


def test_by_tag():
    stats = generate_stats(_make_entries())
    assert stats["by_tag"]["phishing"] == 2
    assert stats["by_tag"]["drainer"] == 1
    assert stats["by_tag"]["typosquat"] == 1


def test_by_source():
    stats = generate_stats(_make_entries())
    assert stats["by_source"]["scamsniffer"] == 2
    assert stats["by_source"]["metamask"] == 1
    assert stats["by_source"]["manual"] == 1


def test_by_type():
    stats = generate_stats(_make_entries())
    assert stats["by_type"]["traditional_domain"] == 2
    assert stats["by_type"]["ens"] == 1
