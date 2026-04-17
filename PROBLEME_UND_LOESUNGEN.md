# BierLog – Probleme & Lösungen

Dieses Dokument beschreibt Probleme die während der Entwicklung aufgetreten sind
und wie sie gelöst wurden.

---

## Problem 1: CSS wurde nicht geladen – Styles fehlten komplett

### Symptom

Die App startete ohne jegliches Design. Alles war schwarz-weiß, Buttons sahen aus wie
normale Links und das Layout war komplett zerstört. In der Browser-Konsole stand:

```
GET http://localhost:8000/css/styles.css  404 Not Found
```

### Ursache

In den HTML-Dateien war der Pfad zur CSS-Datei falsch eingetragen.
Die HTML-Dateien lagen in `public/html/Pages/` aber der CSS-Pfad zeigte auf
`../../css/styles.css` – das funktioniert nur wenn der Browser die Datei direkt vom
Dateisystem öffnet, nicht wenn sie über einen Server ausgeliefert wird.

Außerdem hatten manche Seiten noch einen absoluten Pfad `/css/styles.css` ohne `/static/`.
FastAPI liefert statische Dateien aber nur unter dem Präfix `/static/`.

### Lösung

In allen HTML-Dateien die über den Server ausgeliefert werden (also alle außer der
Welcome Page über direkte Dateiöffnung) wurde der Pfad auf den korrekten Static-Pfad geändert:

```html
<!-- Falsch: -->
<link rel="stylesheet" href="../../css/styles.css" />

<!-- Richtig: -->
<link rel="stylesheet" href="/static/css/styles.css" />
```

FastAPI stellt alle Dateien unter `public/` über den Pfad `/static/` bereit:

```python
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
```

---

## Problem 2: Server startete nicht – falsches Modul benutzt

### Symptom

Beim Start des Servers mit `python main.py` erschien sofort ein Fehler:

```
ModuleNotFoundError: No module named 'fastapi'
```

Oder nach Installation der Pakete:

```
ERROR: Could not find a version that satisfies the requirement pydantic (from versions: none)
```

### Ursache

Es wurde die falsche Python-Umgebung benutzt. Auf dem Computer waren mehrere
Python-Versionen installiert und `pip install` hatte die Pakete in eine andere
Python-Version installiert als die die beim Ausführen von `python` gestartet wurde.

Außerdem fehlte das Paket `python-multipart` das FastAPI intern für Formulare benötigt –
es stand nicht in der `requirements.txt` und musste manuell nachgetragen werden.

### Lösung

Eine virtuelle Umgebung (Virtual Environment) anlegen und immer darin arbeiten:

```bash
# Virtual Environment erstellen
python -m venv venv

# aktivieren (Windows)
venv\Scripts\activate

# aktivieren (Mac/Linux)
source venv/bin/activate

# Pakete installieren
pip install -r backend/requirements.txt
```

Außerdem wurde die `requirements.txt` um alle fehlenden Pakete ergänzt:

```
fastapi
uvicorn[standard]
python-jose[cryptography]
bcrypt
pydantic
python-multipart
```

---

## Problem 3: App funktionierte lokal, aber nicht nach dem Deployment auf Render

### Symptom

Lokal lief alles perfekt. Nach dem Deployment auf Render öffnete sich die Seite,
aber beim Login erschien sofort:

```
Failed to load resource: net::ERR_CONNECTION_REFUSED
localhost:8000/api/auth/signin
```

### Ursache

In `api.js` war die API-Adresse auf `localhost` hardcoded:

```javascript
var API_BASE = 'http://localhost:8000/api';
```

`localhost` bedeutet im Browser immer der eigene Computer des Nutzers.
Auf Render läuft der Server aber auf einem anderen Rechner in der Cloud.
Der Browser des Nutzers hat keinen Server auf Port 8000 – daher `ERR_CONNECTION_REFUSED`.

### Lösung

Da Backend und Frontend vom gleichen Server ausgeliefert werden (FastAPI bedient beides),
reicht ein relativer Pfad:

```javascript
var API_BASE = '/api';
```

Ein relativer Pfad wie `/api` löst automatisch zur aktuellen Domain auf –
also `localhost:8000` lokal und `dein-name.onrender.com` in der Cloud.

---

## Problem 4: Datenbank funktionierte nicht – falsche API-Pfade in api.js

### Symptom

Das Login-Formular wurde abgeschickt, aber es kam immer ein Fehler:

```
404 Not Found
POST /api/auth/login → "Not Found"
```

Oder Biere konnten nicht geladen werden:

```
404 Not Found
GET /api/beer → "Not Found"
```

### Ursache

In `api.js` waren die Pfade in den Funktionen falsch eingetragen.
Die FastAPI-Routen heißen `/api/beers` (Plural) und `/api/auth/login`,
aber in `api.js` standen die falschen Pfade:

```javascript
// Falsch:
getTasks: function() {
    return request('GET', '/beer');      // ← fehlender 's'
}

login: async function(username, password) {
    return request('POST', '/auth/Login', ...);  // ← großes 'L'
}
```

Außerdem war die Basis-URL `API_BASE` auf `/api` gesetzt, aber in manchen Aufrufen
wurde `/api/beers` als vollständiger Pfad übergeben, was zu `/api/api/beers` führte.

### Lösung

Alle Pfade in `api.js` müssen exakt mit den Routen in `main.py` übereinstimmen.
Die Pfade sind case-sensitive (Groß-/Kleinschreibung wichtig):

```javascript
var API_BASE = '/api';

var Auth = {
    login:  function() { return request('POST', '/auth/login',  ...); },  // ← genau wie in main.py
    signin: function() { return request('POST', '/auth/signin', ...); }
};

var Beers = {
    getAll: function()     { return request('GET',    '/beers');          },
    create: function(data) { return request('POST',   '/beers',    data); },
    update: function(id, d){ return request('PUT',    '/beers/' + id, d); },
    delete: function(id)   { return request('DELETE', '/beers/' + id);   }
};
```

Die Routen in `main.py` sind dabei die Quelle der Wahrheit. `api.js` muss sich
nach ihnen richten, nicht umgekehrt.

---

## Problem 5: SPA bauen – kein echter SPA, weil mehrere HTML-Seiten

### Symptom

Beim Klick auf "Bier hinzufügen" wurde eine komplett neue Seite geladen (`AddBier.html`).
Man konnte das an der kurzen Unterbrechung im Browser sehen (die Seite flackerte beim Laden).
Der Browser-Verlauf enthielt mehrere Einträge obwohl man nur eine App hat.

Außerdem: Wenn man auf der `AddBier.html` war und auf "Abbrechen" klickte,
landete man nicht direkt im Dashboard sondern musste über Server-Routing navigieren.

### Ursache

Das Projekt war ursprünglich als **Multi-Page Application (MPA)** gebaut:
`Anmelden.html` für Login/Dashboard und `AddBier.html` als separate Seite
für das Hinzufügen von Bieren. Bei jedem Seitenwechsel schickte der Browser
eine neue HTTP-Anfrage an FastAPI.

Das ist kein echtes SPA-Verhalten.

### Lösung

Das Frontend wurde nach dem **SPA-Prinzip** umgebaut:

1. **Eine einzige HTML-Shell** (`Anmelden.html`) enthält alle drei Views als
   versteckte `<div>`-Elemente: `view-auth`, `view-dashboard`, `view-add`.

2. **Router** (`router.js`) übernimmt die Navigation komplett im Browser:
   ```javascript
   Router.go('add');  // kein HTTP-Request – nur CSS-Klassen tauschen
   ```

3. **URL bleibt konsistent** durch `history.pushState`:
   ```javascript
   history.pushState(null, '', '#add');
   ```

4. **`AddBier.html`** macht nur noch einen sofortigen Redirect:
   ```javascript
   window.location.replace('/anmelden#add');
   ```

Das Ergebnis: Navigation ohne Page-Reload, flüssiges Nutzererlebnis,
funktionierender Zurück-Button.

