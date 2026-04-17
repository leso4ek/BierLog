# BierLog – Vollständige Projektdokumentation

---

## Was ist BierLog?

BierLog ist eine Web-App mit der man Biere die man probiert hat speichern kann.
Man kann für jedes Bier eine Bewertung, eine Herkunft, einen Bierstil und Notizen eintragen.
Die App zeigt einem dann Statistiken, zum Beispiel wie viele Biere man insgesamt probiert hat
oder welcher Bierstil einem am meisten schmeckt.

---

## Wie ist das Projekt aufgebaut?

Das Projekt besteht aus zwei Teilen die zusammenarbeiten:

```
BierLog/
│
├── backend/
│   ├── main.py              ← der Server (Python)
│   └── requirements.txt     ← liste der benötigten Python-Pakete
│
├── public/
│   ├── css/
│   │   └── styles.css       ← das Design der App
│   ├── js/
│   │   └── api.js           ← JavaScript-Funktionen die mit dem Server reden
│   └── html/
│       └── Pages/
│           ├── Anmelden.html     ← die Hauptseite (Login + Dashboard + Bier hinzufügen)
│           ├── AddBier.html      ← separate Seite zum Bier hinzufügen
│           └── Welcome Page.html ← die Startseite
│
├── Dockerfile               ← Anleitung um die App in Docker zu starten
├── docker-compose.yml       ← Konfiguration für Docker Compose
└── DOKUMENTATION.md         ← diese Datei
```

**Der Backend-Teil** ist der Server. Er läuft im Hintergrund, speichert alle Daten in einer Datenbank
und beantwortet Anfragen vom Browser.

**Der Frontend-Teil** ist alles was der Benutzer im Browser sieht. Die HTML-Dateien sind die Seiten,
CSS macht sie schön aussehen und JavaScript lässt sie funktionieren.

---

## Teil 1: Das Backend (main.py)

### Was ist ein Backend überhaupt?

Stell dir vor du bestellst in einem Restaurant. Du (der Browser) sagst dem Kellner (dem Backend)
was du willst. Der Kellner geht in die Küche (die Datenbank), holt das Essen und bringt es dir zurück.
Das Backend ist also der unsichtbare Teil der App der die eigentliche Arbeit macht.

### FastAPI – das Herzstück des Backends

Das Backend wurde mit **FastAPI** geschrieben. FastAPI ist ein Python-Framework das einem hilft
sehr einfach einen Web-Server zu bauen.

```python
app = FastAPI(title="BierLog API", version="3.0.0", docs_url="/api/docs")
```

Diese eine Zeile erstellt den gesamten Server. Ab jetzt kann man `app` benutzen um dem Server
beizubringen was er tun soll wenn jemand eine bestimmte Adresse aufruft.

### Was ist eine API?

API steht für **Application Programming Interface**. Auf Deutsch: eine Schnittstelle zwischen zwei Programmen.

In diesem Fall ist die API eine Sammlung von Adressen (sogenannte **Endpunkte**) die der Browser aufrufen kann.
Zum Beispiel:

- `GET /api/beers` → gibt alle Biere zurück
- `POST /api/beers` → erstellt ein neues Bier
- `DELETE /api/beers/123` → löscht das Bier mit der ID 123

`GET`, `POST`, `DELETE` usw. heißen **HTTP-Methoden** und beschreiben was man mit der Adresse machen will.

