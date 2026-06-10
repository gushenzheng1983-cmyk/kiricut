import JSZip from "jszip";

export async function downloadImagesAsZip(
  items: { fileName: string; dataUrl: string }[],
  zipName = `kiricut-batch-${Date.now()}.zip`
): Promise<void> {
  const zip = new JSZip();

  for (let i = 0; i < items.length; i++) {
    const { fileName, dataUrl } = items[i];
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const baseName = fileName.replace(/\.[^.]+$/, "") || `image-${i + 1}`;
    zip.file(`${baseName}-processed.png`, blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipName;
  link.click();
  URL.revokeObjectURL(url);
}
