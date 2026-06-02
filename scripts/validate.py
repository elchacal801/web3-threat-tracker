import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "entry.schema.json"


class ValidationError(Exception):
    pass


def _load_schema() -> dict:
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


# Compile the schema once at import. Rebuilding it per entry made validating
# the full dataset (450K+ entries) take minutes.
_VALIDATOR = Draft202012Validator(_load_schema())


def validate_entry(entry: dict) -> list[str]:
    """Validate a single entry dict against the JSON Schema. Returns list of error messages."""
    return [e.message for e in _VALIDATOR.iter_errors(entry)]


def validate_entries_file(filepath: str) -> dict:
    """Validate all entries in a YAML file. Returns summary dict."""
    with open(filepath, encoding="utf-8") as f:
        entries = yaml.safe_load(f)

    if not isinstance(entries, list):
        return {"valid": 0, "invalid": 1, "errors": [{"index": 0, "messages": ["File must contain a YAML list"]}]}

    valid = 0
    invalid = 0
    errors = []
    for i, entry in enumerate(entries):
        errs = validate_entry(entry)
        if errs:
            invalid += 1
            errors.append({"index": i, "domain": entry.get("domain", "unknown"), "messages": errs})
        else:
            valid += 1

    return {"valid": valid, "invalid": invalid, "errors": errors}


def run(entries_dir: str) -> int:
    """Validate all YAML files in entries_dir. Print a summary and return an
    exit code: 1 if any entry is invalid, else 0. Used to gate the pipeline so
    malformed entries never reach the CSV/DB exports."""
    total_valid = 0
    total_invalid = 0
    all_errors = []

    for yaml_file in sorted(Path(entries_dir).glob("*.yaml")):
        results = validate_entries_file(str(yaml_file))
        total_valid += results["valid"]
        total_invalid += results["invalid"]
        for err in results["errors"]:
            err["file"] = yaml_file.name
            all_errors.append(err)

    print(f"Valid: {total_valid}, Invalid: {total_invalid}")
    if all_errors:
        print(f"  (showing first 10 of {len(all_errors)} errors)")
        for err in all_errors[:10]:
            print(f"  {err['file']} [{err['index']}] {err.get('domain', '?')}: {err['messages']}")

    return 1 if total_invalid else 0


def main():
    """CLI: validate all YAML files in data/entries/."""
    entries_dir = Path(__file__).parent.parent / "data" / "entries"
    sys.exit(run(str(entries_dir)))


if __name__ == "__main__":
    main()
