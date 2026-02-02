FROM python:3.11-slim

RUN pip install --no-cache-dir pycolmap>=3.10.0 boto3>=1.34.0 numpy>=1.24.0

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
