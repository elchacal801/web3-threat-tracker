# tests/test_build_db.py
import sqlite3
import pytest
from scripts.models import Entry
from scripts.build_db import build_database


def _make_entries():
    return [
        Entry(
            domain="evil.com", type="traditional_domain", severity="MALICIOUS",
            confidence="HIGH", tags=["phishing", "drainer"],
            sources=["metamask", "scamsniffer"],
            first_seen="2026-01-01T00:00:00Z", last_seen="2026-01-15T00:00:00Z",
            added_by="automated", ip_addresses=["1.2.3.4", "5.6.7.8"],
            wallet_addresses=["0xdead", "0xbeef"],
        ),
        Entry(
            domain="legit.com", type="traditional_domain", severity="LEGITIMATE",
            confidence="HIGH", tags=["phishing"], sources=["manual"],
            first_seen="2026-02-01T00:00:00Z", last_seen="2026-02-01T00:00:00Z",
            added_by="manual",
        ),
    ]


def test_build_database_creates_tables(tmp_path):
    db_path = str(tmp_path / "test.db")
    build_database(_make_entries(), db_path)
    conn = sqlite3.connect(db_path)
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    conn.close()
    assert "entries" in tables
    assert "entry_tags" in tables
    assert "entry_sources" in tables
    assert "entry_ips" in tables
    assert "entry_wallets" in tables


def test_build_database_entry_count(tmp_path):
    db_path = str(tmp_path / "test.db")
    build_database(_make_entries(), db_path)
    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    conn.close()
    assert count == 2


def test_build_database_tags_junction(tmp_path):
    db_path = str(tmp_path / "test.db")
    build_database(_make_entries(), db_path)
    conn = sqlite3.connect(db_path)
    tags = conn.execute(
        "SELECT et.tag FROM entry_tags et JOIN entries e ON et.entry_id=e.id WHERE e.domain='evil.com' ORDER BY et.tag"
    ).fetchall()
    conn.close()
    assert [t[0] for t in tags] == ["drainer", "phishing"]


def test_build_database_sources_junction(tmp_path):
    db_path = str(tmp_path / "test.db")
    build_database(_make_entries(), db_path)
    conn = sqlite3.connect(db_path)
    sources = conn.execute(
        "SELECT es.source FROM entry_sources es JOIN entries e ON es.entry_id=e.id WHERE e.domain='evil.com' ORDER BY es.source"
    ).fetchall()
    conn.close()
    assert [s[0] for s in sources] == ["metamask", "scamsniffer"]


def test_build_database_ips_junction(tmp_path):
    db_path = str(tmp_path / "test.db")
    build_database(_make_entries(), db_path)
    conn = sqlite3.connect(db_path)
    ips = conn.execute(
        "SELECT ei.ip FROM entry_ips ei JOIN entries e ON ei.entry_id=e.id WHERE e.domain='evil.com' ORDER BY ei.ip"
    ).fetchall()
    conn.close()
    assert [i[0] for i in ips] == ["1.2.3.4", "5.6.7.8"]


def test_build_database_wallets_junction(tmp_path):
    db_path = str(tmp_path / "test.db")
    build_database(_make_entries(), db_path)
    conn = sqlite3.connect(db_path)
    wallets = conn.execute(
        "SELECT ew.wallet FROM entry_wallets ew JOIN entries e ON ew.entry_id=e.id WHERE e.domain='evil.com' ORDER BY ew.wallet"
    ).fetchall()
    conn.close()
    assert [w[0] for w in wallets] == ["0xbeef", "0xdead"]


def test_build_database_query_by_tag(tmp_path):
    db_path = str(tmp_path / "test.db")
    build_database(_make_entries(), db_path)
    conn = sqlite3.connect(db_path)
    domains = conn.execute(
        "SELECT DISTINCT e.domain FROM entries e JOIN entry_tags et ON e.id=et.entry_id WHERE et.tag='drainer'"
    ).fetchall()
    conn.close()
    assert [d[0] for d in domains] == ["evil.com"]


def test_build_database_no_entries_for_legit_wallets(tmp_path):
    db_path = str(tmp_path / "test.db")
    build_database(_make_entries(), db_path)
    conn = sqlite3.connect(db_path)
    wallets = conn.execute(
        "SELECT ew.wallet FROM entry_wallets ew JOIN entries e ON ew.entry_id=e.id WHERE e.domain='legit.com'"
    ).fetchall()
    conn.close()
    assert wallets == []
