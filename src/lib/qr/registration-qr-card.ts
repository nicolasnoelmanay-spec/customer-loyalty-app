import QRCode from "qrcode";
import { getMemberRegistrationQrTitle, getMemberRegistrationUrl } from "@/lib/qr/registration-qr";

const QR_COLORS = {
  dark: "#4A2C17",
  light: "#FFFDF8",
} as const;

const TITLE_FONT = "600 13px Geist, system-ui, sans-serif";
const TITLE_LINE_HEIGHT = 17;
const TITLE_VERTICAL_PADDING = 14;

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

function wrapTitleLines(
  context: CanvasRenderingContext2D,
  title: string,
  maxWidth: number
): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function estimateTitleLayout(title: string): { lines: string[]; titleAreaHeight: number } {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 28 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  const titleAreaHeight = Math.max(
    36,
    lines.length * TITLE_LINE_HEIGHT + TITLE_VERTICAL_PADDING
  );

  return { lines, titleAreaHeight };
}

function measureTitleLayout(title: string, qrSize: number) {
  if (typeof document === "undefined") {
    return estimateTitleLayout(title);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported.");
  }

  context.font = TITLE_FONT;
  const lines = wrapTitleLines(context, title, qrSize);
  const titleAreaHeight = Math.max(
    36,
    lines.length * TITLE_LINE_HEIGHT + TITLE_VERTICAL_PADDING
  );

  return { lines, titleAreaHeight };
}

export async function createRegistrationQrCardDataUrl(
  title: string,
  qrSize: number
): Promise<string> {
  const qrDataUrl = await createRegistrationQrDataUrl(qrSize);
  const qrImage = await loadImage(qrDataUrl);

  const padding = 20;
  const { lines, titleAreaHeight } = measureTitleLayout(title, qrSize);
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
  context.font = TITLE_FONT;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const textStartY = padding + TITLE_VERTICAL_PADDING / 2;
  lines.forEach((line, index) => {
    context.fillText(
      line,
      canvas.width / 2,
      textStartY + index * TITLE_LINE_HEIGHT + TITLE_LINE_HEIGHT / 2
    );
  });

  context.drawImage(qrImage, padding, padding + titleAreaHeight, qrSize, qrSize);

  return canvas.toDataURL("image/png");
}

export function getRegistrationQrCardDimensions(
  qrSize: number,
  title: string = getMemberRegistrationQrTitle()
) {
  const padding = 20;
  const { titleAreaHeight } = measureTitleLayout(title, qrSize);
  return {
    width: qrSize + padding * 2,
    height: qrSize + padding * 2 + titleAreaHeight,
  };
}

export function getRegistrationQrDownloadFileName(): string {
  return "member-registration-qr.png";
}
