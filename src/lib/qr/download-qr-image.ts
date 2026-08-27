function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime || "image/png" });
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Macintosh but is touch-capable.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
  );
}

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isMobileShareDevice(): boolean {
  return isIosDevice() || isAndroidDevice();
}

type NativeQrBridge = {
  saveQrImage: (dataUrl: string, fileName: string) => void;
};

/** Injected by Coffeesentials Android WebView shells. */
function getNativeQrBridge(): NativeQrBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (
    window as unknown as { CoffeesentialsApp?: NativeQrBridge }
  ).CoffeesentialsApp;
  if (!bridge || typeof bridge.saveQrImage !== "function") return null;
  return bridge;
}

function createQrFile(dataUrl: string, fileName: string): File {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], fileName, {
    type: blob.type || "image/png",
    lastModified: Date.now(),
  });
}

/**
 * True when this device should use the native share sheet for QR images.
 * Desktop browsers often report canShare(files) but have no useful share
 * targets — keep those on a plain download path.
 * Android WebView apps use a native bridge instead (share is unreliable there).
 */
export function canShareQrImage(): boolean {
  if (typeof navigator === "undefined") return false;
  if (getNativeQrBridge()) return false;
  if (!isMobileShareDevice()) return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;

  try {
    const probe = new File([new Uint8Array([137, 80, 78, 71])], "qr.png", {
      type: "image/png",
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function triggerDataUrlDownload(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openQrImageForSave(dataUrl: string): void {
  // Prefer data: URLs over blob: — blob tabs are often blank/blocked on iOS
  // after an async share attempt, and get revoked too early.
  const opened = window.open(dataUrl, "_blank");
  if (!opened) {
    // Popup blocked (common in Android WebView): show the image in this tab
    // so the user can long-press → Save image / Share.
    window.location.assign(dataUrl);
  }
}

function fallbackSaveQrImage(dataUrl: string, fileName: string): void {
  // Android Chrome and WebView usually ignore <a download> for data: URLs.
  // iOS also ignores download — open the image for long-press save.
  if (isAndroidDevice() || isIosDevice()) {
    if (isAndroidDevice()) {
      // Best-effort: some WebViews fire a download listener for this click.
      triggerDataUrlDownload(dataUrl, fileName);
    }
    openQrImageForSave(dataUrl);
    return;
  }

  triggerDataUrlDownload(dataUrl, fileName);
}

export async function downloadQrImage(
  dataUrl: string,
  fileName: string
): Promise<void> {
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("QR image is not ready yet.");
  }

  const nativeBridge = getNativeQrBridge();
  if (nativeBridge) {
    nativeBridge.saveQrImage(dataUrl, fileName);
    return;
  }

  if (canShareQrImage()) {
    const file = createQrFile(dataUrl, fileName);

    try {
      // Share must be the first await after the click to keep the user gesture.
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (error) {
      // User dismissed the sheet — do not force a download.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // NotAllowedError / TypeError / etc. → fall through to download.
    }
  }

  fallbackSaveQrImage(dataUrl, fileName);
}

export function getQrDownloadButtonLabel(): string {
  if (getNativeQrBridge()) return "Download QR Code";
  return canShareQrImage() ? "Save or Share QR Code" : "Download QR Code";
}

export function getQrDownloadHint(): string | null {
  if (getNativeQrBridge()) {
    return "Saves the QR code to your Pictures folder.";
  }

  if (canShareQrImage()) {
    return "Choose Save Image (or Photos) from the share menu.";
  }

  if (isIosDevice() || isAndroidDevice()) {
    return "Opens the QR image. Press and hold it, then choose Save image.";
  }

  return null;
}
