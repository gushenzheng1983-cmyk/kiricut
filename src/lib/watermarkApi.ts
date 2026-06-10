import type { WatermarkZone } from "@/lib/watermarkZones";

export async function removeWatermarkCloud(
  imageDataUrl: string,
  zone: WatermarkZone
): Promise<string> {
  const blob = await fetch(imageDataUrl).then((res) => res.blob());

  const formData = new FormData();
  formData.append("image", blob, "image.png");
  formData.append("zone", zone);

  const response = await fetch("/api/remove-watermark", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as {
    image?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "云端水印除去に失敗しました");
  }

  if (!data.image) {
    throw new Error("サーバーから画像が返されませんでした");
  }

  return data.image;
}
