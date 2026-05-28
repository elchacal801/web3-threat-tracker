import logging
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import yaml

from scripts.ingest.base import BaseIngester
from scripts.models import Entry, _normalize_domain

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/CryptoScamDB/blacklist.git"

CATEGORY_MAP = {
    "Phishing": ["phishing"],
    "Scamming": ["investment_scam"],
    "Fake ICO": ["rug_pull"],
}


def _map_category(category: str) -> list[str]:
    return CATEGORY_MAP.get(category, ["phishing"])


class CryptoScamDBIngester(BaseIngester):
    SOURCE_NAME = "cryptoscamdb"
    OUTPUT_DIR = "cryptoscamdb"

    def fetch(self) -> list[dict]:
        repo_dir = self.output_dir / "repo"
        if (repo_dir / ".git").exists():
            subprocess.run(["git", "-C", str(repo_dir), "pull", "--quiet"], check=True)
        else:
            subprocess.run(["git", "clone", "--depth=1", REPO_URL, str(repo_dir)], check=True)
        urls_file = repo_dir / "data" / "urls.yaml"
        with open(urls_file) as f:
            return yaml.safe_load(f) or []

    def parse(self, raw_data: list[dict]) -> list[Entry]:
        seen = set()
        entries = []
        for item in raw_data:
            url = item.get("url")
            if not url:
                continue
            parsed = urlparse(url)
            domain = _normalize_domain(parsed.hostname or url)
            if not domain or domain in seen:
                continue
            seen.add(domain)
            tags = _map_category(item.get("category", ""))
            wallets = []
            for chain_wallets in (item.get("addresses") or {}).values():
                if isinstance(chain_wallets, list):
                    wallets.extend(chain_wallets)
            entries.append(Entry(
                domain=domain, url=url if parsed.path and parsed.path != "/" else None,
                type="traditional_domain", severity="MALICIOUS", confidence="MEDIUM",
                tags=tags, sources=["cryptoscamdb"], first_seen=self.now, last_seen=self.now,
                added_by="automated", wallet_addresses=sorted(wallets) if wallets else None,
                notes=item.get("description"),
            ))
        return entries


def main():
    logging.basicConfig(level=logging.INFO)
    ingester = CryptoScamDBIngester()
    entries = ingester.run()
    print(f"CryptoScamDB: {len(entries)} entries ingested")


if __name__ == "__main__":
    main()
