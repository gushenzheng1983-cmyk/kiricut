import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const LAMA_URLS = [
  "https://hf-mirror.com/lxfater/inpaint-web/resolve/main/models/big-lama.onnx",
  "https://hf-mirror.com/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
];

const MODEL_DIR = path.join(ROOT, "public", "models");
const MODEL_FILE = path.join(MODEL_DIR, "big-lama.onnx");

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
    "LaMa model download failed. Python service will retry on first request."
  );
  return false;
}

async function main() {
  ensureDir(MODEL_DIR);
  await downloadModel();
  console.log("Setup finished.");
}

main().catch((err) => {
  console.error("Setup error:", err.message);
  process.exit(1);
});
