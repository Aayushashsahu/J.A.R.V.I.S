#!/bin/sh
echo "Waiting for PostgreSQL and running migrations..."
until alembic upgrade head; do
  echo 'Database not ready or migration failed, retrying in 2s...'
  sleep 2
done
echo 'Migrations completed, starting J.A.R.V.I.S...'
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
