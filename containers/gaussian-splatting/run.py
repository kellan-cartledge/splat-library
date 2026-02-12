"""3D Gaussian Splatting training using gsplat library."""
import os
import sys
import json
import boto3
import torch
import torch.nn.functional as F
import numpy as np
from pathlib import Path
from PIL import Image
from plyfile import PlyData, PlyElement

s3 = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-west-2'))
sfn = boto3.client('stepfunctions', region_name=os.environ.get('AWS_REGION', 'us-west-2'))
dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-west-2'))

BUCKET = os.environ['BUCKET']
SCENE_ID = os.environ['SCENE_ID']
ITERATIONS = int(os.environ.get('ITERATIONS', '30000'))
DENSIFY_UNTIL = int(os.environ.get('DENSIFY_UNTIL_ITER', '15000'))
DENSIFY_INTERVAL = int(os.environ.get('DENSIFICATION_INTERVAL', '100'))
SCENES_TABLE = os.environ.get('SCENES_TABLE')
TASK_TOKEN = os.environ.get('SFN_TASK_TOKEN')


def update_processing_stage(stage: str):
    if SCENES_TABLE:
        table = dynamodb.Table(SCENES_TABLE)
        table.update_item(
            Key={'id': SCENE_ID},
            UpdateExpression='SET processingStage = :stage',
            ExpressionAttributeValues={':stage': stage}
        )


def send_success(output: dict):
    if TASK_TOKEN:
        sfn.send_task_success(taskToken=TASK_TOKEN, output=json.dumps(output))


def send_failure(error: str, stage: str = 'training'):
    update_processing_stage('failed')
    if SCENES_TABLE:
        table = dynamodb.Table(SCENES_TABLE)
        table.update_item(
            Key={'id': SCENE_ID},
            UpdateExpression='SET #e = :error',
            ExpressionAttributeNames={'#e': 'error'},
            ExpressionAttributeValues={':error': f'gsplat failed at {stage}: {error}'}
        )
    if TASK_TOKEN:
        sfn.send_task_failure(taskToken=TASK_TOKEN, error='TrainingError', cause=error)


def read_colmap_binary(path):
    """Read COLMAP binary files."""
    import struct
    
    cameras = {}
    cameras_path = path / 'sparse' / '0' / 'cameras.bin'
    with open(cameras_path, 'rb') as f:
        num_cameras = struct.unpack('<Q', f.read(8))[0]
        for _ in range(num_cameras):
            camera_id = struct.unpack('<I', f.read(4))[0]
            model_id = struct.unpack('<i', f.read(4))[0]
            width = struct.unpack('<Q', f.read(8))[0]
            height = struct.unpack('<Q', f.read(8))[0]
            num_params = 3 if model_id == 0 else 4
            params = struct.unpack(f'<{num_params}d', f.read(8 * num_params))
            cameras[camera_id] = {'width': width, 'height': height, 'params': params, 'model': model_id}
    
    images = {}
    images_path = path / 'sparse' / '0' / 'images.bin'
    with open(images_path, 'rb') as f:
        num_images = struct.unpack('<Q', f.read(8))[0]
        for _ in range(num_images):
            image_id = struct.unpack('<I', f.read(4))[0]
            qw, qx, qy, qz = struct.unpack('<4d', f.read(32))
            tx, ty, tz = struct.unpack('<3d', f.read(24))
            camera_id = struct.unpack('<I', f.read(4))[0]
            name = b''
            while True:
                c = f.read(1)
                if c == b'\x00':
                    break
                name += c
            num_points2D = struct.unpack('<Q', f.read(8))[0]
            f.read(24 * num_points2D)
            images[image_id] = {'qvec': [qw, qx, qy, qz], 'tvec': [tx, ty, tz], 'camera_id': camera_id, 'name': name.decode('utf-8')}
    
    points, colors = [], []
    points_path = path / 'sparse' / '0' / 'points3D.bin'
    with open(points_path, 'rb') as f:
        num_points = struct.unpack('<Q', f.read(8))[0]
        for _ in range(num_points):
            struct.unpack('<Q', f.read(8))[0]
            xyz = struct.unpack('<3d', f.read(24))
            rgb = struct.unpack('<3B', f.read(3))
            struct.unpack('<d', f.read(8))[0]
            track_len = struct.unpack('<Q', f.read(8))[0]
            f.read(8 * track_len)
            points.append(xyz)
            colors.append(rgb)
    
    return cameras, images, np.array(points), np.array(colors)


def qvec_to_rotmat(qvec):
    qw, qx, qy, qz = qvec
    return np.array([
        [1 - 2*qy*qy - 2*qz*qz, 2*qx*qy - 2*qz*qw, 2*qx*qz + 2*qy*qw],
        [2*qx*qy + 2*qz*qw, 1 - 2*qx*qx - 2*qz*qz, 2*qy*qz - 2*qx*qw],
        [2*qx*qz - 2*qy*qw, 2*qy*qz + 2*qx*qw, 1 - 2*qx*qx - 2*qy*qy]
    ])


