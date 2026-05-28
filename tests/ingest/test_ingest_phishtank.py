import pytest
from scripts.ingest.ingest_phishtank import PhishTankIngester, CRYPTO_TARGETS


def test_crypto_targets_not_empty():
    assert len(CRYPTO_TARGETS) > 0
    assert "coinbase" in CRYPTO_TARGETS
    assert "metamask" in CRYPTO_TARGETS


def test_parse_filters_crypto_only(tmp_path):
    ingester = PhishTankIngester(base_dir=str(tmp_path))
    raw = [
        {"url": "https://fake-coinbase.com/login", "target": "Coinbase", "submission_time": "2026-01-01T00:00:00Z"},
        {"url": "https://fake-bank.com/login", "target": "Chase Bank", "submission_time": "2026-01-01T00:00:00Z"},
        {"url": "https://fake-metamask.io", "target": "MetaMask", "submission_time": "2026-02-01T00:00:00Z"},
    ]
    entries = ingester.parse(raw)
    assert len(entries) == 2
    domains = [e.domain for e in entries]
    assert "fake-coinbase.com" in domains
    assert "fake-metamask.io" in domains
    assert "fake-bank.com" not in domains


def test_parse_sets_correct_fields(tmp_path):
    ingester = PhishTankIngester(base_dir=str(tmp_path))
    raw = [{"url": "https://evil-exchange.com", "target": "Binance", "submission_time": "2026-01-01T00:00:00Z"}]
    entries = ingester.parse(raw)
    assert entries[0].sources == ["phishtank"]
    assert entries[0].severity == "MALICIOUS"
    assert entries[0].confidence == "HIGH"
    assert "phishing" in entries[0].tags
