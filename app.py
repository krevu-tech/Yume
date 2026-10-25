import os
import secrets
import re
from functools import wraps
from pathlib import Path
from datetime import datetime

import flask
from flask_wtf.csrf import CSRFProtect
from werkzeug.security import generate_password_hash, check_password_hash

from database import get_db, init_db

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

app = flask.Flask(__name__)
secret_key = os.environ.get("YUME_SECRET_KEY")
if not secret_key:
    key_file = DATA_DIR / ".secret_key"
    if key_file.exists():
        secret_key = key_file.read_text(encoding="utf-8").strip()
    else:
        secret_key = secrets.token_hex(32)
        key_file.write_text(secret_key, encoding="utf-8")
        try:
            key_file.chmod(0o600)
        except OSError:
            pass
app.config.update(
    SECRET_KEY=secret_key,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("YUME_HTTPS", "0") == "1",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 14,
    MAX_CONTENT_LENGTH=1024 * 1024,
)
CSRFProtect(app)
init_db()

ALLOWED_MOODS = {"great", "good", "okay", "low", "sad", "awful"}
USERNAME_RE = re.compile(r"^[A-Za-zА-Яа-яЁё0-9_.-]{3,32}$")


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not flask.session.get("user_id"):
            if flask.request.path.startswith("/api/"):
                return flask.jsonify({"error": "Требуется вход."}), 401
            return flask.redirect(flask.url_for("login"))
        return view(*args, **kwargs)
    return wrapped


@app.after_request
def security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


@app.route("/")
def main():
    if flask.session.get("user_id"):
        return flask.redirect(flask.url_for("home"))
    return flask.render_template("yume.html")


@app.route("/registration", methods=["GET", "POST"])
def registr():
    if flask.request.method == "POST":
        name = flask.request.form.get("login", "").strip()
        password = flask.request.form.get("password", "")
        if not USERNAME_RE.fullmatch(name):
            return flask.render_template("reg.html", error="Логин: 3–32 символа, буквы, цифры, . _ -.")
        if len(password) < 8 or len(password) > 128:
            return flask.render_template("reg.html", error="Пароль должен содержать от 8 до 128 символов.")
        key = name.casefold()
        with get_db() as db:
            exists = db.execute("SELECT id FROM users WHERE username_key = ?", (key,)).fetchone()
            if exists:
                return flask.render_template("reg.html", error="Этот логин уже занят.")
            db.execute(
                "INSERT INTO users (username, username_key, password_hash) VALUES (?, ?, ?)",
                (name, key, generate_password_hash(password))
            )
            user = db.execute("SELECT id, username FROM users WHERE username_key = ?", (key,)).fetchone()
        flask.session.clear()
        flask.session["user_id"] = user["id"]
        flask.session["username"] = user["username"]
        flask.session.permanent = True
        return flask.redirect(flask.url_for("registration_ura"))
    return flask.render_template("reg.html", error=None)


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if flask.request.method == "POST":
        name = flask.request.form.get("login", "").strip()
        password = flask.request.form.get("password", "")
        with get_db() as db:
            user = db.execute(
                "SELECT id, username, password_hash FROM users WHERE username_key = ?",
                (name.casefold(),)
            ).fetchone()
        if user and check_password_hash(user["password_hash"], password):
            flask.session.clear()
            flask.session["user_id"] = user["id"]
            flask.session["username"] = user["username"]
            flask.session.permanent = True
            return flask.redirect(flask.url_for("home"))
        error = "Неверный логин или пароль."
    return flask.render_template("login.html", error=error)


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    flask.session.clear()
    return flask.redirect(flask.url_for("main"))


@app.route("/registration_ura")
@login_required
def registration_ura():
    return flask.render_template("registration_ura.html")


@app.route("/home")
@login_required
def home():
    return flask.render_template("home.html", username=flask.session.get("username"))


@app.route("/updates")
@app.route("/devlog")
def updates():
    return flask.render_template("updates.html")


@app.route("/api/moods", methods=["GET", "POST"])
@login_required
def moods_api():
    user_id = flask.session["user_id"]
    if flask.request.method == "GET":
        with get_db() as db:
            rows = db.execute(
                "SELECT date, mood, note FROM moods WHERE user_id = ? ORDER BY date",
                (user_id,)
            ).fetchall()
        return flask.jsonify([dict(row) for row in rows])

    payload = flask.request.get_json(silent=True) or {}
    day, mood = payload.get("date", ""), payload.get("mood", "")
    note = str(payload.get("note", ""))[:500]
    try:
        datetime.strptime(day, "%Y-%m-%d")
    except (ValueError, TypeError):
        return flask.jsonify({"error": "Некорректная дата."}), 400
    if mood not in ALLOWED_MOODS:
        return flask.jsonify({"error": "Выберите настроение."}), 400
    with get_db() as db:
        db.execute("""
            INSERT INTO moods (user_id, date, mood, note, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, date) DO UPDATE SET
                mood = excluded.mood,
                note = excluded.note,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, day, mood, note))
    record = {"date": day, "mood": mood, "note": note}
    return flask.jsonify({"ok": True, "record": record})


if __name__ == "__main__":
    app.run(host="127.0.0.1", debug=False, port=int(os.environ.get("PORT", "5252")))
