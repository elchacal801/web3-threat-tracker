import json
import pytest
from scripts.ingest.ingest_scamsniffer import ScamSnifferIngester


def test_parse_domains_only(tmp_path):
    ingester = ScamSnifferIngester(base_dir=str(tmp_path))
    raw = {"domains": ["evil.com", "scam.io", "www.phish.xyz"]}
    entries = ingester.parse(raw)
    assert len(entries) == 3
    assert all(e.sources == ["scamsniffer"] for e in entries)
    assert all(e.severity == "MALICIOUS" for e in entries)


def test_parse_with_wallet_mapping(tmp_path):
    ingester = ScamSnifferIngester(base_dir=str(tmp_path))
    raw = {
        "domains": ["evil.com"],
        "combined": {"evil.com": ["0xdead", "0xbeef"]},
    }
    entries = ingester.parse(raw)
    assert len(entries) == 1
    assert sorted(entries[0].wallet_addresses) == ["0xbeef", "0xdead"]
    assert entries[0].blockchain_network == "ethereum"


def test_parse_deduplicates(tmp_path):
    ingester = ScamSnifferIngester(base_dir=str(tmp_path))
    raw = {"domains": ["evil.com", "EVIL.COM", "evil.com"]}
    entries = ingester.parse(raw)
    assert len(entries) == 1
