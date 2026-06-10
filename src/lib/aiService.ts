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

/** 5xx / 503 时自动重试一次，仍失败则抛 AiServiceUnavailableError */
export async function fetchAiApi(
  url: string,
  init?: RequestInit
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, init);
      if (
        (response.status === 503 ||
          response.status === 502 ||
          response.status >= 500) &&
        attempt === 0
      ) {
        await sleep(900);
        continue;
      }
      if (response.status === 503 || response.status === 502) {
        throw new AiServiceUnavailableError();
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error instanceof AiServiceUnavailableError) throw error;
      if (attempt === 0) {
        await sleep(900);
        continue;
      }
    }
  }
  if (lastError instanceof AiServiceUnavailableError) throw lastError;
  throw new AiServiceUnavailableError();
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

/** 服务端无流式进度时，用估算进度避免界面假死 */
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
