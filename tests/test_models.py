import pytest
from datetime import datetime, timezone
from scripts.models import Entry


def test_entry_creation_minimal():
    entry = Entry(
        domain="evil-metamask.com",
        type="traditional_domain",
        severity="MALICIOUS",
        confidence="HIGH",
        tags=["phishing"],
        sources=["metamask"],
        first_seen="2026-01-15T00:00:00Z",
        last_seen="2026-01-15T00:00:00Z",
        added_by="automated",
    )
    assert entry.domain == "evil-metamask.com"
    assert entry.severity == "MALICIOUS"
    assert entry.tags == ["phishing"]


def test_entry_creation_full():
    entry = Entry(
        domain="fake-uniswap.xyz",
        url="https://fake-uniswap.xyz/swap",
        type="traditional_domain",
        severity="MALICIOUS",
        confidence="HIGH",
        tags=["drainer", "defi_impersonation"],
        sources=["metamask", "scamsniffer"],
        first_seen="2026-01-10T00:00:00Z",
        last_seen="2026-01-20T00:00:00Z",
        added_by="automated",
        registrar="Namecheap",
        ip_addresses=["1.2.3.4"],
        wallet_addresses=["0xdead"],
        blockchain_network="ethereum",
        notes="Uniswap impersonation with wallet drainer",
    )
    assert entry.wallet_addresses == ["0xdead"]
    assert "drainer" in entry.tags


def test_entry_to_dict():
    entry = Entry(
        domain="test.com",
        type="traditional_domain",
        severity="SUSPICIOUS",
        confidence="LOW",
        tags=["phishing"],
        sources=["manual"],
        first_seen="2026-01-01T00:00:00Z",
        last_seen="2026-01-01T00:00:00Z",
        added_by="manual",
    )
    d = entry.to_dict()
    assert d["domain"] == "test.com"
    assert d["severity"] == "SUSPICIOUS"
    # Optional fields with None should be excluded
    assert "registrar" not in d
    assert "wallet_addresses" not in d


def test_entry_from_dict():
    data = {
        "domain": "scam.io",
        "type": "traditional_domain",
        "severity": "MALICIOUS",
        "confidence": "MEDIUM",
        "tags": ["rug_pull"],
        "sources": ["cryptoscamdb"],
        "first_seen": "2026-02-01T00:00:00Z",
        "last_seen": "2026-02-01T00:00:00Z",
        "added_by": "automated",
    }
    entry = Entry.from_dict(data)
    assert entry.domain == "scam.io"
    assert entry.tags == ["rug_pull"]


def test_entry_domain_normalized_lowercase():
    entry = Entry(
        domain="EVIL.COM",
        type="traditional_domain",
        severity="MALICIOUS",
        confidence="HIGH",
        tags=["phishing"],
        sources=["manual"],
        first_seen="2026-01-01T00:00:00Z",
        last_seen="2026-01-01T00:00:00Z",
        added_by="manual",
    )
    assert entry.domain == "evil.com"


def test_entry_domain_strips_protocol():
    entry = Entry(
        domain="https://evil.com",
        type="traditional_domain",
        severity="MALICIOUS",
        confidence="HIGH",
        tags=["phishing"],
        sources=["manual"],
        first_seen="2026-01-01T00:00:00Z",
        last_seen="2026-01-01T00:00:00Z",
        added_by="manual",
    )
    assert entry.domain == "evil.com"


def test_entry_domain_strips_www():
    entry = Entry(
        domain="www.evil.com",
        type="traditional_domain",
        severity="MALICIOUS",
        confidence="HIGH",
        tags=["phishing"],
        sources=["manual"],
        first_seen="2026-01-01T00:00:00Z",
        last_seen="2026-01-01T00:00:00Z",
        added_by="manual",
    )
    assert entry.domain == "evil.com"


def test_entry_domain_strips_trailing_slash():
    entry = Entry(
        domain="evil.com/",
        type="traditional_domain",
        severity="MALICIOUS",
        confidence="HIGH",
        tags=["phishing"],
        sources=["manual"],
        first_seen="2026-01-01T00:00:00Z",
        last_seen="2026-01-01T00:00:00Z",
        added_by="manual",
    )
    assert entry.domain == "evil.com"
