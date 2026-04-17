# BierLog – Technische Architektur & API-Dokumentation

---

## Überblick

BierLog ist eine Web-Applikation mit der man Biere erfassen, bewerten und verwalten kann.
Technisch gesehen handelt es sich um eine **Full-Stack-Webanwendung** bestehend aus:

- einem **Python-Backend** (FastAPI + SQLite)
- einem **Vanilla-JavaScript-Frontend** (SPA ohne Framework)
- einem **Docker-Container** für das Deployment
- einem **Cloud-Hosting** über Render

---

## Eingesetzte Technologien

### Backend

| Technologie | Version | Wozu |
|---|---|---|
| **Python** | 3.12 | Programmiersprache des Backends |
| **FastAPI** | aktuell | Web-Framework: definiert die API-Routen |
| **Uvicorn** | aktuell | ASGI-Server: führt FastAPI aus |
| **SQLite** | eingebaut | Datenbank: speichert alle Daten in einer Datei |
| **bcrypt** | aktuell | Passwort-Hashing: Passwörter sicher speichern |
| **python-jose** | aktuell | JWT-Tokens: Authentifizierung ohne Session |
| **Pydantic** | v2 | Validierung: prüft ob die Eingabedaten korrekt sind |

**FastAPI** wurde gewählt weil es sehr schnell zu entwickeln ist, automatisch eine interaktive
API-Dokumentation unter `/api/docs` generiert und moderne Python-Features wie Type Hints nutzt.

**SQLite** wurde gewählt weil es keine separate Datenbankinstanz braucht.
Die gesamte Datenbank ist eine einzige Datei (`bierlog.db`). Ideal für kleine bis mittlere Apps.

### Frontend

| Technologie | Wozu |
|---|---|
| **Vanilla JavaScript** | Programmiersprache des Frontends – kein Framework |
| **HTML5** | Struktur der Seiten |
| **CSS3** | Design: Flexbox, Grid, CSS-Variablen, Animationen |
| **Fetch API** | HTTP-Anfragen vom Browser an den Server schicken |
| **localStorage** | Token und Benutzerdaten im Browser speichern |

Es wurde bewusst **kein Framework** (React, Angular, Vue) eingesetzt.
Stattdessen ist das Frontend nach dem Komponentenprinzip strukturiert:
jede View hat eine eigene JS-Datei mit einem Objekt das Zustand und Methoden kapselt.

### Deployment & Infrastruktur

| Technologie | Wozu |
|---|---|
| **Docker** | App in einen Container verpacken |
| **docker-compose** | Container lokal starten und konfigurieren |
| **Render** | Cloud-Plattform für das öffentliche Deployment |

---

## Gesamtarchitektur

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│                                                     │
│  Welcome Page.html  ←──── statische Seite          │
│                                                     │
│  Anmelden.html (SPA)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  AuthView   │  │ DashboardV. │  │AddBierView │  │
│  └─────────────┘  └─────────────┘  └────────────┘  │
│         └──────────────┬───────────────┘            │
│                   Router.go()                       │
│                        │                            │
│                    api.js  (fetch)                  │
└────────────────────────┼────────────────────────────┘
                         │ HTTP  (JSON)
                         ↓
┌─────────────────────────────────────────────────────┐
│                FastAPI  (main.py)                   │
│                                                     │
│  /api/auth/signin    POST  ← Registrierung          │
│  /api/auth/login     POST  ← Login                  │
│  /api/auth/me        GET   ← aktueller User         │
│  /api/beers          GET   ← alle Biere             │
│  /api/beers          POST  ← Bier erstellen         │
│  /api/beers/{id}     GET   ← ein Bier               │
│  /api/beers/{id}     PUT   ← Bier bearbeiten        │
│  /api/beers/{id}     DELETE← Bier löschen          │
│  /api/stats/summary  GET   ← Statistiken           │
│  /api/styles         GET   ← Bierstile             │
│  /api/styles         POST  ← neuer Bierstil        │
│                        │                            │
│              JWT-Token-Prüfung                      │
└────────────────────────┼────────────────────────────┘
                         │
                         ↓
              SQLite  (bierlog.db)
              ┌──────────────────┐
              │ users            │
              │ beers            │
              │ beer_styles      │
              └──────────────────┘
