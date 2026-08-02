import QRCode from "qrcode";
import { buildCustomerQrPayload } from "@/lib/qr/customer-qr";

const QR_COLORS = {
  dark: "#4A2C17",
  light: "#FFFDF8",
} as const;

async function createQrDataUrl(customerId: string, size: number): Promise<string> {
  return QRCode.toDataURL(buildCustomerQrPayload(customerId), {
    width: size,
    margin: 2,
    color: QR_COLORS,
  });
}

function truncateName(name: string, maxLength = 28): string {
  const trimmed = name.trim() || "Member";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load QR image."));
    image.src = src;
  });
}

export async function createCustomerQrCardDataUrl(
  customerId: string,
  customerName: string,
  qrSize: number
): Promise<string> {
  const qrDataUrl = await createQrDataUrl(customerId, qrSize);
  const qrImage = await loadImage(qrDataUrl);

  const padding = 20;
  const nameAreaHeight = 36;
  const canvas = document.createElement("canvas");
  canvas.width = qrSize + padding * 2;
  canvas.height = qrSize + padding * 2 + nameAreaHeight;

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
  context.fillText(
    truncateName(customerName),
    canvas.width / 2,
    padding + nameAreaHeight / 2
  );

  context.drawImage(qrImage, padding, padding + nameAreaHeight, qrSize, qrSize);

  return canvas.toDataURL("image/png");
}

export function getCustomerQrCardDimensions(qrSize: number) {
  const padding = 20;
  const nameAreaHeight = 36;
  return {
    width: qrSize + padding * 2,
    height: qrSize + padding * 2 + nameAreaHeight,
  };
}