### CORS – warum braucht man das?

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)
```

CORS steht für **Cross-Origin Resource Sharing**. Browser haben aus Sicherheitsgründen eine Regel:
JavaScript darf normalerweise keine Anfragen an andere Server schicken als den von dem die Seite geladen wurde.

Da das Frontend und Backend manchmal auf verschiedenen Adressen laufen (z.B. beim Entwickeln),
muss der Server ausdrücklich erlauben dass andere Seiten ihn aufrufen dürfen.
`allow_origins=["*"]` bedeutet: alle dürfen anfragen.

---

## Teil 2: Die Datenbank

### Was ist SQLite?

SQLite ist eine Datenbank die komplett in einer einzigen Datei gespeichert wird.
Es gibt kein extra Datenbankprogramm das man installieren muss – SQLite ist direkt in Python eingebaut.

Die Datei heißt `bierlog.db` und wird standardmäßig unter `/data/bierlog.db` gespeichert.
Das kann man mit der Umgebungsvariable `DB_PATH` ändern.

### Die drei Tabellen

Die Datenbank hat drei Tabellen. Eine Tabelle ist wie eine Excel-Tabelle:
Sie hat Spalten (was gespeichert wird) und Zeilen (ein Datensatz pro Zeile).

#### Tabelle: users (Benutzer)

| Spalte     | Typ   | Bedeutung                                      |
|------------|-------|------------------------------------------------|
| id         | TEXT  | eine eindeutige ID (z.B. "a1b2-c3d4-...")      |
| username   | TEXT  | der Benutzername (muss einzigartig sein)       |
| name       | TEXT  | der Anzeigename (z.B. "Hopfen-Hans")           |
| password   | TEXT  | das Passwort – aber sicher verschlüsselt!      |
| created_at | TEXT  | wann das Konto erstellt wurde                  |

#### Tabelle: beers (Biere)

| Spalte     | Typ     | Bedeutung                                          |
|------------|---------|----------------------------------------------------|
| id         | TEXT    | eindeutige ID des Biers                            |
| user_id    | TEXT    | welchem Benutzer gehört dieses Bier                |
| name       | TEXT    | Name des Biers (z.B. "Augustiner Helles")          |
| rating     | INTEGER | Bewertung von 1 bis 5                              |
| origin     | TEXT    | Herkunft (z.B. "München, Bayern")                  |
| style      | TEXT    | Bierstil (z.B. "Helles")                           |
| date       | TEXT    | Datum der Verkostung                               |
| notes      | TEXT    | persönliche Notizen                                |
| counter    | INTEGER | wie oft man das Bier schon eingetragen hat         |
| created_at | TEXT    | wann der Eintrag erstellt wurde                    |

#### Tabelle: beer_styles (Bierstile)

| Spalte | Typ     | Bedeutung                    |
|--------|---------|------------------------------|
| id     | INTEGER | automatische fortlaufende ID |
| name   | TEXT    | Name des Stils (z.B. "IPA")  |

### Was sind Foreign Keys?

`user_id` in der `beers`-Tabelle ist ein **Foreign Key** (Fremdschlüssel).
Er verweist auf die `id` in der `users`-Tabelle.

Das bedeutet: Jedes Bier gehört zu einem bestimmten Benutzer.
Der Server kann dadurch sicherstellen, dass man nur seine eigenen Biere sehen und bearbeiten kann.

### Wie wird die Datenbank verbunden?

```python
def get_db_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection
```

`sqlite3.connect()` öffnet die Datenbankdatei. Falls sie noch nicht existiert wird sie automatisch erstellt.

`connection.row_factory = sqlite3.Row` ist eine Einstellung die dafür sorgt dass man auf
die Ergebnisse mit Spaltennamen zugreifen kann statt mit Zahlen.
Also `user["username"]` statt `user[1]`.

`PRAGMA foreign_keys = ON` aktiviert die Fremdschlüssel-Überprüfung.
`PRAGMA journal_mode = WAL` ist eine Performance-Optimierung.

**Wichtig:** Nach jeder Nutzung wird die Verbindung mit `connection.close()` wieder geschlossen.
Offene Verbindungen verbrauchen Ressourcen, deshalb muss man sie immer schließen.

---

## Teil 3: Sicherheit – Passwörter und Tokens

### Warum werden Passwörter nicht direkt gespeichert?

Man darf Passwörter **niemals** im Klartext speichern. Falls ein Angreifer die Datenbank stiehlt,
hätte er dann alle Passwörter.

Stattdessen wird ein sogenannter **Hash** gespeichert. Ein Hash ist ein mathematischer Einweg-Prozess:
Man kann aus einem Passwort einen Hash berechnen, aber aus dem Hash kann man das Passwort
**nicht** zurückberechnen.

```python
def hash_password(plain_password):
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")
```

Hier wird **bcrypt** benutzt. Das ist ein besonders sicherer Hash-Algorithmus für Passwörter.

`bcrypt.gensalt()` erzeugt einen zufälligen **Salt** – eine zufällige Zeichenkette die vor dem Hashen
zum Passwort dazugemischt wird. Das verhindert dass zwei Benutzer mit dem gleichen Passwort
auch den gleichen Hash haben.

Wenn sich ein Benutzer einloggt wird das eingegebene Passwort neu gehasht und mit dem
gespeicherten Hash verglichen:

```python
def verify_password(plain_password, hashed_password):
    result = bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    return result
