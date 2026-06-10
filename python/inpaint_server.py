"""
KiriCut LaMa inpaint API — Python + ONNX Runtime (CPU).
Browser uploads image + mask; server returns upscaled inpaint overlay PNG.
"""

from __future__ import annotations

import io
import os
import threading
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image

MODEL_SIZE = 512

MODEL_URLS = [
    "https://hf-mirror.com/lxfater/inpaint-web/resolve/main/models/big-lama.onnx",
    "https://hf-mirror.com/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
]

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = ROOT / "public" / "models" / "big-lama.onnx"

_session: ort.InferenceSession | None = None
_session_lock = threading.Lock()


def _resolve_model_path() -> Path:
    env_path = os.environ.get("LAMA_MODEL_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_MODEL_PATH


def _download_model(dest: Path) -> None:
    import urllib.request

    dest.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None
    for url in MODEL_URLS:
        try:
            print(f"Downloading LaMa model: {url}")
            urllib.request.urlretrieve(url, dest)
            if dest.stat().st_size < 1024 * 1024:
                raise RuntimeError(f"Download too small: {dest.stat().st_size} bytes")
            print(f"Model saved: {dest} ({dest.stat().st_size / 1024 / 1024:.1f} MB)")
            return
        except Exception as exc:
            last_error = exc
            print(f"Download failed: {exc}")
    raise RuntimeError(f"LaMa model download failed: {last_error}")


def _ensure_model() -> Path:
    model_path = _resolve_model_path()
    if not model_path.is_file():
        _download_model(model_path)
    return model_path


def _resolve_input_names(names: list[str]) -> tuple[str, str]:
    image_name = next(
        (n for n in names if "image" in n.lower()),
        names[0],
    )
    mask_name = next(
        (n for n in names if "mask" in n.lower()),
        next((n for n in names if n != image_name), names[1]),
    )
    return image_name, mask_name


def _image_to_chw_float32(rgb: np.ndarray) -> np.ndarray:
    """rgb: HxWx3 uint8 -> 3xHxW float32 [0,1]"""
    arr = rgb.astype(np.float32) / 255.0
    return np.transpose(arr, (2, 0, 1))


def _mask_to_chw_float32(mask: np.ndarray) -> np.ndarray:
    """mask: HxW uint8 -> 1xHxW float32 {0,1}"""
    binary = (mask > 127).astype(np.float32)
    return binary[np.newaxis, ...]


def _chw_float32_to_rgb(data: np.ndarray, size: int) -> np.ndarray:
    """CHW float32 -> HxWx3 uint8"""
    max_val = float(np.max(data[: min(500, data.size)]))
    scale = max_val <= 1.5
    chw = data.reshape(3, size, size)
    if scale:
        rgb = (np.transpose(chw, (1, 2, 0)) * 255.0).clip(0, 255)
    else:
        rgb = np.transpose(chw, (1, 2, 0)).clip(0, 255)
    return rgb.astype(np.uint8)


def _get_session() -> ort.InferenceSession:
    global _session
    if _session is not None:
        return _session
    with _session_lock:
        if _session is not None:
            return _session
        model_path = _ensure_model()
        print(f"Loading ONNX session: {model_path}")
        _session = ort.InferenceSession(
            str(model_path),
            providers=["CPUExecutionProvider"],
        )
        print(f"Session ready. inputs={_session.get_inputs()}")
        return _session


def _run_inference(image_rgb: np.ndarray, mask_gray: np.ndarray) -> np.ndarray:
    session = _get_session()
    image_name, mask_name = _resolve_input_names(
        [inp.name for inp in session.get_inputs()]
    )

    image_tensor = _image_to_chw_float32(image_rgb)[np.newaxis, ...].astype(
        np.float32
    )
    mask_tensor = _mask_to_chw_float32(mask_gray)[np.newaxis, ...].astype(np.float32)

    feeds = {image_name: image_tensor, mask_name: mask_tensor}
    outputs = session.run(None, feeds)
    output_data = outputs[0].astype(np.float32).flatten()
    return _chw_float32_to_rgb(output_data, MODEL_SIZE)


def inpaint_image(image_bytes: bytes, mask_bytes: bytes) -> bytes:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    mask = Image.open(io.BytesIO(mask_bytes)).convert("L")
    width, height = image.size

    image_512 = image.resize((MODEL_SIZE, MODEL_SIZE), Image.Resampling.LANCZOS)
    mask_512 = mask.resize((MODEL_SIZE, MODEL_SIZE), Image.Resampling.NEAREST)
    image_rgb = np.array(image_512, dtype=np.uint8)
    mask_gray = np.array(mask_512, dtype=np.uint8)
    mask_gray = np.where(mask_gray > 127, 255, 0).astype(np.uint8)

    if int(np.sum(mask_gray > 127)) < 16:
        raise ValueError("蒙版区域过小，请调整红框")

    output_rgb = _run_inference(image_rgb, mask_gray)
    output_img = Image.fromarray(output_rgb, mode="RGB")
    output_full = output_img.resize((width, height), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    output_full.save(buf, format="PNG")
    return buf.getvalue()


app = FastAPI(title="KiriCut Inpaint API", version="1.0.0")


@app.on_event("startup")
def warmup():
    try:
        _get_session()
        print("LaMa model warmed up.")
    except Exception as exc:
        print(f"Warmup failed (will retry on first request): {exc}")


@app.get("/health")
def health():
    loaded = _session is not None
    return {"ok": True, "model_loaded": loaded}


@app.post("/inpaint")
async def inpaint(
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
):
    try:
        image_bytes = await image.read()
        mask_bytes = await mask.read()
        if not image_bytes or not mask_bytes:
            raise HTTPException(status_code=400, detail="image 和 mask 不能为空")
        result = inpaint_image(image_bytes, mask_bytes)
        return Response(content=result, media_type="image/png")
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Inpaint error: {exc}")
        raise HTTPException(status_code=500, detail=f"AI 修图失败: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("INPAINT_HOST", "127.0.0.1")
    port = int(os.environ.get("INPAINT_PORT", "8765"))
    uvicorn.run("inpaint_server:app", host=host, port=port, reload=False)