def export_ply(path: str, means, scales, quats, opacities, sh0, shN):
    means = means.detach().cpu().numpy()
    scales = scales.detach().cpu().numpy()
    quats = quats.detach().cpu().numpy()
    opacities = opacities.detach().cpu().numpy()
    sh0 = sh0.detach().cpu().numpy()
    shN = shN.detach().cpu().numpy()
    
    quats = quats / np.linalg.norm(quats, axis=-1, keepdims=True)
    n = means.shape[0]
    
    attrs = [('x', 'f4'), ('y', 'f4'), ('z', 'f4'), ('nx', 'f4'), ('ny', 'f4'), ('nz', 'f4'),
             ('f_dc_0', 'f4'), ('f_dc_1', 'f4'), ('f_dc_2', 'f4')]
    for i in range(shN.shape[1] * 3):
        attrs.append((f'f_rest_{i}', 'f4'))
    attrs.extend([('opacity', 'f4'), ('scale_0', 'f4'), ('scale_1', 'f4'), ('scale_2', 'f4'),
                  ('rot_0', 'f4'), ('rot_1', 'f4'), ('rot_2', 'f4'), ('rot_3', 'f4')])
    
    elements = np.empty(n, dtype=np.dtype(attrs))
    elements['x'], elements['y'], elements['z'] = means[:, 0], means[:, 1], means[:, 2]
    elements['nx'] = elements['ny'] = elements['nz'] = 0
    elements['f_dc_0'], elements['f_dc_1'], elements['f_dc_2'] = sh0[:, 0, 0], sh0[:, 0, 1], sh0[:, 0, 2]
    sh_rest = shN.reshape(n, -1)
    for i in range(sh_rest.shape[1]):
        elements[f'f_rest_{i}'] = sh_rest[:, i]
    elements['opacity'] = opacities
    elements['scale_0'], elements['scale_1'], elements['scale_2'] = scales[:, 0], scales[:, 1], scales[:, 2]
    elements['rot_0'], elements['rot_1'], elements['rot_2'], elements['rot_3'] = quats[:, 0], quats[:, 1], quats[:, 2], quats[:, 3]
    
    PlyData([PlyElement.describe(elements, 'vertex')]).write(path)