```

### Was sind JWT-Tokens?

Wenn sich ein Benutzer einloggt bekommt er einen **Token** zurück. Ein Token ist eine
verschlüsselte Zeichenkette die beweist dass man eingeloggt ist.

JWT steht für **JSON Web Token**. Ein JWT hat drei Teile die mit einem Punkt getrennt sind:

```
Header.Payload.Signatur
eyJhbGci....eyJ1c2VyaWQi....SflKxwRJSMeK
```

- **Header**: welcher Algorithmus wurde verwendet
- **Payload**: die eigentlichen Daten (z.B. Benutzer-ID, Benutzername, Ablaufzeit)
- **Signatur**: beweist dass der Token echt ist und nicht verändert wurde

```python
def create_token(user_data):
    expire_time = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {}
    payload["id"] = user_data["id"]
    payload["username"] = user_data["username"]
    payload["name"] = user_data["name"]
    payload["exp"] = expire_time
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
    return token
```

`JWT_SECRET` ist ein geheimer Schlüssel den nur der Server kennt. Mit diesem Schlüssel wird
die Signatur erstellt. Wenn jemand den Token verändert stimmt die Signatur nicht mehr und
der Server lehnt den Token ab.

Der Token läuft nach 24 Stunden ab (`JWT_EXPIRE_HOURS = 24`). Danach muss man sich neu einloggen.

### Wie wird der Token bei jeder Anfrage geprüft?

```python
bearer = HTTPBearer()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    user_data = decode_token(creds.credentials)
    return user_data
```

Jede geschützte Route hat `cu = Depends(get_current_user)` als Parameter.
`Depends` ist eine FastAPI-Funktion die bedeutet: "Bevor du diese Route ausführst,
führe zuerst `get_current_user` aus."

Der Browser schickt den Token im `Authorization`-Header mit:
```
Authorization: Bearer eyJhbGci...
```

Falls kein Token mitgeschickt wird oder er ungültig ist gibt der Server einen `401`-Fehler zurück.

---

## Teil 4: Die API-Endpunkte im Detail

### Registrierung: POST /api/auth/signin

**Was macht dieser Endpunkt?**
Er erstellt ein neues Benutzerkonto.

**Was wird geprüft?**
1. Benutzername und Passwort dürfen nicht leer sein
2. Benutzername muss mindestens 3 Zeichen haben
3. Passwort muss mindestens 6 Zeichen haben
4. Der Benutzername darf noch nicht vergeben sein

**Was wird gespeichert?**
Eine neue Zeile in der `users`-Tabelle. Das Passwort wird vorher mit bcrypt gehasht.

**Was wird zurückgegeben?**
Ein JWT-Token und die Benutzerdaten (ohne Passwort!).

```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "a1b2-c3d4",
    "username": "hopfenhans",
    "name": "Hopfen Hans"
  }
}
```

---

### Login: POST /api/auth/login

**Was macht dieser Endpunkt?**
Er prüft ob Benutzername und Passwort stimmen und gibt einen Token zurück.

**Wichtig:** Bei einem falschen Login wird immer "Ungültige Anmeldedaten" zurückgegeben –
egal ob der Benutzername nicht existiert oder das Passwort falsch ist.
Das ist Absicht! Man soll nicht herausfinden können ob ein bestimmter Benutzername existiert.

---

### Bier hinzufügen: POST /api/beers

**Was macht dieser Endpunkt?**
Er fügt ein neues Bier in die Datenbank ein.

**Besonderheit – der Zähler:**
Wenn man ein Bier hinzufügt das man schon mal eingetragen hat (gleicher Name),
wird kein neuer Eintrag erstellt. Stattdessen wird der `counter` des vorhandenen Eintrags
um 1 erhöht.

```python
existing_beer = connection.execute(
    "SELECT * FROM beers WHERE LOWER(name) = LOWER(?) AND user_id = ?",
    (body.name.strip(), cu["id"])
).fetchone()

