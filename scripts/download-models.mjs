import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const LAMA_URLS = [
  "https://huggingface.co/lxfater/inpaint-web/resolve/main/models/big-lama.onnx",
  "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
  "https://hf-mirror.com/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
];

const MODEL_DIR = path.join(ROOT, "public", "models");
const MODEL_FILE = path.join(MODEL_DIR, "big-lama.onnx");
const ORT_SRC = path.join(ROOT, "node_modules", "onnxruntime-web", "dist");
const ORT_DEST = path.join(ROOT, "public", "ort");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadFile(url, dest) {
  console.log(`Downloading: ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024 * 1024) {
    throw new Error(`Download too small (${buffer.length} bytes), likely invalid`);
  }

  fs.writeFileSync(dest, buffer);
  const mb = (buffer.length / 1024 / 1024).toFixed(1);
  console.log(`Saved: ${dest} (${mb} MB)`);
}

function copyOrtWasm() {
  if (!fs.existsSync(ORT_SRC)) {
    console.warn("onnxruntime-web not found, skip WASM copy");
    return;
  }

  ensureDir(ORT_DEST);
  const files = fs
    .readdirSync(ORT_SRC)
    .filter((f) => f.endsWith(".wasm") || f.endsWith(".mjs"));
  for (const file of files) {
    fs.copyFileSync(path.join(ORT_SRC, file), path.join(ORT_DEST, file));
  }
  console.log(`Copied ${files.length} onnxruntime files to public/ort/`);
}

async function downloadModel() {
  if (fs.existsSync(MODEL_FILE)) {
    const mb = (fs.statSync(MODEL_FILE).size / 1024 / 1024).toFixed(1);
    console.log(`LaMa model already exists (${mb} MB), skip download`);
    return true;
  }

  for (const url of LAMA_URLS) {
    try {
      await downloadFile(url, MODEL_FILE);
      return true;
    } catch (error) {
      console.warn(`Failed: ${error.message}`);
    }
  }

  console.warn(
    "LaMa model download failed. Browser will retry on first use, or run: npm run setup-models"
  );
  return false;
}

async function main() {
  ensureDir(MODEL_DIR);
  copyOrtWasm();
  await downloadModel();
  console.log("Setup finished.");
}

main().catch((err) => {
  console.error("Setup error:", err.message);
  process.exit(1);
});
