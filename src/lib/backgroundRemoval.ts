let bgPreloadPromise: Promise<void> | null = null;
let bgModelReady = false;

export async function preloadBackgroundModel(
  onProgress?: (percent: number) => void
): Promise<void> {
  if (bgModelReady) {
    onProgress?.(100);
    return;
  }

  if (!bgPreloadPromise) {
    bgPreloadPromise = (async () => {
      onProgress?.(10);
      const { preload } = await import("@imgly/background-removal");
      onProgress?.(30);
      await preload();
      bgModelReady = true;
      onProgress?.(100);
    })();
  }

  await bgPreloadPromise;
}

export function isBackgroundModelReady(): boolean {
  return bgModelReady;
}

export async function removeImageBackground(
  imageSource: string | Blob | HTMLImageElement
): Promise<string> {
  await preloadBackgroundModel();
  const { removeBackground } = await import("@imgly/background-removal");

  let input: string | Blob = imageSource as string | Blob;

  if (imageSource instanceof HTMLImageElement) {
    const canvas = document.createElement("canvas");
    canvas.width = imageSource.naturalWidth;
    canvas.height = imageSource.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context を取得できません");
    ctx.drawImage(imageSource, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("画像の変換に失敗しました"));
      }, "image/png");
    });
    input = blob;
  }

  const resultBlob = await removeBackground(input, {
    output: {
      format: "image/png",
      quality: 1,
    },
  });

  return URL.createObjectURL(resultBlob);
}
