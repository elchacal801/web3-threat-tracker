# scripts/build_db.py
import sqlite3
import sys
from pathlib import Path

import yaml

from scripts.models import Entry
from scripts.normalize import load_entries_from_yaml


def build_database(entries: list[Entry], db_path: str) -> None:
    """Build SQLite database from a list of Entry objects."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")

    conn.executescript("""
        CREATE TABLE entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL UNIQUE,
            url TEXT,
            type TEXT NOT NULL,
            severity TEXT NOT NULL,
            confidence TEXT NOT NULL,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            added_by TEXT NOT NULL,
            registrar TEXT,
            registration_date TEXT,
            whois_privacy INTEGER,
            hosting_provider TEXT,
            asn TEXT,
            ssl_issuer TEXT,
            ssl_validity_days INTEGER,
            blockchain_network TEXT,
            ens_name TEXT,
            unstoppable_domain TEXT,
            notes TEXT
        );

        CREATE TABLE entry_tags (
            entry_id INTEGER NOT NULL REFERENCES entries(id),
            tag TEXT NOT NULL,
            PRIMARY KEY (entry_id, tag)
        );

        CREATE TABLE entry_sources (
            entry_id INTEGER NOT NULL REFERENCES entries(id),
            source TEXT NOT NULL,
            PRIMARY KEY (entry_id, source)
        );

        CREATE TABLE entry_ips (
            entry_id INTEGER NOT NULL REFERENCES entries(id),
            ip TEXT NOT NULL,
            PRIMARY KEY (entry_id, ip)
        );

        CREATE TABLE entry_wallets (
            entry_id INTEGER NOT NULL REFERENCES entries(id),
            wallet TEXT NOT NULL,
            PRIMARY KEY (entry_id, wallet)
        );

        CREATE INDEX idx_entries_domain ON entries(domain);
        CREATE INDEX idx_entries_severity ON entries(severity);
        CREATE INDEX idx_entries_confidence ON entries(confidence);
        CREATE INDEX idx_entry_tags_tag ON entry_tags(tag);
        CREATE INDEX idx_entry_sources_source ON entry_sources(source);
        CREATE INDEX idx_entry_ips_ip ON entry_ips(ip);
        CREATE INDEX idx_entry_wallets_wallet ON entry_wallets(wallet);
    """)

    for entry in entries:
        cursor = conn.execute(
            """INSERT INTO entries (domain, url, type, severity, confidence, first_seen, last_seen,
               added_by, registrar, registration_date, whois_privacy, hosting_provider, asn,
               ssl_issuer, ssl_validity_days, blockchain_network, ens_name, unstoppable_domain, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (entry.domain, entry.url, entry.type, entry.severity, entry.confidence,
             entry.first_seen, entry.last_seen, entry.added_by, entry.registrar,
             entry.registration_date, entry.whois_privacy, entry.hosting_provider, entry.asn,
             entry.ssl_issuer, entry.ssl_validity_days, entry.blockchain_network,
             entry.ens_name, entry.unstoppable_domain, entry.notes),
        )
        entry_id = cursor.lastrowid

        for tag in entry.tags:
            conn.execute("INSERT INTO entry_tags (entry_id, tag) VALUES (?, ?)", (entry_id, tag))
        for source in entry.sources:
            conn.execute("INSERT INTO entry_sources (entry_id, source) VALUES (?, ?)", (entry_id, source))
        for ip in (entry.ip_addresses or []):
            conn.execute("INSERT INTO entry_ips (entry_id, ip) VALUES (?, ?)", (entry_id, ip))
        for wallet in (entry.wallet_addresses or []):
            conn.execute("INSERT INTO entry_wallets (entry_id, wallet) VALUES (?, ?)", (entry_id, wallet))

    conn.commit()
    conn.close()


def main():
    """CLI: build database from data/entries/*.yaml."""
    base = Path(__file__).parent.parent
    entries_dir = base / "data" / "entries"
    db_path = base / "data" / "exports" / "web3_tracker.db"

    all_entries = []
    for yaml_file in sorted(entries_dir.glob("*.yaml")):
        all_entries.extend(load_entries_from_yaml(str(yaml_file)))

    build_database(all_entries, str(db_path))
    print(f"Built database with {len(all_entries)} entries at {db_path}")


if __name__ == "__main__":
    main()