---

## Problem 6: JWT-Token ungültig nach Neustart des Servers

### Symptom

Nach einem Neustart des Servers (z.B. nach einem Deployment) wurden alle Benutzer
automatisch ausgeloggt. Beim nächsten Seitenaufruf erschien der Login-Screen obwohl
man noch im Browser eingeloggt sein sollte. In der Konsole:

```
401 Unauthorized – Ungültiger oder abgelaufener Token.
```

### Ursache

Der `JWT_SECRET` war in der Entwicklungsumgebung auf einen Standard-Wert gesetzt:

```python
JWT_SECRET = os.getenv("JWT_SECRET", "bierlog-secret-dev-2024")
```

Beim Deployment auf Render wurde die Umgebungsvariable `JWT_SECRET` nicht gesetzt.
Render benutzt aber bei jedem neuen Deployment eine frische Umgebung, wodurch
der Secret-Wert zwar gleich blieb – aber das eigentliche Problem war ein anderes:

Der Secret hatte sich geändert weil eine frühere Version der App einen anderen
hardcoded Wert hatte. Alle Tokens die mit dem alten Secret signiert wurden
sind mit dem neuen Secret ungültig.

### Lösung

Auf Render unter **Environment Variables** einen festen, langen Secret setzen:

```
JWT_SECRET = mein-sehr-langer-geheimer-schluessel-2024-xyz123
```

Dieser Wert ändert sich nie automatisch. Solange der gleiche Secret benutzt wird
bleiben alle Tokens gültig. Nur wenn man den Secret absichtlich ändert
(z.B. nach einem Sicherheitsvorfall) werden alle Nutzer ausgeloggt – was dann gewollt ist.

---

## Problem 7: Datenbank ging nach Neustart des Containers verloren

### Symptom

Nach `docker-compose down` und erneutem `docker-compose up --build` waren
alle Benutzer und alle Biere weg. Die App startete als wäre sie brandneu.

### Ursache

Die SQLite-Datenbankdatei `bierlog.db` lag im Container unter `/data/bierlog.db`.
Wenn ein Docker-Container gelöscht wird (`docker-compose down`) werden alle Dateien
im Container die nicht in einem **Volume** gespeichert sind ebenfalls gelöscht.

### Lösung

In `docker-compose.yml` ein **Named Volume** für das `/data`-Verzeichnis einrichten:

```yaml
services:
  bierlog:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - bierlog-data:/data        ← Volume mounten

volumes:
  bierlog-data:                   ← Volume definieren
```

Ein Named Volume wird von Docker außerhalb des Containers gespeichert und
überlebt `docker-compose down`. Nur `docker-compose down -v` würde auch
das Volume löschen (das `-v`-Flag steht für Volumes).

Auf Render muss entsprechend ein **Persistent Disk** unter dem Pfad `/data`
eingerichtet werden, da Render-Container bei jedem Deployment neu gebaut werden.

---

## Zusammenfassung

| Problem | Ursache | Lösung |
|---|---|---|
| CSS fehlte | Falscher Pfad in HTML (`../../` statt `/static/`) | Pfad auf `/static/css/styles.css` korrigiert |
| Server startete nicht | Falsches Python / fehlende Pakete | Virtual Environment + vollständige `requirements.txt` |
| App funktionierte nicht auf Render | `localhost:8000` hardcoded in `api.js` | Relativen Pfad `/api` benutzen |
| API-Aufrufe schlugen fehl | Falsche Pfade in `api.js` (Tippfehler, falsche Groß-/Kleinschreibung) | Pfade exakt mit `main.py`-Routen abgleichen |
| Kein echtes SPA | Separate HTML-Datei für jede View (MPA statt SPA) | Alle Views in eine HTML-Shell + Router |
| Token nach Neustart ungültig | Kein fester `JWT_SECRET` in Produktion | `JWT_SECRET` als Umgebungsvariable auf Render setzen |
| Datenbank nach Neustart leer | SQLite-Datei im Container ohne Volume | Named Volume in Docker / Persistent Disk auf Render |
