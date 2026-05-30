import pytest
from scripts.ingest.ingest_cryptoscamdb import CryptoScamDBIngester, _map_category


def test_map_category():
    assert "phishing" in _map_category("Phishing")
    assert "investment_scam" in _map_category("Scamming")
    assert "investment_scam" in _map_category("trust-trading")
    assert "fake_airdrop" in _map_category("Airdrop")
    assert "investment_scam" in _map_category("Mining")


def test_parse_entries(tmp_path):
    ingester = CryptoScamDBIngester(base_dir=str(tmp_path))
    raw = [
        {"name": "evil-metamask", "url": "https://evil-metamask.com", "category": "Phishing",
         "subcategory": "MyEtherWallet", "reporter": "CryptoScamDB"},
        {"name": "scam-trade", "url": "http://scam-trade.io/invest", "category": "Scamming",
         "subcategory": "Trust-Trading", "description": "Fake trading platform",
         "addresses": {"ETH": ["0xdead"]}},
    ]
    entries = ingester.parse(raw)
    assert len(entries) == 2
    assert entries[0].domain == "evil-metamask.com"
    assert entries[0].tags == ["phishing"]
    assert entries[0].sources == ["cryptoscamdb"]


def test_parse_with_wallet_addresses(tmp_path):
    ingester = CryptoScamDBIngester(base_dir=str(tmp_path))
    raw = [{"name": "drainer", "url": "https://drainer.xyz", "category": "Phishing",
            "addresses": {"ETH": ["0xaaa", "0xbbb"], "BTC": ["bc1qxyz"]}}]
    entries = ingester.parse(raw)
    assert len(entries) == 1
    assert sorted(entries[0].wallet_addresses) == ["0xaaa", "0xbbb", "bc1qxyz"]


def test_parse_skips_entries_without_url(tmp_path):
    ingester = CryptoScamDBIngester(base_dir=str(tmp_path))
    raw = [{"name": "no-url", "category": "Phishing"}]
    entries = ingester.parse(raw)
    assert len(entries) == 0
