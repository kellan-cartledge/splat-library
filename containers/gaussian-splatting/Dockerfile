# syntax=docker/dockerfile:1
FROM --platform=linux/amd64 nvcr.io/nvidia/pytorch:24.12-py3

# fpsample>=0.4 has pybind11 compat issue; pin to 0.3.x
RUN pip install 'fpsample<0.4' && pip install nerfstudio boto3

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
