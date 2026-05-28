import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path

import yaml

from scripts.models import Entry

logger = logging.getLogger(__name__)


class BaseIngester(ABC):
    """Base class for upstream feed ingestion."""

    SOURCE_NAME: str = ""  # Override in subclass
    OUTPUT_DIR: str = ""   # Override in subclass (relative to data/sources/)

    def __init__(self, base_dir: str | None = None):
        self.base_dir = Path(base_dir) if base_dir else Path(__file__).parent.parent.parent
        self.output_dir = self.base_dir / "data" / "sources" / self.OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.now = datetime.now(timezone.utc).isoformat()

    @abstractmethod
    def fetch(self) -> list[dict]:
        """Fetch raw data from upstream source. Returns list of raw domain dicts."""

    @abstractmethod
    def parse(self, raw_data: list[dict]) -> list[Entry]:
        """Parse raw data into Entry objects."""

    def run(self) -> list[Entry]:
        """Execute full ingestion pipeline: fetch → parse → save."""
        logger.info(f"[{self.SOURCE_NAME}] Starting ingestion...")
        raw = self.fetch()
        logger.info(f"[{self.SOURCE_NAME}] Fetched {len(raw)} raw items")
        entries = self.parse(raw)
        logger.info(f"[{self.SOURCE_NAME}] Parsed {len(entries)} entries")
        self.save(entries)
        return entries

    def save(self, entries: list[Entry]) -> None:
        """Save parsed entries to YAML in the source output directory."""
        out_path = self.output_dir / "entries.yaml"
        data = [e.to_dict() for e in entries]
        with open(out_path, "w") as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
        logger.info(f"[{self.SOURCE_NAME}] Saved {len(entries)} entries to {out_path}")
