import pytest
from scripts.ingest.ingest_chainabuse import ChainabuseIngester, _map_chainabuse_category


def test_map_category():
    assert "phishing" in _map_chainabuse_category("phishing")
    assert "rug_pull" in _map_chainabuse_category("rugpull")
    assert "investment_scam" in _map_chainabuse_category("scam")
    assert "drainer" in _map_chainabuse_category("theft")


def test_parse_reports(tmp_path):
    ingester = ChainabuseIngester(base_dir=str(tmp_path))
    raw = [
        {"id": "1", "domain": "evil-exchange.com",
         "addresses": [{"address": "0xdead", "chain": "ethereum"}],
         "category": "phishing", "description": "Fake exchange",
         "createdAt": "2026-01-15T10:00:00Z"},
        {"id": "2", "domain": "rug-token.io", "addresses": [],
         "category": "rugpull", "createdAt": "2026-02-01T10:00:00Z"},
    ]
    entries = ingester.parse(raw)
    assert len(entries) == 2
    assert entries[0].domain == "evil-exchange.com"
    assert entries[0].wallet_addresses == ["0xdead"]
    assert entries[0].blockchain_network == "ethereum"
    assert entries[0].tags == ["phishing"]


def test_parse_skips_entries_without_domain(tmp_path):
    ingester = ChainabuseIngester(base_dir=str(tmp_path))
    raw = [{"id": "1", "addresses": [{"address": "0xdead", "chain": "ethereum"}], "category": "phishing"}]
    entries = ingester.parse(raw)
    assert len(entries) == 0


def test_parse_deduplicates(tmp_path):
    ingester = ChainabuseIngester(base_dir=str(tmp_path))
    raw = [
        {"id": "1", "domain": "evil.com", "addresses": [], "category": "phishing", "createdAt": "2026-01-01T00:00:00Z"},
        {"id": "2", "domain": "EVIL.COM", "addresses": [], "category": "scam", "createdAt": "2026-02-01T00:00:00Z"},
    ]
    entries = ingester.parse(raw)
    assert len(entries) == 1
