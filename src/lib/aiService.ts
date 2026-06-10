/** AI 推理服务不可用（Python 服务宕机 / 网络中断） */
export const AI_SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE";

export class AiServiceUnavailableError extends Error {
  constructor() {
    super(AI_SERVICE_UNAVAILABLE);
    this.name = "AiServiceUnavailableError";
  }
}

export function isAiServiceUnavailable(error: unknown): boolean {
  return (
    error instanceof AiServiceUnavailableError ||
    (error instanceof Error && error.message === AI_SERVICE_UNAVAILABLE)
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 带 body 的 POST 不能重试（FormData 只能读一次） */
export async function fetchAiApi(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const hasBody = init?.body != null;
  const maxAttempts = hasBody ? 1 : 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (
        (response.status === 503 ||
          response.status === 502 ||
          response.status >= 500) &&
        attempt < maxAttempts - 1
      ) {
        await sleep(900);
        continue;
      }
      if (response.status === 503 || response.status === 502) {
        throw new AiServiceUnavailableError();
      }
      if (response.status === 413) {
        throw new Error(
          "图片过大被服务器拒绝，请换较小图片或稍后重试"
        );
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error instanceof AiServiceUnavailableError) throw error;
      if (attempt < maxAttempts - 1) {
        await sleep(900);
        continue;
      }
    }
  }
  if (lastError instanceof AiServiceUnavailableError) throw lastError;
  throw new AiServiceUnavailableError();
}

export type AiImageJson = {
  image?: string;
  error?: string;
  bytes?: number;
};

/** 解析 API 返回的 base64 图片 JSON，避免二进制 blob 在代理层丢包 */
export async function parseAiImageResponse(
  response: Response
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      response.status === 413
        ? "图片过大被服务器拒绝，请换较小图片或稍后重试"
        : `AI 服务返回异常（HTTP ${response.status}）`
    );
  }
  const data = (await response.json()) as AiImageJson;
  if (!response.ok) {
    throw new Error(data.error ?? "AI 服务返回错误");
  }
  if (!data.image?.startsWith("data:image")) {
    throw new Error(
      data.error ?? `AI 返回无效图片（${data.bytes ?? 0} bytes）`
    );
  }
  return data.image;
}

export type AiHealthStatus = {
  ok: boolean;
  model_loaded?: boolean;
  bg_model_loaded?: boolean;
  error?: string;
};

export async function checkAiServiceHealth(): Promise<AiHealthStatus> {
  try {
    const response = await fetch("/api/inpaint/health", { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, error: "health_check_failed" };
    }
    return (await response.json()) as AiHealthStatus;
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export function startEstimatedProgress(
  onProgress: ((percent: number) => void) | undefined,
  from: number,
  to: number,
  durationMs: number
): () => void {
  if (!onProgress) return () => {};
  const start = Date.now();
  onProgress(from);
  const timer = setInterval(() => {
    const t = Math.min(1, (Date.now() - start) / durationMs);
    onProgress(Math.round(from + (to - from) * t));
  }, 280);
  return () => clearInterval(timer);
}
