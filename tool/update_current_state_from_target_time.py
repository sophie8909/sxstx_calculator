"""Rebuild data/servers.csv current_state from target_time merged server rows.

Run from the repository root:

    py tool/update_current_state_from_target_time.py

Rules:
- Clear every current_state first.
- If a target_time server cell contains multiple known server names, treat it as
  evidence that the matching merge range has merged.
- This is a rolling-server game: once a later server range is detected as
  merge_2/merge_4/merge_8/merge_16, earlier server ranges are at least that
  merged too.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SERVERS_CSV = REPO_ROOT / "data" / "servers.csv"
DEFAULT_TARGET_TIME_CSV = REPO_ROOT / "tool" / "target_time.csv"

CURRENT_STATE_FIELD = "current_state"
SERVER_FIELD_CANDIDATES = ("server_name", "\u4f3a\u670d\u5668", "server")
GROUP_SPLIT_RE = re.compile(r"\s*(?:\u3001|,|\uff0c|/|\uff0f|&|\uff0b|\+|\band\b)\s*", re.I)

STATE_RANK = {
    "": 0,
    "merge_2": 2,
    "merge_4": 4,
    "merge_8": 8,
    "merge_16": 16,
}
RANK_STATE = {rank: state for state, rank in STATE_RANK.items()}
MERGE_FIELDS = ("merge_2", "merge_4", "merge_8", "merge_16")


def normalize_header(value: str) -> str:
    """Normalize CSV headers."""

    return str(value or "").replace("\ufeff", "").strip()


def normalize_text(value: str) -> str:
    """Normalize cell text."""

    text = str(value or "").replace("\u3000", " ")
    return re.sub(r"\s+", " ", text).strip()


def split_server_names(value: str) -> list[str]:
    """Split one target_time server cell into server names."""

    text = normalize_text(value)
    text = text.replace("\uff0d", "-").replace("\u2014", "-").replace("\u2013", "-")
    return [normalize_text(part) for part in GROUP_SPLIT_RE.split(text) if normalize_text(part)]


def parse_short_range(value: str) -> tuple[int, int] | None:
    """Parse a merge range like 0101-0104."""

    match = re.fullmatch(r"\s*(\d{4})\s*-\s*(\d{4})\s*", str(value or ""))
    if not match:
        return None
    start = int(match.group(1))
    end = int(match.group(2))
    return min(start, end), max(start, end)


def read_csv_rows(path: Path, add_current_state: bool = False) -> tuple[list[str], list[dict[str, str]]]:
    """Read CSV rows and normalize headers."""

    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            raise ValueError(f"{path} has no CSV header")

        original_fields = list(reader.fieldnames)
        fieldnames = [normalize_header(name) for name in original_fields]
        rows: list[dict[str, str]] = []
        for raw_row in reader:
            row = {}
            for old_name, new_name in zip(original_fields, fieldnames):
                row[new_name] = raw_row.get(old_name, "") or ""
            rows.append(row)

    if add_current_state and CURRENT_STATE_FIELD not in fieldnames:
        fieldnames.append(CURRENT_STATE_FIELD)
    if add_current_state:
        for row in rows:
            row.setdefault(CURRENT_STATE_FIELD, "")

    return fieldnames, rows


def write_csv_rows(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    """Write CSV rows with UTF-8 BOM."""

    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def row_short(row: dict[str, str]) -> int:
    """Return numeric server_short."""

    short = normalize_text(row.get("server_short", ""))
    if short.isdigit():
        return int(short)

    server_id = normalize_text(row.get("server_id", ""))
    return int(server_id[-4:]) if server_id[-4:].isdigit() else 0


def row_id(row: dict[str, str]) -> str:
    """Return stable row id for maps."""

    return normalize_text(row.get("server_id", "")) or normalize_text(row.get("server_short", ""))


def build_server_indexes(server_rows: list[dict[str, str]]) -> tuple[dict[str, dict[str, str]], dict[int, dict[str, str]]]:
    """Build lookup maps for server name and server_short."""

    by_name = {}
    by_short = {}
    for row in server_rows:
        name = normalize_text(row.get("server_name", ""))
        short = row_short(row)
        if name:
            by_name[name] = row
        if short:
            by_short[short] = row
    return by_name, by_short


def find_server_value(row: dict[str, str]) -> str:
    """Find the target_time server field."""

    for field in SERVER_FIELD_CANDIDATES:
        value = row.get(field, "")
        if value:
            return value
    return ""


def determine_group_state(member_rows: list[dict[str, str]]) -> tuple[str, str] | None:
    """Determine the smallest merge field that contains all member rows."""

    if len(member_rows) < 2:
        return None

    member_shorts = [row_short(row) for row in member_rows]
    for field in MERGE_FIELDS:
        ranges = {normalize_text(row.get(field, "")) for row in member_rows}
        if len(ranges) != 1:
            continue

        parsed = parse_short_range(next(iter(ranges)))
        if not parsed:
            continue
        start, end = parsed
        if all(start <= short <= end for short in member_shorts):
            return field, f"{start:04d}-{end:04d}"

    return None


def apply_state_to_range(
    server_rows: list[dict[str, str]],
    state_by_id: dict[str, str],
    state: str,
    range_text: str,
) -> None:
    """Mark every row in a merge range with the given state."""

    parsed = parse_short_range(range_text)
    if not parsed:
        return
    start, end = parsed
    rank = STATE_RANK[state]

    for row in server_rows:
        short = row_short(row)
        if not (start <= short <= end):
            continue
        key = row_id(row)
        if STATE_RANK[state_by_id.get(key, "")] < rank:
            state_by_id[key] = state


def detect_states_from_target_time(
    server_rows: list[dict[str, str]],
    target_rows: list[dict[str, str]],
) -> dict[str, str]:
    """Detect current_state from target_time merged server cells."""

    by_name, _ = build_server_indexes(server_rows)
    state_by_id = {row_id(row): "" for row in server_rows if row_id(row)}

    for target_row in target_rows:
        names = split_server_names(find_server_value(target_row))
        member_rows = [by_name[name] for name in names if name in by_name]
        detected = determine_group_state(member_rows)
        if not detected:
            continue
        state, range_text = detected
        apply_state_to_range(server_rows, state_by_id, state, range_text)

    return state_by_id


def propagate_rolling_states_backward(
    server_rows: list[dict[str, str]],
    state_by_id: dict[str, str],
) -> dict[str, str]:
    """Apply rolling-server rule: later realms imply earlier realms globally."""

    best_rank = 0

    sorted_rows = sorted(server_rows, key=row_short, reverse=True)
    for row in sorted_rows:
        key = row_id(row)
        current_rank = STATE_RANK[state_by_id.get(key, "")]

        if best_rank > current_rank:
            state_by_id[key] = RANK_STATE[best_rank]
            current_rank = best_rank

        if current_rank > best_rank:
            best_rank = current_rank

    return state_by_id


def rebuild_current_state(
    servers_csv: Path,
    target_csv_path: Path,
    dry_run: bool,
) -> tuple[int, dict[str, str]]:
    """Clear and rebuild current_state values."""

    fieldnames, server_rows = read_csv_rows(servers_csv, add_current_state=True)
    _, target_rows = read_csv_rows(target_csv_path)

    for row in server_rows:
        row[CURRENT_STATE_FIELD] = ""

    state_by_id = detect_states_from_target_time(server_rows, target_rows)
    state_by_id = propagate_rolling_states_backward(server_rows, state_by_id)

    updates: dict[str, str] = {}
    updated_count = 0
    for row in server_rows:
        key = row_id(row)
        state = state_by_id.get(key, "")
        row[CURRENT_STATE_FIELD] = state
        if state:
            updated_count += 1
        updates[normalize_text(row.get("server_name", "")) or key] = state

    if not dry_run:
        write_csv_rows(servers_csv, fieldnames, server_rows)

    return updated_count, updates


def parse_args(argv: list[str]) -> argparse.Namespace:
    """Parse CLI arguments."""

    parser = argparse.ArgumentParser()
    parser.add_argument("--servers-csv", type=Path, default=DEFAULT_SERVERS_CSV)
    parser.add_argument("--target-csv-path", type=Path, default=DEFAULT_TARGET_TIME_CSV)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""

    args = parse_args(argv or sys.argv[1:])
    updated_count, updates = rebuild_current_state(
        servers_csv=args.servers_csv,
        target_csv_path=args.target_csv_path,
        dry_run=args.dry_run,
    )

    print(f"Rows with current_state: {updated_count}")
    if args.dry_run:
        for server_name, state in sorted(updates.items()):
            if state:
                print(f"{server_name} -> {state}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