def train_gsplat(input_dir: Path, output_dir: Path):
    from gsplat.rendering import rasterization
    from gsplat.strategy import DefaultStrategy
    
    device = "cuda"
    
    print("Loading COLMAP data...")
    cameras, images, points3D, colors3D = read_colmap_binary(input_dir)
    
    image_dir = input_dir / 'images'
    train_data = []
    
    for img_id, img_info in images.items():
        cam = cameras[img_info['camera_id']]
        R = qvec_to_rotmat(img_info['qvec'])
        t = np.array(img_info['tvec'])
        c2w = np.eye(4)
        c2w[:3, :3] = R.T
        c2w[:3, 3] = -R.T @ t
        
        params = cam['params']
        fx = fy = params[0] if cam['model'] == 0 else params[0]
        if cam['model'] != 0:
            fy = params[1]
        cx, cy = params[1], params[2] if cam['model'] == 0 else (params[2], params[3])
        K = np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]])
        
        img_path = image_dir / img_info['name']
        if img_path.exists():
            img = np.array(Image.open(img_path)) / 255.0
            train_data.append({'c2w': c2w.astype(np.float32), 'K': K.astype(np.float32), 
                              'image': img.astype(np.float32), 'width': cam['width'], 'height': cam['height']})
    
    print(f"Loaded {len(train_data)} images, {len(points3D)} points")
    
    # Normalize scene
    pts_mean = points3D.mean(axis=0)
    pts_centered = points3D - pts_mean
    scale = np.linalg.norm(pts_centered, axis=1).max()
    points3D = (points3D - pts_mean) / scale
    for d in train_data:
        d['c2w'][:3, 3] = (d['c2w'][:3, 3] - pts_mean) / scale
    
    # Initialize gaussians
    points = torch.from_numpy(points3D).float().to(device)
    rgbs = torch.from_numpy(colors3D / 255.0).float().to(device)
    
    dists = torch.cdist(points, points)
    dists.fill_diagonal_(float('inf'))
    knn_dists = dists.topk(3, largest=False).values
    dist_avg = knn_dists.mean(dim=-1)
    scales = torch.log(dist_avg.clamp(min=1e-6)).unsqueeze(-1).repeat(1, 3)
    
    N = points.shape[0]
    quats = F.normalize(torch.rand((N, 4), device=device), dim=-1)
    opacities = torch.logit(torch.full((N,), 0.1, device=device))
    
    sh_degree = 3
    sh0 = ((rgbs - 0.5) / 0.28209479177387814).unsqueeze(1)
    shN = torch.zeros((N, (sh_degree + 1) ** 2 - 1, 3), device=device)
    
    splats = {
        'means': torch.nn.Parameter(points),
        'scales': torch.nn.Parameter(scales),
        'quats': torch.nn.Parameter(quats),
        'opacities': torch.nn.Parameter(opacities),
        'sh0': torch.nn.Parameter(sh0),
        'shN': torch.nn.Parameter(shN),
    }
    
    optimizers = {
        'means': torch.optim.Adam([splats['means']], lr=1.6e-4, eps=1e-15),
        'scales': torch.optim.Adam([splats['scales']], lr=5e-3, eps=1e-15),
        'quats': torch.optim.Adam([splats['quats']], lr=1e-3, eps=1e-15),
        'opacities': torch.optim.Adam([splats['opacities']], lr=5e-2, eps=1e-15),
        'sh0': torch.optim.Adam([splats['sh0']], lr=2.5e-3, eps=1e-15),
        'shN': torch.optim.Adam([splats['shN']], lr=2.5e-3 / 20, eps=1e-15),
    }
    
    scheduler = torch.optim.lr_scheduler.ExponentialLR(optimizers['means'], gamma=0.01 ** (1.0 / ITERATIONS))
    strategy = DefaultStrategy(refine_start_iter=500, refine_stop_iter=DENSIFY_UNTIL, refine_every=DENSIFY_INTERVAL, verbose=False)
    strategy_state = strategy.initialize_state(scene_scale=1.0)
    
    print(f"Starting training: {ITERATIONS} iterations, {N} initial gaussians")
    
    for step in range(ITERATIONS):
        data = train_data[step % len(train_data)]
        c2w = torch.from_numpy(data['c2w']).to(device)[None]
        K = torch.from_numpy(data['K']).to(device)[None]
        pixels = torch.from_numpy(data['image']).to(device)[None]
        height, width = int(data['height']), int(data['width'])
        
        sh_degree_to_use = min(step // 1000, sh_degree)
        colors_sh = torch.cat([splats['sh0'], splats['shN']], 1)
        
        renders, alphas, info = rasterization(
            means=splats['means'], quats=F.normalize(splats['quats'], dim=-1),
            scales=torch.exp(splats['scales']), opacities=torch.sigmoid(splats['opacities']),
            colors=colors_sh, viewmats=torch.linalg.inv(c2w), Ks=K,
            width=width, height=height, sh_degree=sh_degree_to_use,
        )
        
        loss = F.l1_loss(renders.clamp(0, 1), pixels)
        strategy.step_pre_backward(params=splats, optimizers=optimizers, state=strategy_state, step=step, info=info)
        loss.backward()
        
        for opt in optimizers.values():
            opt.step()
            opt.zero_grad(set_to_none=True)
        scheduler.step()
        strategy.step_post_backward(params=splats, optimizers=optimizers, state=strategy_state, step=step, info=info, packed=False)
        
        if step % 2000 == 0:
            print(f"Step {step}/{ITERATIONS}, Loss: {loss.item():.4f}, Gaussians: {len(splats['means'])}")
    
    print(f"Training complete. Final gaussians: {len(splats['means'])}")
    
    ply_dir = output_dir / 'point_cloud' / f'iteration_{ITERATIONS}'
    ply_dir.mkdir(parents=True, exist_ok=True)
    export_ply(str(ply_dir / 'point_cloud.ply'), splats['means'], splats['scales'], splats['quats'], splats['opacities'], splats['sh0'], splats['shN'])
    print(f"Saved PLY to {ply_dir / 'point_cloud.ply'}")


def main():
    update_processing_stage('training_3dgs')
    
    work_dir = Path(f'/tmp/{SCENE_ID}')
    input_dir = work_dir / 'input'
    output_dir = work_dir / 'output'
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        print(f"Downloading COLMAP output for scene {SCENE_ID}...")
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f'colmap/{SCENE_ID}/'):
            for obj in page.get('Contents', []):
                key = obj['Key']
                relative_path = key.replace(f'colmap/{SCENE_ID}/', '')
                local_path = input_dir / relative_path
                local_path.parent.mkdir(parents=True, exist_ok=True)
                s3.download_file(BUCKET, key, str(local_path))
        
        print(f"Starting gsplat training: {ITERATIONS} iterations, densify until {DENSIFY_UNTIL}, interval {DENSIFY_INTERVAL}")
        train_gsplat(input_dir, output_dir)
        
        print("Uploading gsplat output...")
        for file_path in output_dir.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(output_dir)
                s3.upload_file(str(file_path), BUCKET, f'outputs/{SCENE_ID}/{relative_path}')
        
        send_success({'sceneId': SCENE_ID, 'iterations': ITERATIONS, 'status': 'training_complete'})
        
    except Exception as e:
        import traceback
        print(f"gsplat failed: {e}", file=sys.stderr)
        traceback.print_exc()
        send_failure(str(e), 'training')
        sys.exit(1)


if __name__ == '__main__':
    main()
