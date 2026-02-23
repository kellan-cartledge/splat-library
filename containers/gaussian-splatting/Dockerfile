# syntax=docker/dockerfile:1
FROM --platform=linux/amd64 nvcr.io/nvidia/pytorch:24.12-py3

# open3d (used by ns-export) needs X11 libs in headless environment
RUN apt-get update && apt-get install -y --no-install-recommends libx11-6 libgl1 && rm -rf /var/lib/apt/lists/*

# fpsample>=0.4 has pybind11 compat issue; pin to 0.3.x
RUN pip install 'fpsample<0.4' && pip install nerfstudio boto3

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
