FROM nvcr.io/nvidia/pytorch:24.01-py3

RUN apt-get update && apt-get install -y git cmake ninja-build && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone https://github.com/graphdeco-inria/gaussian-splatting.git --recursive

WORKDIR /opt/gaussian-splatting
RUN pip install -r requirements.txt
RUN pip install submodules/diff-gaussian-rasterization submodules/simple-knn
RUN pip install boto3>=1.34.0

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
