"""
Database Seeding & Export Utility for Shine Exam Backend.

Usage:
  - Seed database from seed_data.json:
      python seed.py

  - Seed database without dropping existing collection contents (upsert mode):
      python seed.py --no-drop

  - Export current database collections & documents to seed_data.json:
      python seed.py --export

  - Use custom seed JSON file:
      python seed.py --file my_seed.json
"""

import argparse
import json
import os
import sys
from pathlib import Path
from pymongo.errors import BulkWriteError

# Add current backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

# Ensure UTF-8 output encoding for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from bson import json_util
from config.db import get_db

DEFAULT_SEED_FILE = BACKEND_DIR / "seed_data.json"


def dump_db(output_file: Path = DEFAULT_SEED_FILE) -> bool:
    """Export all collections and documents from the MongoDB database into a BSON-JSON file."""
    try:
        db = get_db()
        collections = sorted(db.list_collection_names())
        print(f"[*] Found {len(collections)} collections in database '{db.name}': {collections}")

        dump_data = {}
        total_docs = 0

        for col_name in collections:
            docs = list(db[col_name].find())
            dump_data[col_name] = docs
            doc_count = len(docs)
            total_docs += doc_count
            print(f"  ├─ {col_name}: {doc_count} documents")

        json_str = json_util.dumps(dump_data, indent=2)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(json_str)

        file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
        print(f"[✓] Successfully exported {total_docs} documents across {len(collections)} collections to '{output_file}' ({file_size_mb:.2f} MB)")
        return True
    except Exception as e:
        print(f"[✗] Failed to dump database: {e}", file=sys.stderr)
        return False


def seed_db(seed_file: Path = DEFAULT_SEED_FILE, drop: bool = True) -> bool:
    """Seed the MongoDB database from a BSON-JSON file."""
    if not os.path.exists(seed_file):
        print(f"[✗] Seed file not found at: {seed_file}", file=sys.stderr)
        print("    Run 'python seed.py --export' first to generate seed_data.json from your database.", file=sys.stderr)
        return False

    try:
        print(f"[*] Loading seed data from '{seed_file}'...")
        with open(seed_file, "r", encoding="utf-8") as f:
            seed_data = json_util.loads(f.read())

        if not isinstance(seed_data, dict):
            print(f"[✗] Invalid seed file structure. Expected dictionary of collections.", file=sys.stderr)
            return False

        db = get_db()
        total_collections = len(seed_data)
        total_inserted = 0

        print(f"[*] Found {total_collections} collections in seed file. Seeding database '{db.name}'...")

        for col_name, docs in seed_data.items():
            col = db[col_name]
            if drop:
                col.drop()
                print(f"  ├─ Dropped existing collection '{col_name}'")

            if not docs:
                print(f"  ├─ {col_name}: 0 documents (empty collection)")
                continue

            # Perform bulk insert in batches of 1000 for high efficiency
            batch_size = 1000
            inserted_count = 0
            for i in range(0, len(docs), batch_size):
                batch = docs[i : i + batch_size]
                if drop:
                    result = col.insert_many(batch, ordered=False)
                    inserted_count += len(result.inserted_ids)
                else:
                    # Upsert documents if not dropping
                    for doc in batch:
                        if "_id" in doc:
                            col.replace_one({"_id": doc["_id"]}, doc, upsert=True)
                        else:
                            col.insert_one(doc)
                        inserted_count += 1

            total_inserted += inserted_count
            print(f"  ├─ {col_name}: Inserted/Updated {inserted_count} documents")

        print(f"[✓] Seeding completed successfully! Inserted/Updated {total_inserted} documents across {total_collections} collections.")
        return True

    except Exception as e:
        print(f"[✗] Failed to seed database: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="Shine Exam Backend Database Seed & Export Utility")
    parser.add_argument(
        "--export", "--dump",
        action="store_true",
        help="Export current MongoDB collections and data into seed_data.json"
    )
    parser.add_argument(
        "--no-drop",
        action="store_true",
        help="Do not drop existing collections before seeding (upsert mode)"
    )
    parser.add_argument(
        "--file", "-f",
        type=str,
        default=str(DEFAULT_SEED_FILE),
        help=f"Path to seed data JSON file (default: {DEFAULT_SEED_FILE})"
    )

    args = parser.parse_args()
    seed_file_path = Path(args.file)

    if args.export:
        success = dump_db(output_file=seed_file_path)
    else:
        drop_collections = not args.no_drop
        success = seed_db(seed_file=seed_file_path, drop=drop_collections)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
