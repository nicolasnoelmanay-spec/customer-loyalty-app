function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

export function canShareQrImage(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") {
    return false;
  }

  try {
    const file = new File([new Blob(["x"], { type: "image/png" })], "qr.png", {
      type: "image/png",
    });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function openQrImageForSave(blobUrl: string): void {
  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(blobUrl);
  }
}

function triggerBlobDownload(blobUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadQrImage(
  dataUrl: string,
  fileName: string
): Promise<void> {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], fileName, { type: blob.type || "image/png" });

  if (typeof navigator.share === "function" && canShareQrImage()) {
    try {
      await navigator.share({
        files: [file],
        title: "Loyalty QR Code",
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
    }
  }

  const blobUrl = URL.createObjectURL(blob);

  try {
    if (isIosDevice()) {
      openQrImageForSave(blobUrl);
      return;
    }

    triggerBlobDownload(blobUrl, fileName);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}

export function getQrDownloadButtonLabel(): string {
  return canShareQrImage() ? "Save or Share QR Code" : "Download QR Code";
}

export function getQrDownloadHint(): string | null {
  if (canShareQrImage()) {
    return "Choose Save Image from the share menu on your phone.";
  }

  if (isIosDevice()) {
    return "Opens the QR image. Press and hold it, then choose Save Image.";
  }

  return null;
}
