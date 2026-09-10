import os, json, flask

app = flask.Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, "w", encoding="utf-8") as f: json.dump([], f)

@app.route("/")
def main():
    return flask.render_template("yume.html")

@app.route("/registration", methods=["GET", "POST"])
def registr():
    if flask.request.method == "POST":
        name = flask.request.form.get("login", "").strip()
        password = flask.request.form.get("password", "")
        if not name or not password:
            return flask.render_template("reg.html", error="Заполните логин и пароль.")
        with open(USERS_FILE, "r", encoding="utf-8") as f: users = json.load(f)
        if any(u.get("username") == name for u in users):
            return flask.render_template("reg.html", error="Такой логин уже существует.")
        users.append({"username": name, "password": password})
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=4)
        return flask.redirect("/registration_ura")
    return flask.render_template("reg.html")

@app.route("/registration_ura")
def registration_ura():
    return flask.render_template("registration_ura.html")

@app.route("/home")
def home():
    return flask.render_template("home.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5252)
