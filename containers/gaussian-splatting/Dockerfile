# syntax=docker/dockerfile:1
FROM --platform=linux/amd64 nvcr.io/nvidia/pytorch:24.01-py3

# Install dependencies
RUN pip install ninja numpy jaxtyping rich boto3 plyfile tqdm pillow

# Install pre-built gsplat wheel for PyTorch 2.4 + CUDA 12.1 (compatible with 24.01 container)
RUN pip install https://github.com/nerfstudio-project/gsplat/releases/download/v1.5.3/gsplat-1.5.3+pt24cu121-cp310-cp310-linux_x86_64.whl

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
