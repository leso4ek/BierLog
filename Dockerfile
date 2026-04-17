# ─────────────────────────────────────────────────────────────────────
# BierLog – Dockerfile
# Ein einziger Container: FastAPI Backend + statisches Frontend
# ─────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

# Arbeitsverzeichnis
WORKDIR /app

# Python Dependencies installieren
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend-Code kopieren
COPY backend/main.py .

# Frontend-Dateien kopieren
COPY public/ ./public/

# Datenbank-Verzeichnis erstellen
RUN mkdir -p /data

# Port freigeben
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/docs')"

# Server starten
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
