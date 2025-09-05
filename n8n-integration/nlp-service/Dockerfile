FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY nlp_service.py .

EXPOSE 8080

CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 nlp_service:app