import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "entry.schema.json"


class ValidationError(Exception):
    pass


def _load_schema() -> dict:
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def validate_entry(entry: dict) -> list[str]:
    """Validate a single entry dict against the JSON Schema. Returns list of error messages."""
    schema = _load_schema()
    validator = Draft202012Validator(schema)
    return [e.message for e in validator.iter_errors(entry)]


def validate_entries_file(filepath: str) -> dict:
    """Validate all entries in a YAML file. Returns summary dict."""
    with open(filepath) as f:
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


def main():
    """CLI: validate all YAML files in data/entries/."""
    entries_dir = Path(__file__).parent.parent / "data" / "entries"
    total_valid = 0
    total_invalid = 0
    all_errors = []

    for yaml_file in sorted(entries_dir.glob("*.yaml")):
        results = validate_entries_file(str(yaml_file))
        total_valid += results["valid"]
        total_invalid += results["invalid"]
        for err in results["errors"]:
            err["file"] = yaml_file.name
            all_errors.append(err)

    print(f"Valid: {total_valid}, Invalid: {total_invalid}")
    for err in all_errors:
        print(f"  {err['file']} [{err['index']}] {err.get('domain', '?')}: {err['messages']}")

    sys.exit(1 if total_invalid > 0 else 0)


if __name__ == "__main__":
    main()
