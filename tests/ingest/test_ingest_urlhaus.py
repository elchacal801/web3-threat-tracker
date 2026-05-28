import pytest
from scripts.ingest.ingest_urlhaus import URLhausIngester, CRYPTO_TAGS


def test_crypto_tags_not_empty():
    assert len(CRYPTO_TAGS) > 0


def test_parse(tmp_path):
    ingester = URLhausIngester(base_dir=str(tmp_path))
    raw = [
        {"url": "https://evil-miner.com/payload.js", "host": "evil-miner.com",
         "date_added": "2026-01-15 10:00:00 UTC", "threat": "malware_download",
         "tags": ["CoinMiner", "cryptojacking"]},
        {"url": "https://crypto-drain.xyz/wallet", "host": "crypto-drain.xyz",
         "date_added": "2026-02-01 08:00:00 UTC", "threat": "malware_download",
         "tags": ["crypto", "stealer"]},
    ]
    entries = ingester.parse(raw)
    assert len(entries) == 2
    assert entries[0].domain == "evil-miner.com"
    assert entries[0].sources == ["urlhaus"]


def test_parse_deduplicates(tmp_path):
    ingester = URLhausIngester(base_dir=str(tmp_path))
    raw = [
        {"url": "https://evil.com/a", "host": "evil.com", "date_added": "2026-01-01 00:00:00 UTC",
         "threat": "malware_download", "tags": ["crypto"]},
        {"url": "https://evil.com/b", "host": "evil.com", "date_added": "2026-01-02 00:00:00 UTC",
         "threat": "malware_download", "tags": ["crypto"]},
    ]
    entries = ingester.parse(raw)
    assert len(entries) == 1
