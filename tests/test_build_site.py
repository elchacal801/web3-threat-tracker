import json
import pytest
from pathlib import Path
from scripts.models import Entry
from scripts.build_site import build_search_index, build_detail_shards


def _make_entries():
    return [
        Entry(domain="evil.com", type="traditional_domain", severity="MALICIOUS",
              confidence="HIGH", tags=["phishing", "drainer"], sources=["metamask", "scamsniffer"],
              first_seen="2026-01-01T00:00:00Z", last_seen="2026-01-15T00:00:00Z",
              added_by="automated", ip_addresses=["1.2.3.4"], wallet_addresses=["0xdead"]),
        Entry(domain="legit.com", type="traditional_domain", severity="LEGITIMATE",
              confidence="HIGH", tags=["phishing"], sources=["manual"],
              first_seen="2026-02-01T00:00:00Z", last_seen="2026-02-01T00:00:00Z",
              added_by="manual"),
        Entry(domain="456scam.net", type="traditional_domain", severity="MALICIOUS",
              confidence="MEDIUM", tags=["rug_pull"], sources=["cryptoscamdb"],
              first_seen="2026-03-01T00:00:00Z", last_seen="2026-03-01T00:00:00Z",
              added_by="automated"),
    ]


def test_build_search_index():
    index = build_search_index(_make_entries())
    assert len(index) == 3
    assert index[0]["d"] == "456scam.net"  # sorted alphabetically
    assert index[0]["s"] == "MALICIOUS"
    assert index[0]["c"] == "MEDIUM"
    assert index[0]["t"] == ["rug_pull"]
    assert index[0]["src"] == ["cryptoscamdb"]


def test_build_search_index_short_keys():
    index = build_search_index(_make_entries())
    entry = index[1]  # evil.com
    assert set(entry.keys()) == {"d", "s", "c", "t", "src"}


def test_build_detail_shards(tmp_path):
    build_detail_shards(_make_entries(), str(tmp_path))
    assert (tmp_path / "e.json").exists()
    assert (tmp_path / "l.json").exists()
    assert (tmp_path / "numeric.json").exists()

    with open(tmp_path / "e.json") as f:
        data = json.load(f)
    assert len(data) == 1
    assert data[0]["domain"] == "evil.com"
    assert data[0]["wallet_addresses"] == ["0xdead"]


def test_build_detail_shards_numeric(tmp_path):
    build_detail_shards(_make_entries(), str(tmp_path))
    with open(tmp_path / "numeric.json") as f:
        data = json.load(f)
    assert len(data) == 1
    assert data[0]["domain"] == "456scam.net"