```

---

## Frontend-Struktur im Detail

```
public/
├── css/
│   └── styles.css              ← gesamtes Design (ca. 780 Zeilen)
├── js/
│   ├── api.js                  ← Service-Layer
│   │                              Auth.login(), Auth.signin()
│   │                              Beers.getAll(), Beers.create(), ...
│   │                              Styles.getAll(), Styles.add()
│   ├── router.js               ← SPA-Router
│   │                              Router.go('dashboard')
│   │                              popstate-Handler
│   │                              DOMContentLoaded-Handler
│   └── components/
│       ├── auth.js             ← AuthView
│       │                          .switchTab()
│       │                          .togglePass()
│       │                          .handleSubmit()
│       ├── dashboard.js        ← DashboardView
│       │                          .init(), .load()
│       │                          .renderStats(), .renderBeerList()
│       │                          .openEdit(), .closeModal()
│       │                          .handleDelete(), .handleEditSubmit()
│       │                          .setCardView()
│       └── addbier.js          ← AddBierView
│                                  .init()
│                                  .handleSubmit()
│                                  .handleStyleChange()
│                                  .saveNewStyle()
└── html/
    └── Pages/
        ├── Anmelden.html       ← SPA-Shell: nur HTML + 5 Script-Tags
        ├── AddBier.html        ← Redirect → /anmelden#add
        └── Welcome Page.html   ← statische Landingpage
```

---

## API-Dokumentation

> Alle Endpunkte unter `/api/` außer `/api/auth/signin` und `/api/auth/login`
> erfordern einen gültigen JWT-Token im Header:
> `Authorization: Bearer <token>`

---

### Authentifizierung

#### `POST /api/auth/signin` — Registrierung

Erstellt einen neuen Benutzer.

**Request Body:**
```json
{
  "username": "hopfenhans",
  "password": "geheim123",
  "name": "Hopfen Hans"
}
```

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| username | string | ja | min. 3 Zeichen, muss einzigartig sein |
| password | string | ja | min. 6 Zeichen |
| name | string | nein | Anzeigename (Standard = username) |

**Response `201 Created`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "hopfenhans",
    "name": "Hopfen Hans"
  }
}
```

**Mögliche Fehler:**
| Status | Bedeutung |
|---|---|
| 400 | Fehlende oder zu kurze Felder |
| 409 | Benutzername bereits vergeben |

---

#### `POST /api/auth/login` — Login

Meldet einen bestehenden Benutzer an.

**Request Body:**
```json
{
  "username": "hopfenhans",
  "password": "geheim123"
}
```

