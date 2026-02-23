# syntax=docker/dockerfile:1
FROM --platform=linux/amd64 colmap/colmap@sha256:519a5c199771fc01210b867f9382abc324f6c93b91bf168cbb4f78887913d197

RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages boto3>=1.34.0 numpy>=1.24.0

WORKDIR /app
COPY run.py .

CMD ["python3", "run.py"]
