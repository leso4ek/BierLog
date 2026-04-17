import sqlite3
import uuid
import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from jose import jwt, JWTError


DB_PATH = os.getenv("DB_PATH", "/data/bierlog.db")
JWT_SECRET = os.getenv("JWT_SECRET", "bierlog-secret-dev-2024")
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 24
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "public")

app = FastAPI(title="BierLog API", version="3.0.0", docs_url="/api/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


def hash_password(plain_password):
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password, hashed_password):
    result = bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    return result


def create_token(user_data):
    expire_time = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {}
    payload["id"] = user_data["id"]
    payload["username"] = user_data["username"]
    payload["name"] = user_data["name"]
    payload["exp"] = expire_time
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
    return token


def decode_token(token):
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return data
    except JWTError:
        raise HTTPException(status_code=401, detail="Ungültiger oder abgelaufener Token.")


bearer = HTTPBearer()


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    user_data = decode_token(creds.credentials)
    return user_data


def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


DEFAULT_STYLES = [
    "Pils",
    "Helles",
    "Weizen",
    "Dunkel",
    "IPA",
    "Stout",
    "Lager",
    "Bock",
    "Maerzen",
    "Kellerbier",
    "Porter",
    "Sonstiges"
]


def init_db():
    print("Datenbank wird erstellt...")
    connection = get_db_connection()
    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                password TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS beer_styles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS beers (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                origin TEXT NOT NULL,
                style TEXT NOT NULL,
                date TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                counter INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        connection.commit()
        for style_name in DEFAULT_STYLES:
            connection.execute(
                "INSERT OR IGNORE INTO beer_styles (name) VALUES (?)",
                (style_name,)
            )
        connection.commit()
        print("Datenbank fertig!")
    except Exception as error:
        print("Fehler bei der Datenbank:", error)
        connection.rollback()
    finally:
        connection.close()


init_db()


class SigninRequest(BaseModel):
    username: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


class BeerCreate(BaseModel):
    name: str
    rating: int
    origin: str
    style: str
    date: Optional[str] = None
    notes: str = ""


class BeerUpdate(BaseModel):
    name: Optional[str] = None
    rating: Optional[int] = None
    origin: Optional[str] = None
    style: Optional[str] = None
    date: Optional[str] = None
    notes: Optional[str] = None


class StyleCreate(BaseModel):
    name: str


@app.post("/api/auth/signin", status_code=201)
def signin(body: SigninRequest):
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Benutzername und Passwort erforderlich.")
    if not body.password.strip():
        raise HTTPException(status_code=400, detail="Benutzername und Passwort erforderlich.")
    if len(body.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Benutzername muss mindestens 3 Zeichen haben.")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 6 Zeichen haben.")
    connection = get_db_connection()
    try:
        existing_user = connection.execute(
            "SELECT id FROM users WHERE LOWER(username) = LOWER(?)",
            (body.username.strip(),)
        ).fetchone()
        if existing_user:
            raise HTTPException(status_code=409, detail="Benutzername bereits vergeben.")
        user_id = str(uuid.uuid4())
        if body.name and body.name.strip():
            display_name = body.name.strip()
        else:
            display_name = body.username.strip()
        hashed_pw = hash_password(body.password)
        connection.execute(
            "INSERT INTO users (id, username, name, password) VALUES (?, ?, ?, ?)",
            (user_id, body.username.strip(), display_name, hashed_pw)
        )
        connection.commit()
    except HTTPException:
        raise
    except Exception as error:
        print("Fehler beim Registrieren:", error)
        connection.rollback()
        raise HTTPException(status_code=500, detail="Interner Serverfehler.")
    finally:
        connection.close()
    user_info = {
        "id": user_id,
        "username": body.username.strip(),
        "name": display_name
    }
    token = create_token(user_info)
    print("Neuer Benutzer registriert:", body.username.strip())
    return {"token": token, "user": user_info}


@app.post("/api/auth/login")
def login(body: LoginRequest):
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Benutzername und Passwort erforderlich.")
    if not body.password.strip():
        raise HTTPException(status_code=400, detail="Benutzername und Passwort erforderlich.")
    connection = get_db_connection()
    try:
        user = connection.execute(
            "SELECT * FROM users WHERE LOWER(username) = LOWER(?)",
            (body.username.strip(),)
        ).fetchone()
    finally:
        connection.close()
    if not user:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten.")
    password_correct = verify_password(body.password, user["password"])
    if not password_correct:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten.")
    user_info = {
        "id": user["id"],
        "username": user["username"],
        "name": user["name"]
    }
    token = create_token(user_info)
    print("Benutzer eingeloggt:", user["username"])
    return {"token": token, "user": user_info}


@app.get("/api/auth/me")
def get_me(cu = Depends(get_current_user)):
    connection = get_db_connection()
    try:
        user = connection.execute(
            "SELECT id, username, name, created_at FROM users WHERE id = ?",
            (cu["id"],)
        ).fetchone()
    finally:
        connection.close()
    if not user:
        raise HTTPException(status_code=404, detail="User nicht gefunden.")
    return {"user": dict(user)}


@app.get("/api/beers")
def get_beers(cu = Depends(get_current_user)):
    connection = get_db_connection()
    try:
        all_beers = connection.execute(
            "SELECT * FROM beers WHERE user_id = ? ORDER BY date DESC",
            (cu["id"],)
        ).fetchall()
    finally:
        connection.close()
    result = []
    for beer in all_beers:
        result.append(dict(beer))
    return result


@app.get("/api/beers/{beer_id}")
def get_beer(beer_id: str, cu = Depends(get_current_user)):
    connection = get_db_connection()
    try:
        beer = connection.execute(
            "SELECT * FROM beers WHERE id = ? AND user_id = ?",
            (beer_id, cu["id"])
        ).fetchone()
    finally:
        connection.close()
    if not beer:
        raise HTTPException(status_code=404, detail="Bier nicht gefunden.")
    return dict(beer)


@app.post("/api/beers")
def create_beer(body: BeerCreate, cu = Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name, Herkunft und Stil sind Pflichtfelder.")
    if not body.origin.strip():
        raise HTTPException(status_code=400, detail="Name, Herkunft und Stil sind Pflichtfelder.")
    if not body.style.strip():
        raise HTTPException(status_code=400, detail="Name, Herkunft und Stil sind Pflichtfelder.")
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating muss zwischen 1 und 5 liegen.")
    connection = get_db_connection()
    try:
        existing_beer = connection.execute(
            "SELECT * FROM beers WHERE LOWER(name) = LOWER(?) AND user_id = ?",
            (body.name.strip(), cu["id"])
        ).fetchone()
        if existing_beer:
            connection.execute(
                "UPDATE beers SET counter = counter + 1 WHERE id = ? AND user_id = ?",
                (existing_beer["id"], cu["id"])
            )
            connection.commit()
            updated_beer = connection.execute(
                "SELECT * FROM beers WHERE id = ?",
                (existing_beer["id"],)
            ).fetchone()
            result = dict(updated_beer)
            result["_incremented"] = True
            return result
        beer_id = str(uuid.uuid4())
        if body.date:
            beer_date = body.date
        else:
            beer_date = datetime.now(timezone.utc).isoformat()
        connection.execute(
            "INSERT INTO beers (id, user_id, name, rating, origin, style, date, notes, counter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
            (beer_id, cu["id"], body.name.strip(), body.rating, body.origin.strip(), body.style.strip(), beer_date, body.notes or "")
        )
        connection.commit()
        new_beer = connection.execute(
            "SELECT * FROM beers WHERE id = ?",
            (beer_id,)
        ).fetchone()
        print("Neues Bier hinzugefuegt:", body.name.strip())
        return dict(new_beer)
    except HTTPException:
        raise
    except Exception as error:
        print("Fehler beim Erstellen:", error)
        connection.rollback()
        raise HTTPException(status_code=500, detail="Interner Serverfehler.")
    finally:
        connection.close()


@app.put("/api/beers/{beer_id}")
def update_beer(beer_id: str, body: BeerUpdate, cu = Depends(get_current_user)):
    connection = get_db_connection()
    try:
        beer = connection.execute(
            "SELECT * FROM beers WHERE id = ? AND user_id = ?",
            (beer_id, cu["id"])
        ).fetchone()
        if not beer:
            raise HTTPException(status_code=404, detail="Bier nicht gefunden.")
        old_beer = dict(beer)
        if body.rating is not None:
            if body.rating < 1 or body.rating > 5:
                raise HTTPException(status_code=400, detail="Rating muss zwischen 1 und 5 liegen.")
        if body.name is not None:
            new_name = body.name.strip()
        else:
            new_name = old_beer["name"]
        if body.rating is not None:
            new_rating = body.rating
        else:
            new_rating = old_beer["rating"]
        if body.origin is not None:
            new_origin = body.origin.strip()
        else:
            new_origin = old_beer["origin"]
        if body.style is not None:
            new_style = body.style.strip()
        else:
            new_style = old_beer["style"]
        if body.date is not None:
            new_date = body.date
        else:
            new_date = old_beer["date"]
        if body.notes is not None:
            new_notes = body.notes.strip()
        else:
            new_notes = old_beer["notes"]
        connection.execute(
            "UPDATE beers SET name = ?, rating = ?, origin = ?, style = ?, date = ?, notes = ? WHERE id = ? AND user_id = ?",
            (new_name, new_rating, new_origin, new_style, new_date, new_notes, beer_id, cu["id"])
        )
        connection.commit()
        updated_beer = connection.execute(
            "SELECT * FROM beers WHERE id = ?",
            (beer_id,)
        ).fetchone()
        return dict(updated_beer)
    except HTTPException:
        raise
    except Exception as error:
        print("Fehler beim Aktualisieren:", error)
        connection.rollback()
        raise HTTPException(status_code=500, detail="Interner Serverfehler.")
    finally:
        connection.close()


@app.delete("/api/beers/{beer_id}", status_code=204)
def delete_beer(beer_id: str, cu = Depends(get_current_user)):
    connection = get_db_connection()
    try:
        beer = connection.execute(
            "SELECT id FROM beers WHERE id = ? AND user_id = ?",
            (beer_id, cu["id"])
        ).fetchone()
        if not beer:
            raise HTTPException(status_code=404, detail="Bier nicht gefunden.")
        connection.execute(
            "DELETE FROM beers WHERE id = ? AND user_id = ?",
            (beer_id, cu["id"])
        )
        connection.commit()
        print("Bier geloescht:", beer_id)
    except HTTPException:
        raise
    except Exception as error:
        print("Fehler beim Loeschen:", error)
        connection.rollback()
        raise HTTPException(status_code=500, detail="Interner Serverfehler.")
    finally:
        connection.close()


@app.get("/api/stats/summary")
def get_stats(cu = Depends(get_current_user)):
    connection = get_db_connection()
    try:
        row = connection.execute(
            "SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM beers WHERE user_id = ?",
            (cu["id"],)
        ).fetchone()
        top_style = connection.execute(
            "SELECT style, COUNT(*) as cnt FROM beers WHERE user_id = ? GROUP BY style ORDER BY cnt DESC LIMIT 1",
            (cu["id"],)
        ).fetchone()
        latest_beer = connection.execute(
            "SELECT * FROM beers WHERE user_id = ? ORDER BY date DESC LIMIT 1",
            (cu["id"],)
        ).fetchone()
    finally:
        connection.close()
    if row["avg_rating"]:
        average = round(row["avg_rating"] * 10) / 10
    else:
        average = 0
    result = {}
    result["total"] = row["total"] or 0
    result["avgRating"] = average
    if top_style:
        result["topStyle"] = top_style["style"]
    else:
        result["topStyle"] = None
    if latest_beer:
        result["latestBeer"] = dict(latest_beer)
    else:
        result["latestBeer"] = None
    return result


@app.get("/api/styles")
def get_styles(cu = Depends(get_current_user)):
    connection = get_db_connection()
    try:
        all_styles = connection.execute(
            "SELECT name FROM beer_styles ORDER BY name ASC"
        ).fetchall()
    finally:
        connection.close()
    style_names = []
    for style in all_styles:
        style_names.append(style["name"])
    return style_names


@app.post("/api/styles", status_code=201)
def create_style(body: StyleCreate, cu = Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Stilname erforderlich.")
    connection = get_db_connection()
    try:
        existing_style = connection.execute(
            "SELECT name FROM beer_styles WHERE LOWER(name) = LOWER(?)",
            (body.name.strip(),)
        ).fetchone()
        if existing_style:
            raise HTTPException(status_code=409, detail="Dieser Stil existiert bereits.")
        connection.execute(
            "INSERT INTO beer_styles (name) VALUES (?)",
            (body.name.strip(),)
        )
        connection.commit()
        all_styles = connection.execute(
            "SELECT name FROM beer_styles ORDER BY name ASC"
        ).fetchall()
        style_names = []
        for style in all_styles:
            style_names.append(style["name"])
    except HTTPException:
        raise
    except Exception as error:
        print("Fehler beim Stil erstellen:", error)
        connection.rollback()
        raise HTTPException(status_code=500, detail="Interner Serverfehler.")
    finally:
        connection.close()
    return {"name": body.name.strip(), "allStyles": style_names}


if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


def serve_page(filename):
    page_path = os.path.join(FRONTEND_DIR, "html", "Pages", filename)
    return FileResponse(page_path)


@app.get("/")
def root():
    return serve_page("Welcome Page.html")


@app.get("/Welcome%20Page.html")
def welcome():
    return serve_page("Welcome Page.html")


@app.get("/Welcome Page.html")
def welcome2():
    return serve_page("Welcome Page.html")


@app.get("/anmelden")
def anmelden():
    return serve_page("Anmelden.html")


@app.get("/Anmelden.html")
def anmelden2():
    return serve_page("Anmelden.html")


@app.get("/addbier")
def addbier():
    return serve_page("AddBier.html")


@app.get("/AddBier.html")
def addbier2():
    return serve_page("AddBier.html")


@app.get("/css/styles.css")
def css():
    css_path = os.path.join(FRONTEND_DIR, "css", "styles.css")
    return FileResponse(css_path)


@app.get("/js/api.js")
def js():
    js_path = os.path.join(FRONTEND_DIR, "js", "api.js")
    return FileResponse(js_path)


if __name__ == "__main__":
    import uvicorn
    print("")
    print("BierLog laeuft auf http://localhost:8000")
    print("Frontend:  http://localhost:8000")
    print("API Docs:  http://localhost:8000/api/docs")
    print("Datenbank: " + DB_PATH)
    print("")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