**Response `200 OK`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "550e8400-...",
    "username": "hopfenhans",
    "name": "Hopfen Hans"
  }
}
```

**Mögliche Fehler:**
| Status | Bedeutung |
|---|---|
| 401 | Ungültige Anmeldedaten (absichtlich unspezifisch) |

---

#### `GET /api/auth/me` — Aktueller Benutzer

Gibt die Daten des eingeloggten Benutzers zurück. Benötigt Token.

**Response `200 OK`:**
```json
{
  "user": {
    "id": "550e8400-...",
    "username": "hopfenhans",
    "name": "Hopfen Hans",
    "created_at": "2024-01-15 10:30:00"
  }
}
```

---

### Biere

#### `GET /api/beers` — Alle Biere abrufen

Gibt alle Biere des eingeloggten Benutzers zurück, sortiert nach Datum (neueste zuerst).

**Response `200 OK`:**
```json
[
  {
    "id": "abc123",
    "user_id": "550e8400-...",
    "name": "Augustiner Helles",
    "rating": 5,
    "origin": "München, Bayern",
    "style": "Helles",
    "date": "2024-06-01T00:00:00",
    "notes": "Sehr frisch, leicht malzig",
    "counter": 3,
    "created_at": "2024-06-01 12:00:00"
  }
]
```

---

#### `GET /api/beers/{id}` — Ein Bier abrufen

Gibt ein einzelnes Bier anhand seiner ID zurück.

**URL-Parameter:** `id` — die UUID des Biers

**Response `200 OK`:** ein einzelnes Bier-Objekt (gleiche Struktur wie oben)

**Mögliche Fehler:**
| Status | Bedeutung |
|---|---|
| 404 | Bier nicht gefunden oder gehört einem anderen User |

---

#### `POST /api/beers` — Bier erstellen

Erstellt ein neues Bier. Wenn ein Bier mit gleichem Namen (Groß-/Kleinschreibung egal)
bereits existiert, wird stattdessen der Zähler (`counter`) erhöht.

**Request Body:**
```json
{
  "name": "Augustiner Helles",
  "rating": 5,
  "origin": "München, Bayern",
  "style": "Helles",
  "date": "2024-06-01",
  "notes": "Sehr frisch"
}
```

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| name | string | ja | Name des Biers |
| rating | integer | ja | 1–5 |
| origin | string | ja | Herkunftsort |
| style | string | ja | Bierstil |
| date | string | nein | ISO-Datum (Standard: jetzt) |
| notes | string | nein | persönliche Notizen |

**Response `200 OK` (normaler Fall):**
```json
{
  "id": "abc123",
  "name": "Augustiner Helles",
  "rating": 5,
  ...
}
```

**Response `200 OK` (Zähler erhöht):**
```json
{
  "id": "abc123",
  "name": "Augustiner Helles",
  "counter": 4,
  "_incremented": true,
  ...
}
```

---

#### `PUT /api/beers/{id}` — Bier bearbeiten

Aktualisiert ein vorhandenes Bier. Alle Felder sind optional – nur geänderte Felder müssen mitgeschickt werden.

**Request Body (alle Felder optional):**
```json
{
  "name": "Augustiner Hell",
  "rating": 4,
  "notes": "Noch besser als gedacht"
}
```

**Response `200 OK`:** das aktualisierte Bier-Objekt

**Mögliche Fehler:**
| Status | Bedeutung |
|---|---|
| 404 | Bier nicht gefunden |
| 400 | Ungültiges Rating (nicht 1–5) |

---

#### `DELETE /api/beers/{id}` — Bier löschen

Löscht ein Bier dauerhaft.

**Response `204 No Content`:** kein Body

**Mögliche Fehler:**
| Status | Bedeutung |
|---|---|
| 404 | Bier nicht gefunden |

---

### Statistiken

#### `GET /api/stats/summary` — Statistiken

Berechnet eine Zusammenfassung aller Biere des eingeloggten Benutzers.

**Response `200 OK`:**
```json
{
  "total": 42,
  "avgRating": 3.8,
  "topStyle": "Helles",
  "latestBeer": {
    "id": "abc123",
    "name": "Augustiner Helles",
    ...
  }
}
```

| Feld | Typ | Beschreibung |
|---|---|---|
| total | integer | Anzahl aller Bier-Einträge |
| avgRating | float | Durchschnittsbewertung, gerundet auf 1 Dezimalstelle |
| topStyle | string | am häufigsten eingetragener Bierstil (`null` wenn keine Biere) |
| latestBeer | object | das zuletzt eingetragene Bier (`null` wenn keine Biere) |

---

### Bierstile

#### `GET /api/styles` — Alle Bierstile

Gibt alle verfügbaren Bierstile zurück, alphabetisch sortiert.

**Response `200 OK`:**
```json
["Bock", "Dunkel", "Helles", "IPA", "Kellerbier", "Lager", "Maerzen", "Pils", "Porter", "Sonstiges", "Stout", "Weizen"]
```

---

#### `POST /api/styles` — Neuen Bierstil erstellen

Erstellt einen neuen Bierstil der dann in allen Formularen zur Auswahl steht.

**Request Body:**
```json
{
  "name": "Rauchbier"
}
```

**Response `201 Created`:**
```json
{
  "name": "Rauchbier",
  "allStyles": ["Bock", "Dunkel", ..., "Rauchbier", ...]
}
```

**Mögliche Fehler:**
| Status | Bedeutung |
|---|---|
| 409 | Dieser Stil existiert bereits |

---

## Sicherheitskonzept

```
Passwort          →  bcrypt-Hash  →  Datenbank
                     (nicht umkehrbar)

Login-Erfolg      →  JWT-Token  →  localStorage im Browser
                     (läuft nach 24h ab)

Jede API-Anfrage  →  Token im Authorization-Header
                  →  Server prüft Signatur
                  →  Server liest User-ID aus Token
                  →  Datenbankabfrage nur für diesen User
```

Jeder Benutzer sieht ausschließlich seine eigenen Biere.
Das wird durch `WHERE user_id = ?` in jeder Datenbankabfrage sichergestellt.

---

## Deployment auf Render

1. Repository auf GitHub pushen
2. Auf render.com neuen **Web Service** erstellen
3. Docker-Option wählen (Render erkennt das Dockerfile automatisch)
4. Umgebungsvariable setzen: `JWT_SECRET` mit einem langen zufälligen Wert
5. Einen **Persistent Disk** unter `/data` einrichten damit die SQLite-Datenbank erhalten bleibt
6. Deploy starten

Nach dem Deployment ist die App unter `https://dein-name.onrender.com` erreichbar.
