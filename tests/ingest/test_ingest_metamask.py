import json
import pytest
from pathlib import Path
from scripts.ingest.ingest_metamask import MetaMaskIngester


@pytest.fixture
def mock_config(tmp_path):
    config = {
        "version": 2,
        "tolerance": 1,
        "fuzzylist": ["metamask.io"],
        "whitelist": ["coinbase.com"],
        "blacklist": [
            "evil-metamask.com",
            "fake-opensea.io",
            "www.phish-uniswap.xyz",
            "https://scam-wallet.net",
        ],
    }
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(config))
    return str(config_path)


def test_parse_blacklist(mock_config, tmp_path):
    ingester = MetaMaskIngester(base_dir=str(tmp_path))
    with open(mock_config) as f:
        raw = json.load(f)
    entries = ingester.parse(raw["blacklist"])
    assert len(entries) == 4
    domains = [e.domain for e in entries]
    assert "evil-metamask.com" in domains
    assert "phish-uniswap.xyz" in domains
    assert "scam-wallet.net" in domains


def test_entry_fields(mock_config, tmp_path):
    ingester = MetaMaskIngester(base_dir=str(tmp_path))
    with open(mock_config) as f:
        raw = json.load(f)
    entries = ingester.parse(raw["blacklist"])
    entry = entries[0]
    assert entry.severity == "MALICIOUS"
    assert entry.confidence == "HIGH"
    assert entry.tags == ["phishing"]
    assert entry.sources == ["metamask"]
    assert entry.type == "traditional_domain"
    assert entry.added_by == "automated"


def test_parse_whitelist(mock_config, tmp_path):
    ingester = MetaMaskIngester(base_dir=str(tmp_path))
    with open(mock_config) as f:
        raw = json.load(f)
    entries = ingester.parse_whitelist(raw["whitelist"])
    assert len(entries) == 1
    assert entries[0].domain == "coinbase.com"
    assert entries[0].severity == "LEGITIMATE"
    assert entries[0].confidence == "HIGH"


def test_parse_deduplicates(tmp_path):
    ingester = MetaMaskIngester(base_dir=str(tmp_path))
    raw = ["evil.com", "EVIL.COM", "www.evil.com"]
    entries = ingester.parse(raw)
    assert len(entries) == 1
