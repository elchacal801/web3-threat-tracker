import pytest
from scripts.validate import validate_entry, validate_entries_file, ValidationError


def _valid_entry():
    return {
        "domain": "evil.com",
        "type": "traditional_domain",
        "severity": "MALICIOUS",
        "confidence": "HIGH",
        "tags": ["phishing"],
        "sources": ["metamask"],
        "first_seen": "2026-01-01T00:00:00Z",
        "last_seen": "2026-01-01T00:00:00Z",
        "added_by": "automated",
    }


def test_valid_entry_passes():
    errors = validate_entry(_valid_entry())
    assert errors == []


def test_missing_required_field():
    entry = _valid_entry()
    del entry["severity"]
    errors = validate_entry(entry)
    assert len(errors) > 0
    assert any("severity" in e for e in errors)


def test_invalid_severity_value():
    entry = _valid_entry()
    entry["severity"] = "CRITICAL"
    errors = validate_entry(entry)
    assert len(errors) > 0


def test_invalid_tag_value():
    entry = _valid_entry()
    entry["tags"] = ["not_a_real_tag"]
    errors = validate_entry(entry)
    assert len(errors) > 0


def test_empty_tags_fails():
    entry = _valid_entry()
    entry["tags"] = []
    errors = validate_entry(entry)
    assert len(errors) > 0


def test_extra_field_fails():
    entry = _valid_entry()
    entry["unknown_field"] = "value"
    errors = validate_entry(entry)
    assert len(errors) > 0


def test_valid_entry_with_optional_fields():
    entry = _valid_entry()
    entry["registrar"] = "Namecheap"
    entry["ip_addresses"] = ["1.2.3.4"]
    entry["wallet_addresses"] = ["0xdead"]
    entry["blockchain_network"] = "ethereum"
    errors = validate_entry(entry)
    assert errors == []


def test_validate_entries_file(tmp_path):
    import yaml
    entries = [_valid_entry(), _valid_entry()]
    entries[1]["domain"] = "evil2.com"
    f = tmp_path / "test.yaml"
    f.write_text(yaml.dump(entries))
    results = validate_entries_file(str(f))
    assert results["valid"] == 2
    assert results["invalid"] == 0


def test_validate_entries_file_with_errors(tmp_path):
    import yaml
    entries = [_valid_entry(), {"domain": "bad"}]
    f = tmp_path / "test.yaml"
    f.write_text(yaml.dump(entries))
    results = validate_entries_file(str(f))
    assert results["valid"] == 1
    assert results["invalid"] == 1
    assert len(results["errors"]) == 1