if existing_beer:
    connection.execute(
        "UPDATE beers SET counter = counter + 1 WHERE id = ? AND user_id = ?",
        (existing_beer["id"], cu["id"])
    )
```

`LOWER()` sorgt dafür dass "augustiner" und "Augustiner" als dasselbe Bier erkannt werden.

Wenn ein Bier erhöht wurde enthält die Antwort `"_incremented": True`.
Das Frontend zeigt dann einen Hinweis an.

---

### Statistiken: GET /api/stats/summary

**Was macht dieser Endpunkt?**
Er berechnet Zusammenfassungen aus allen Bieren des Benutzers.

```python
row = connection.execute(
    "SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM beers WHERE user_id = ?",
    (cu["id"],)
).fetchone()
```

`COUNT(*)` zählt wie viele Zeilen es gibt.
`AVG(rating)` berechnet den Durchschnitt aller Bewertungen.

```python
top_style = connection.execute(
    "SELECT style, COUNT(*) as cnt FROM beers WHERE user_id = ? GROUP BY style ORDER BY cnt DESC LIMIT 1",
    (cu["id"],)
).fetchone()
```

`GROUP BY style` gruppiert alle Biere nach Stil.
`ORDER BY cnt DESC` sortiert nach Häufigkeit – der häufigste Stil kommt zuerst.
`LIMIT 1` nimmt nur den ersten (also häufigsten) Eintrag.

---

## Teil 5: Das Frontend

### Was ist eine Single Page Application?

Normale Webseiten laden bei jedem Klick eine komplett neue HTML-Seite vom Server.

`Anmelden.html` ist eine **Single Page Application** (SPA). Das bedeutet:
Es gibt nur eine HTML-Datei und JavaScript wechselt zwischen verschiedenen Ansichten
ohne die Seite neu zu laden. Das fühlt sich schneller und flüssiger an.

Es gibt drei Ansichten in einer Datei:
- `view-auth` – Login und Registrierung
- `view-dashboard` – alle Biere und Statistiken
- `view-add` – Bier hinzufügen

```javascript
function showView(name) {
    for (var i = 0; i < VIEWS.length; i++) {
        var viewElement = document.getElementById('view-' + VIEWS[i]);
        if (viewElement) {
            viewElement.classList.remove('active');
        }
    }
    var targetView = document.getElementById('view-' + name);
    if (targetView) {
        targetView.classList.add('active');
    }
    history.pushState(null, '', '#' + name);
}
```

Es werden alle Ansichten versteckt (CSS: `display: none`) und dann nur die gewünschte angezeigt
(CSS-Klasse `active` → `display: block`).

`history.pushState` aktualisiert die URL ohne die Seite neu zu laden.
Dadurch funktioniert der Zurück-Button im Browser und man kann URLs bookmarken.

---

## Teil 6: api.js – der Kommunikationskanal

Die Datei `api.js` ist eine Hilfsschicht zwischen dem HTML und dem Server.
Sie enthält Funktionen die HTTP-Anfragen an den Server schicken.

### Der Token-Speicher

```javascript
function getToken() {
    var token = localStorage.getItem('bl_token');
    return token;
}

