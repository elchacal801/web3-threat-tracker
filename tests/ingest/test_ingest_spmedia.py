import pytest
from scripts.ingest.ingest_spmedia import SpmediaIngester


def test_parse(tmp_path):
    ingester = SpmediaIngester(base_dir=str(tmp_path))
    raw = {"detected_urls": ["evil.com", "scam.io", "www.phish.xyz"]}
    entries = ingester.parse(raw)
    assert len(entries) == 3
    assert all(e.sources == ["spmedia"] for e in entries)
    assert all(e.severity == "MALICIOUS" for e in entries)
    assert all(e.confidence == "MEDIUM" for e in entries)


def test_parse_deduplicates(tmp_path):
    ingester = SpmediaIngester(base_dir=str(tmp_path))
    raw = {"detected_urls": ["evil.com", "EVIL.COM"]}
    entries = ingester.parse(raw)
    assert len(entries) == 1


def test_parse_empty(tmp_path):
    ingester = SpmediaIngester(base_dir=str(tmp_path))
    raw = {"detected_urls": []}
    entries = ingester.parse(raw)
    assert entries == []
