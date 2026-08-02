import QRCode from "qrcode";
import { getMemberRegistrationUrl } from "@/lib/qr/registration-qr";

const QR_COLORS = {
  dark: "#4A2C17",
  light: "#FFFDF8",
} as const;

async function createRegistrationQrDataUrl(size: number): Promise<string> {
  return QRCode.toDataURL(getMemberRegistrationUrl(), {
    width: size,
    margin: 2,
    color: QR_COLORS,
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load QR image."));
    image.src = src;
  });
}

export async function createRegistrationQrCardDataUrl(
  title: string,
  qrSize: number
): Promise<string> {
  const qrDataUrl = await createRegistrationQrDataUrl(qrSize);
  const qrImage = await loadImage(qrDataUrl);

  const padding = 20;
  const titleAreaHeight = 36;
  const canvas = document.createElement("canvas");
  canvas.width = qrSize + padding * 2;
  canvas.height = qrSize + padding * 2 + titleAreaHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported.");
  }

  context.fillStyle = QR_COLORS.light;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = QR_COLORS.dark;
  context.font = "600 18px Geist, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(title, canvas.width / 2, padding + titleAreaHeight / 2);

  context.drawImage(qrImage, padding, padding + titleAreaHeight, qrSize, qrSize);

  return canvas.toDataURL("image/png");
}

export function getRegistrationQrCardDimensions(qrSize: number) {
  const padding = 20;
  const titleAreaHeight = 36;
  return {
    width: qrSize + padding * 2,
    height: qrSize + padding * 2 + titleAreaHeight,
  };
}

export function getRegistrationQrDownloadFileName(): string {
  return "member-registration-qr.png";
}
