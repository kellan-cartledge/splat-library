# syntax=docker/dockerfile:1
FROM --platform=linux/amd64 nvcr.io/nvidia/pytorch:24.12-py3

# Install dependencies
RUN pip install ninja numpy jaxtyping rich boto3 plyfile tqdm pillow

# Build gsplat from source (compiles CUDA kernels for this exact environment)
RUN pip install git+https://github.com/nerfstudio-project/gsplat.git@v1.5.3

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