function setToken(token) {
    localStorage.setItem('bl_token', token);
}
```

`localStorage` ist ein kleiner Speicher im Browser. Daten die man dort speichert
bleiben auch nach dem Schließen des Browsers erhalten (anders als `sessionStorage`).

Der Token wird unter dem Schlüssel `bl_token` gespeichert.
Die Benutzerdaten werden unter `bl_user` gespeichert.

### Die request-Funktion

```javascript
async function request(method, path, body, needsAuth) {
    var options = {
        method: method,
        headers: headers
    };
    if (body !== null && body !== undefined) {
        options.body = JSON.stringify(body);
    }
    var response = await fetch(API_BASE + path, options);
    var data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Serverfehler.');
    }
    return data;
}
```

`fetch` ist eine eingebaute Browser-Funktion die HTTP-Anfragen schicken kann.

`async` und `await` gehören zusammen. Netzwerkanfragen dauern eine kurze Zeit.
`async` markiert eine Funktion als "kann auf etwas warten". `await` bedeutet "warte hier
bis die Antwort da ist bevor du weitermachst". Ohne `await` würde JavaScript nicht warten
und weiterarbeiten obwohl die Antwort noch nicht angekommen ist.

`JSON.stringify(body)` wandelt ein JavaScript-Objekt in einen JSON-String um.
JSON ist das Format in dem Browser und Server miteinander reden.

`response.ok` ist `true` wenn der HTTP-Status zwischen 200 und 299 liegt (Erfolg).
Bei einem Fehler (z.B. 400, 401, 404, 500) wird ein Fehler geworfen.

---

## Teil 7: Das Design (styles.css)

### CSS-Variablen

```css
:root {
    --gold: #f59e0b;
    --bg:   #120b01;
    --text: #fef9ec;
}
```

`--gold`, `--bg` usw. sind **CSS-Variablen** (auch Custom Properties genannt).
Man definiert sie einmal und kann sie dann überall benutzen:

```css
.btn-primary {
    background: var(--gold);
}
```

Wenn man die Farbe ändern will muss man sie nur an einer Stelle ändern statt hundertmal.

### Flexbox und Grid

Das Layout wird mit **Flexbox** und **CSS Grid** gebaut. Das sind moderne Methoden
um Elemente auf einer Seite anzuordnen.

```css
.navbar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
```

`display: flex` macht einen Container zum Flex-Container. Alle direkten Kinder
werden nebeneinander angeordnet. `justify-content: space-between` verteilt sie gleichmäßig
mit maximalem Abstand zwischen ihnen – perfekt für eine Navbar mit Logo links und Buttons rechts.

```css
.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

@media (min-width: 640px) {
    .stats-grid {
        grid-template-columns: repeat(4, 1fr);
    }
}
```

`display: grid` macht einen Container zum Grid-Container.
`repeat(2, 1fr)` bedeutet: 2 gleichbreite Spalten (`1fr` = 1 freier Anteil).
Der `@media`-Block ist eine **Media Query**: Bei Bildschirmen breiter als 640px
werden 4 Spalten angezeigt. So funktioniert **Responsive Design** – die Seite sieht
auf dem Handy und auf dem Computer gut aus.

### backdrop-filter

```css
.navbar {
    background: rgba(18, 11, 1, 0.85);
    backdrop-filter: blur(12px);
}
```

`backdrop-filter: blur()` macht alles was hinter dem Element ist unscharf.
Das erzeugt den "Frosted Glass"-Effekt den man von modernen Betriebssystemen kennt.
`rgba(18, 11, 1, 0.85)` ist eine leicht transparente Hintergrundfarbe
(der vierte Wert `0.85` ist die Transparenz: 0 = unsichtbar, 1 = völlig undurchsichtig).

---

## Teil 8: Docker

### Was ist Docker?

Docker löst das "bei mir funktioniert es aber"-Problem. Eine App braucht bestimmte
Software-Versionen (z.B. Python 3.12, bestimmte Pakete). Auf verschiedenen Computern
sind aber verschiedene Versionen installiert, was zu Fehlern führt.

Docker **verpackt** die App zusammen mit allem was sie braucht in einen **Container**.
Der Container läuft überall gleich – egal ob auf deinem Laptop, einem Server oder der Cloud.

### Das Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
COPY public/ public/
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- `FROM python:3.12-slim` – starte mit einem fertigen Python-3.12-Image
- `COPY` – kopiere Dateien in den Container
- `RUN pip install` – installiere die Python-Pakete
- `EXPOSE 8000` – der Container nutzt Port 8000
- `CMD` – das wird ausgeführt wenn der Container startet

### docker-compose.yml

```yaml
services:
  bierlog:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - bierlog-data:/data
