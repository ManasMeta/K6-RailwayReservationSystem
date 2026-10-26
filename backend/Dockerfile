FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# db/ is copied too: the migrate service runs db/migrate.py from this same image
COPY backend backend
COPY db db

WORKDIR /srv/backend
EXPOSE 8000

# The API; docker-compose overrides the command for the migrate and worker services.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
