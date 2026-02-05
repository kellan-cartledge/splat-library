FROM colmap/colmap:latest

RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages boto3>=1.34.0 numpy>=1.24.0

WORKDIR /app
COPY run.py .

CMD ["python3", "run.py"]
