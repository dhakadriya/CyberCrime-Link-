FROM python:3.11-slim

# Don't run as root inside container
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install system dependencies for python-magic and psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create evidence storage directory
RUN mkdir -p /app/evidence_storage \
    && chown -R appuser:appuser /app

USER appuser

# Run migrations then start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]

EXPOSE 8000
