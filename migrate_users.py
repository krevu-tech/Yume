"""One-time migration from data/users.json and data/moods.json into SQLite."""
import json
from pathlib import Path

from database import get_db, init_db
from werkzeug.security import generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
USERS_FILE = DATA_DIR / "users.json"
MOODS_FILE = DATA_DIR / "moods.json"


def read_json(path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        return data.get("users", [])
    return data if isinstance(data, list) else []


def main():
    init_db()
    users = read_json(USERS_FILE)
    moods = read_json(MOODS_FILE)
    imported_users = 0
    imported_moods = 0
    skipped_users = 0

    with get_db() as db:
        for item in users:
            username = str(item.get("username", item.get("login", ""))).strip()
            password = item.get("password", "")
            if not username or not isinstance(password, str) or not password:
                skipped_users += 1
                continue
            key = username.casefold()
            found = db.execute("SELECT id FROM users WHERE username_key = ?", (key,)).fetchone()
            if found:
                user_id = found["id"]
                skipped_users += 1
            else:
                cursor = db.execute(
                    "INSERT INTO users (username, username_key, password_hash) VALUES (?, ?, ?)",
                    (username, key, generate_password_hash(password))
                )
                user_id = cursor.lastrowid
                imported_users += 1
            # Keep any old mood history associated with the matching account.
            for mood in moods:
                if str(mood.get("username", "")).casefold() != key:
                    continue
                day, state = mood.get("date", ""), mood.get("mood", "")
                if state not in {"great", "good", "okay", "low", "sad", "awful"}:
                    continue
                try:
                    from datetime import datetime
                    datetime.strptime(day, "%Y-%m-%d")
                except (ValueError, TypeError):
                    continue
                db.execute("""
                    INSERT OR IGNORE INTO moods (user_id, date, mood, note)
                    VALUES (?, ?, ?, ?)
                """, (user_id, day, state, str(mood.get("note", ""))[:500]))
                imported_moods += 1

    print(f"Imported accounts: {imported_users}")
    print(f"Skipped existing/invalid accounts: {skipped_users}")
    print(f"Imported mood records: {imported_moods}")
    print("Check login and mood history before moving the old JSON files out of the project.")


if __name__ == "__main__":
    main()
