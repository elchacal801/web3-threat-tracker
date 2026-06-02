# tests/test_export_csv.py
import csv
import pytest
from pathlib import Path
from scripts.models import Entry
from scripts.export_csv import (
    export_all,
    export_filtered,
    load_and_clean_entries,
    CSV_COLUMNS,
)


def _make_entries():
    return [
        Entry(
            domain="evil.com", type="traditional_domain", severity="MALICIOUS",
            confidence="HIGH", tags=["phishing", "drainer"], sources=["metamask"],
            first_seen="2026-01-01T00:00:00Z", last_seen="2026-01-15T00:00:00Z",
            added_by="automated", ip_addresses=["1.2.3.4"], asn="AS1234",
            hosting_provider="CloudEvil", blockchain_network="ethereum",
            wallet_addresses=["0xdead"],
        ),
        Entry(
            domain="suspicious.io", type="traditional_domain", severity="SUSPICIOUS",
            confidence="LOW", tags=["typosquat"], sources=["scamsniffer"],
            first_seen="2026-02-01T00:00:00Z", last_seen="2026-02-01T00:00:00Z",
            added_by="automated",
        ),
        Entry(
            domain="legit.com", type="traditional_domain", severity="LEGITIMATE",
            confidence="HIGH", tags=["phishing"], sources=["manual"],
            first_seen="2026-03-01T00:00:00Z", last_seen="2026-03-01T00:00:00Z",
            added_by="manual",
        ),
    ]


def test_csv_columns_order():
    assert CSV_COLUMNS[0] == "domain"
    assert CSV_COLUMNS[1] == "severity"
    assert CSV_COLUMNS[2] == "confidence"
    assert "tags" in CSV_COLUMNS
    assert "sources" in CSV_COLUMNS


def test_export_all(tmp_path):
    out = str(tmp_path / "all.csv")
    export_all(_make_entries(), out)
    with open(out) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) == 3
    assert rows[0]["domain"] == "evil.com"
    assert rows[0]["tags"] == "drainer|phishing"
    assert rows[0]["ip_addresses"] == "1.2.3.4"
    assert rows[0]["wallet_addresses"] == "0xdead"


def test_export_filtered_by_severity(tmp_path):
    out = str(tmp_path / "malicious.csv")
    export_filtered(_make_entries(), out, severity="MALICIOUS")
    with open(out) as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 1
    assert rows[0]["domain"] == "evil.com"


def test_export_filtered_by_confidence(tmp_path):
    out = str(tmp_path / "high.csv")
    export_filtered(_make_entries(), out, confidence="HIGH")
    with open(out) as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 2


def test_export_filtered_by_tag(tmp_path):
    out = str(tmp_path / "drainer.csv")
    export_filtered(_make_entries(), out, tag="drainer")
    with open(out) as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 1
    assert rows[0]["domain"] == "evil.com"


def test_export_list_fields_pipe_separated(tmp_path):
    out = str(tmp_path / "all.csv")
    export_all(_make_entries(), out)
    with open(out) as f:
        rows = list(csv.DictReader(f))
    assert rows[0]["sources"] == "metamask"
    assert rows[0]["tags"] == "drainer|phishing"


def test_export_is_utf8_regardless_of_platform(tmp_path):
    # A non-ASCII field value (e.g. a registrar name) must round-trip as UTF-8
    # so the lookup file is valid for LogScale on any OS (Windows would
    # otherwise default to cp1252 and emit invalid UTF-8).
    out = str(tmp_path / "u.csv")
    entries = [Entry(
        domain="evil.com", type="traditional_domain", severity="MALICIOUS",
        confidence="HIGH", tags=["phishing"], sources=["metamask"],
        first_seen="2026-01-01T00:00:00Z", last_seen="2026-01-01T00:00:00Z",
        added_by="automated", registrar="Müller Registrar 中文",
    )]
    export_all(entries, out)
    with open(out, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert rows[0]["registrar"] == "Müller Registrar 中文"


def test_load_and_clean_entries_dedups_and_drops_invalid(tmp_path):
    entries_dir = tmp_path / "entries"
    entries_dir.mkdir()
    (entries_dir / "a.yaml").write_text(
        "\n".join([
            "- domain: evil.com",
            "  type: traditional_domain",
            "  severity: MALICIOUS",
            "  confidence: HIGH",
            "  tags: [phishing]",
            "  sources: [metamask]",
            "  first_seen: '2026-01-01T00:00:00Z'",
            "  last_seen: '2026-01-01T00:00:00Z'",
            "  added_by: automated",
            "- domain: evil.com.",
            "  type: traditional_domain",
            "  severity: MALICIOUS",
            "  confidence: HIGH",
            "  tags: [phishing]",
            "  sources: [scamsniffer]",
            "  first_seen: '2026-01-01T00:00:00Z'",
            "  last_seen: '2026-01-01T00:00:00Z'",
            "  added_by: automated",
            "- domain: 104.225.239.211",
            "  type: traditional_domain",
            "  severity: MALICIOUS",
            "  confidence: HIGH",
            "  tags: [phishing]",
            "  sources: [scamsniffer]",
            "  first_seen: '2026-01-01T00:00:00Z'",
            "  last_seen: '2026-01-01T00:00:00Z'",
            "  added_by: automated",
        ]),
        encoding="utf-8",
    )
    cleaned = load_and_clean_entries(str(entries_dir))
    domains = [e.domain for e in cleaned]
    assert domains == ["evil.com"]  # trailing-dot merged, IP dropped
    assert sorted(cleaned[0].sources) == ["metamask", "scamsniffer"]
