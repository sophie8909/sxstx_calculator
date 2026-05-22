import csv
import re
from pathlib import Path

INPUT_FILE = "servers.txt"
OUTPUT_FILE = "servers.csv"


def calculate_merge_ranges(server_short: str):
    """
    Calculate merge groups for a server.
    """

    batch = int(server_short[:2])
    num = int(server_short[2:])

    # Merge 2
    merge2_start = num if num % 2 == 1 else num - 1
    merge2_end = merge2_start + 1

    # Merge 4
    merge4_start = ((num - 1) // 4) * 4 + 1
    merge4_end = merge4_start + 3

    # Merge 8
    merge8_start = ((num - 1) // 8) * 8 + 1
    merge8_end = merge8_start + 7

    # Merge 16
    merge16_start = 1
    merge16_end = 16

    return {
        "merge_2": f"{batch:02d}{merge2_start:02d}-{batch:02d}{merge2_end:02d}",
        "merge_4": f"{batch:02d}{merge4_start:02d}-{batch:02d}{merge4_end:02d}",
        "merge_8": f"{batch:02d}{merge8_start:02d}-{batch:02d}{merge8_end:02d}",
        "merge_16": f"{batch:02d}{merge16_start:02d}-{batch:02d}{merge16_end:02d}",
    }


def parse_servers(text: str):
    """
    Parse server data from exported Discord text.
    """

    pattern = re.compile(r"(600\d{4})\s+(.+)")
    servers = []

    for line in text.splitlines():
        match = pattern.match(line.strip())

        if not match:
            continue

        server_id = match.group(1)
        server_name = match.group(2).strip()

        server_short = server_id[-4:]

        realm_id = int(server_short[:2])

        merges = calculate_merge_ranges(server_short)

        servers.append({
            "server_id": server_id,
            "server_short": server_short,
            "server_name": server_name,
            "realm_id": realm_id,
            **merges
        })

    return servers


def write_csv(servers):
    """
    Export server data to CSV.
    """

    fieldnames = [
        "server_id",
        "server_short",
        "server_name",
        "realm_id",
        "merge_2",
        "merge_4",
        "merge_8",
        "merge_16",
    ]

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)

        writer.writeheader()

        for server in servers:
            writer.writerow(server)


def main():
    """
    Main entry point.
    """

    input_path = Path(INPUT_FILE)

    if not input_path.exists():
        raise FileNotFoundError(f"Cannot find {INPUT_FILE}")

    text = input_path.read_text(encoding="utf-8")

    servers = parse_servers(text)

    servers.sort(key=lambda x: x["server_id"])

    write_csv(servers)

    print(f"Parsed {len(servers)} servers")
    print(f"Output written to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()