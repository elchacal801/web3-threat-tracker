import json
import logging
import subprocess
from pathlib import Path

from scripts.ingest.base import BaseIngester
from scripts.models import Entry, _normalize_domain

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/MetaMask/eth-phishing-detect.git"
CONFIG_PATH = "src/config.json"


class MetaMaskIngester(BaseIngester):
    SOURCE_NAME = "metamask"
    OUTPUT_DIR = "metamask"

    def fetch(self) -> list[str]:
        repo_dir = self.output_dir / "repo"
        if (repo_dir / ".git").exists():
            subprocess.run(["git", "-C", str(repo_dir), "pull", "--quiet"], check=True)
        else:
            subprocess.run(["git", "clone", "--depth=1", REPO_URL, str(repo_dir)], check=True)
        config_file = repo_dir / CONFIG_PATH
        with open(config_file) as f:
            config = json.load(f)
        return config.get("blacklist", [])

    def parse(self, raw_data: list[str]) -> list[Entry]:
        seen = set()
        entries = []
        for domain_raw in raw_data:
            domain = _normalize_domain(domain_raw)
            if not domain or domain in seen:
                continue
            seen.add(domain)
            entries.append(Entry(
                domain=domain, type="traditional_domain", severity="MALICIOUS",
                confidence="HIGH", tags=["phishing"], sources=["metamask"],
                first_seen=self.now, last_seen=self.now, added_by="automated",
            ))
        return entries

    def parse_whitelist(self, raw_data: list[str]) -> list[Entry]:
        seen = set()
        entries = []
        for domain_raw in raw_data:
            domain = _normalize_domain(domain_raw)
            if not domain or domain in seen:
                continue
            seen.add(domain)
            entries.append(Entry(
                domain=domain, type="traditional_domain", severity="LEGITIMATE",
                confidence="HIGH", tags=["phishing"], sources=["metamask"],
                first_seen=self.now, last_seen=self.now, added_by="automated",
            ))
        return entries


def main():
    logging.basicConfig(level=logging.INFO)
    ingester = MetaMaskIngester()
    entries = ingester.run()
    print(f"MetaMask: {len(entries)} entries ingested")


if __name__ == "__main__":
    main()
