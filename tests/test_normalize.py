import pytest
from scripts.models import Entry
from scripts.normalize import merge_entries, normalize_and_dedup, severity_rank, compute_confidence


def _make_entry(domain="evil.com", severity="MALICIOUS", confidence="HIGH",
                tags=None, sources=None, first_seen="2026-01-01T00:00:00Z",
                last_seen="2026-01-01T00:00:00Z", **kwargs):
    return Entry(
        domain=domain,
        type="traditional_domain",
        severity=severity,
        confidence=confidence,
        tags=tags or ["phishing"],
        sources=sources or ["metamask"],
        first_seen=first_seen,
        last_seen=last_seen,
        added_by="automated",
        **kwargs,
    )


def test_severity_rank():
    assert severity_rank("MALICIOUS") > severity_rank("RISKY")
    assert severity_rank("RISKY") > severity_rank("SUSPICIOUS")
    assert severity_rank("SUSPICIOUS") > severity_rank("LEGITIMATE")


def test_merge_entries_takes_highest_severity():
    a = _make_entry(severity="SUSPICIOUS", sources=["metamask"])
    b = _make_entry(severity="MALICIOUS", sources=["scamsniffer"])
    merged = merge_entries(a, b)
    assert merged.severity == "MALICIOUS"


def test_merge_entries_takes_highest_confidence():
    a = _make_entry(confidence="LOW", sources=["metamask"])
    b = _make_entry(confidence="HIGH", sources=["scamsniffer"])
    merged = merge_entries(a, b)
    assert merged.confidence == "HIGH"


def test_merge_entries_unions_sources():
    a = _make_entry(sources=["metamask"])
    b = _make_entry(sources=["scamsniffer"])
    merged = merge_entries(a, b)
    assert sorted(merged.sources) == ["metamask", "scamsniffer"]


def test_merge_entries_unions_tags():
    a = _make_entry(tags=["phishing"])
    b = _make_entry(tags=["drainer"])
    merged = merge_entries(a, b)
    assert sorted(merged.tags) == ["drainer", "phishing"]


def test_merge_entries_earliest_first_seen():
    a = _make_entry(first_seen="2026-03-01T00:00:00Z")
    b = _make_entry(first_seen="2026-01-01T00:00:00Z")
    merged = merge_entries(a, b)
    assert merged.first_seen == "2026-01-01T00:00:00Z"


def test_merge_entries_latest_last_seen():
    a = _make_entry(last_seen="2026-01-01T00:00:00Z")
    b = _make_entry(last_seen="2026-03-01T00:00:00Z")
    merged = merge_entries(a, b)
    assert merged.last_seen == "2026-03-01T00:00:00Z"


def test_merge_entries_unions_ip_addresses():
    a = _make_entry(ip_addresses=["1.2.3.4"])
    b = _make_entry(ip_addresses=["5.6.7.8"])
    merged = merge_entries(a, b)
    assert sorted(merged.ip_addresses) == ["1.2.3.4", "5.6.7.8"]


def test_merge_entries_unions_wallet_addresses():
    a = _make_entry(wallet_addresses=["0xaaa"])
    b = _make_entry(wallet_addresses=["0xbbb"])
    merged = merge_entries(a, b)
    assert sorted(merged.wallet_addresses) == ["0xaaa", "0xbbb"]


def test_normalize_and_dedup():
    entries = [
        _make_entry(domain="evil.com", sources=["metamask"], severity="SUSPICIOUS"),
        _make_entry(domain="EVIL.COM", sources=["scamsniffer"], severity="MALICIOUS"),
        _make_entry(domain="other.com", sources=["manual"]),
    ]
    result = normalize_and_dedup(entries)
    assert len(result) == 2
    evil = next(e for e in result if e.domain == "evil.com")
    assert evil.severity == "MALICIOUS"
    assert sorted(evil.sources) == ["metamask", "scamsniffer"]


def test_normalize_and_dedup_preserves_unique():
    entries = [
        _make_entry(domain="a.com"),
        _make_entry(domain="b.com"),
        _make_entry(domain="c.com"),
    ]
    result = normalize_and_dedup(entries)
    assert len(result) == 3


def test_compute_confidence_multi_source_is_high():
    entries = [_make_entry(sources=["metamask", "scamsniffer"])]
    result = compute_confidence(entries)
    assert result[0].confidence == "HIGH"


def test_compute_confidence_single_high_quality_is_medium():
    entries = [_make_entry(sources=["metamask"])]
    result = compute_confidence(entries)
    assert result[0].confidence == "MEDIUM"


def test_compute_confidence_single_medium_quality_is_low():
    entries = [_make_entry(sources=["cryptoscamdb"])]
    result = compute_confidence(entries)
    assert result[0].confidence == "LOW"


def test_compute_confidence_unknown_source_is_low():
    entries = [_make_entry(sources=["some_unknown_feed"])]
    result = compute_confidence(entries)
    assert result[0].confidence == "LOW"
