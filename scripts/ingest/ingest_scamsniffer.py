import json
import logging
import subprocess
from pathlib import Path

from scripts.ingest.base import BaseIngester
from scripts.models import Entry, _normalize_domain

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/scamsniffer/scam-database.git"


class ScamSnifferIngester(BaseIngester):
    SOURCE_NAME = "scamsniffer"
    OUTPUT_DIR = "scamsniffer"

    def fetch(self) -> dict:
        repo_dir = self.output_dir / "repo"
        if (repo_dir / ".git").exists():
            subprocess.run(["git", "-C", str(repo_dir), "pull", "--quiet"], check=True)
        else:
            subprocess.run(["git", "clone", "--depth=1", REPO_URL, str(repo_dir)], check=True)

        result = {"domains": [], "combined": {}}
        domains_file = repo_dir / "blacklist" / "domains.json"
        if domains_file.exists():
            with open(domains_file) as f:
                result["domains"] = json.load(f)
        combined_file = repo_dir / "blacklist" / "combined.json"
        if combined_file.exists():
            with open(combined_file) as f:
                result["combined"] = json.load(f)
        return result

    def parse(self, raw_data: dict) -> list[Entry]:
        domains = raw_data.get("domains", [])
        combined = raw_data.get("combined", {})
        wallet_map = {}
        for domain_raw, wallets in combined.items():
            wallet_map[_normalize_domain(domain_raw)] = wallets

        seen = set()
        entries = []
        for domain_raw in domains:
            domain = _normalize_domain(domain_raw)
            if not domain or domain in seen:
                continue
            seen.add(domain)
            wallets = wallet_map.get(domain)
            entries.append(Entry(
                domain=domain, type="traditional_domain", severity="MALICIOUS",
                confidence="HIGH", tags=["phishing"], sources=["scamsniffer"],
                first_seen=self.now, last_seen=self.now, added_by="automated",
                wallet_addresses=sorted(wallets) if wallets else None,
                blockchain_network="ethereum" if wallets else None,
            ))
        return entries


def main():
    logging.basicConfig(level=logging.INFO)
    ingester = ScamSnifferIngester()
    entries = ingester.run()
    print(f"ScamSniffer: {len(entries)} entries ingested")


if __name__ == "__main__":
    main()
