import json
import logging
import subprocess
from pathlib import Path

from scripts.ingest.base import BaseIngester
from scripts.models import Entry, _normalize_domain

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/spmedia/Crypto-Scam-and-Crypto-Phishing-Threat-Intel-Feed.git"


class SpmediaIngester(BaseIngester):
    SOURCE_NAME = "spmedia"
    OUTPUT_DIR = "spmedia"

    def fetch(self) -> dict:
        repo_dir = self.output_dir / "repo"
        if (repo_dir / ".git").exists():
            subprocess.run(["git", "-C", str(repo_dir), "pull", "--quiet"], check=True)
        else:
            subprocess.run(["git", "clone", "--depth=1", REPO_URL, str(repo_dir)], check=True)
        json_file = repo_dir / "detected_urls.json"
        with open(json_file) as f:
            return json.load(f)

    def parse(self, raw_data: dict) -> list[Entry]:
        domains_raw = raw_data.get("detected_urls", [])
        seen = set()
        entries = []
        for domain_raw in domains_raw:
            domain = _normalize_domain(domain_raw)
            if not domain or domain in seen:
                continue
            seen.add(domain)
            entries.append(Entry(
                domain=domain, type="traditional_domain", severity="MALICIOUS",
                confidence="MEDIUM", tags=["phishing"], sources=["spmedia"],
                first_seen=self.now, last_seen=self.now, added_by="automated",
            ))
        return entries


def main():
    logging.basicConfig(level=logging.INFO)
    ingester = SpmediaIngester()
    entries = ingester.run()
    print(f"spmedia: {len(entries)} entries ingested")


if __name__ == "__main__":
    main()