```

`ports: "8000:8000"` bedeutet: leite Port 8000 vom Container an Port 8000 des Computers weiter.
So kann man `http://localhost:8000` aufrufen.

`volumes: bierlog-data:/data` speichert die Datenbank außerhalb des Containers.
Wenn der Container gelöscht wird bleibt die Datenbank erhalten.

### App starten mit Docker

```bash
docker-compose up --build
```

Das baut den Container und startet ihn. Die App ist dann unter `http://localhost:8000` erreichbar.

---

## Teil 9: Der Datenfluss – von Klick bis Antwort

Am Beispiel "Bier hinzufügen":

```
1. Benutzer füllt das Formular aus und klickt "Speichern"
         ↓
2. JavaScript liest die Formularfelder aus:
   name = "Augustiner Helles"
   origin = "München"
   style = "Helles"
   rating = 4
         ↓
3. api.js schickt eine HTTP-Anfrage an den Server:
   POST http://localhost:8000/api/beers
   Header: Authorization: Bearer eyJhbGci...
   Body: { "name": "Augustiner Helles", "origin": "München", ... }
         ↓
4. Der Server empfängt die Anfrage in main.py
   - prüft den Token (ist der Benutzer eingeloggt?)
   - prüft ob alle Pflichtfelder ausgefüllt sind
   - prüft ob das Bier schon in der Datenbank ist
         ↓
5. Server schreibt das Bier in die SQLite-Datenbank:
   INSERT INTO beers (id, user_id, name, ...) VALUES (...)
         ↓
6. Server schickt das neue Bier als JSON zurück:
   { "id": "xyz", "name": "Augustiner Helles", ... }
         ↓
7. JavaScript empfängt die Antwort
   - falls _incremented: Zähler-Banner anzeigen
   - sonst: zurück zum Dashboard wechseln
         ↓
8. Dashboard lädt neu und zeigt das neue Bier an
```

---

## Teil 10: Häufige Begriffe erklärt

| Begriff       | Bedeutung                                                                                   |
|---------------|---------------------------------------------------------------------------------------------|
| HTTP          | das Protokoll (die Sprache) mit dem Browser und Server kommunizieren                        |
| GET           | Daten abrufen                                                                               |
| POST          | neue Daten erstellen                                                                        |
| PUT           | vorhandene Daten ändern                                                                     |
| DELETE        | Daten löschen                                                                               |
| JSON          | ein Textformat für strukturierte Daten: `{ "name": "Bier", "rating": 5 }`                  |
| Status 200    | Erfolg                                                                                      |
| Status 201    | Erfolg, ein neuer Datensatz wurde erstellt                                                  |
| Status 204    | Erfolg, aber keine Antwort (z.B. nach dem Löschen)                                         |
| Status 400    | Fehler: die Anfrage war falsch (z.B. fehlende Felder)                                       |
| Status 401    | Fehler: nicht angemeldet                                                                    |
| Status 404    | Fehler: nicht gefunden                                                                      |
| Status 409    | Fehler: Konflikt (z.B. Benutzername schon vergeben)                                         |
| Status 500    | Fehler: interner Serverfehler                                                               |
| Hash          | ein Einweg-Fingerabdruck eines Passworts – kann nicht rückgängig gemacht werden             |
| Token         | eine verschlüsselte Zeichenkette die beweist dass man eingeloggt ist                        |
| localStorage  | ein kleiner Datenspeicher im Browser                                                        |
| async/await   | JavaScript-Schlüsselwörter um auf Netzwerkanfragen zu warten                               |
| DOM           | Document Object Model – die Baumstruktur einer HTML-Seite, änderbar mit JavaScript         |
| Endpunkt      | eine bestimmte Adresse (URL) in der API                                                     |
| Middleware     | Code der bei jeder Anfrage dazwischen geschaltet wird (z.B. CORS, Token-Prüfung)           |
| Container     | eine isolierte Umgebung in der eine App läuft (Docker)                                      |
