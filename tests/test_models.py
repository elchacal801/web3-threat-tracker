import pytest
from datetime import datetime, timezone
from scripts.models import Entry, is_valid_domain


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


def test_entry_domain_strips_trailing_dot():
    entry = Entry(
        domain="evil.com.",
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


def test_is_valid_domain_accepts_normal_domain():
    assert is_valid_domain("evil.com") is True


def test_is_valid_domain_accepts_underscore_subdomain():
    # Real phishing hosts on platforms like typedream.app use underscores.
    assert is_valid_domain("acces_skrakken_docs_us.typedream.app") is True


def test_is_valid_domain_accepts_smart_contract_address():
    assert is_valid_domain("0x" + "a" * 40) is True


def test_is_valid_domain_rejects_empty():
    assert is_valid_domain("") is False


def test_is_valid_domain_rejects_ipv4():
    assert is_valid_domain("104.225.239.211") is False


def test_is_valid_domain_rejects_ipv6():
    assert is_valid_domain("2001:db8::1") is False


def test_is_valid_domain_rejects_url_path():
    # Google-Sites style phishing stored with a path is not a DNS-matchable
    # domain (the host is legitimate); it must not pollute the lookup feed.
    assert is_valid_domain("sites.google.com/new-app-uniswap.org/uni/uniswap") is False


def test_is_valid_domain_rejects_whitespace():
    assert is_valid_domain("evil domain.com") is False


def test_is_valid_domain_rejects_leading_dot():
    assert is_valid_domain(".evil.com") is False


def _entry(domain):
    return Entry(
        domain=domain, type="traditional_domain", severity="MALICIOUS",
        confidence="HIGH", tags=["phishing"], sources=["manual"],
        first_seen="2026-01-01T00:00:00Z", last_seen="2026-01-01T00:00:00Z",
        added_by="manual",
    )


def test_entry_domain_idn_converted_to_punycode():
    e = _entry("münchen.de")
    assert e.domain.isascii()
    assert e.domain.startswith("xn--")
    assert e.domain.endswith(".de")


def test_entry_domain_ascii_underscore_preserved_through_idn():
    # ASCII hostnames (incl. underscores) must pass through IDN handling untouched.
    assert _entry("_dmarc.evil.com").domain == "_dmarc.evil.com"
