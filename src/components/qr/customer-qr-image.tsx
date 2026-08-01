"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import QRCode from "qrcode";
import { buildCustomerQrPayload } from "@/lib/qr/customer-qr";
import { Button } from "@/components/ui/button";

interface CustomerQrImageProps {
  customerId: string;
  customerName: string;
  size?: number;
  showDownload?: boolean;
  downloadFileName?: string;
}

function defaultDownloadFileName(customerId: string, customerName: string) {
  const safeName = customerName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return safeName ? `${safeName}-${customerId}-qr.png` : `${customerId}-qr.png`;
}

async function createCustomerQrDataUrl(customerId: string, size: number) {
  return QRCode.toDataURL(buildCustomerQrPayload(customerId), {
    width: size,
    margin: 2,
    color: {
      dark: "#4A2C17",
      light: "#FFFDF8",
    },
  });
}

export function CustomerQrImage({
  customerId,
  customerName,
  size = 200,
  showDownload = false,
  downloadFileName,
}: CustomerQrImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    createCustomerQrDataUrl(customerId, size)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, size]);

  const fileName =
    downloadFileName ?? defaultDownloadFileName(customerId, customerName);

  if (!dataUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground"
          style={{ width: size, height: size }}
        >
          Loading QR…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL */}
      <img
        src={dataUrl}
        alt={`QR code for ${customerName}`}
        className="rounded-xl border bg-white p-3 shadow-sm"
        width={size}
        height={size}
      />
      {showDownload && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = fileName;
            link.click();
          }}
        >
          <Download className="size-4" />
          Download QR Code
        </Button>
      )}
    </div>
  );
}

export async function downloadCustomerQrCode(
  customerId: string,
  customerName: string,
  size = 280,
  downloadFileName?: string
) {
  const dataUrl = await createCustomerQrDataUrl(customerId, size);
  const fileName =
    downloadFileName ?? defaultDownloadFileName(customerId, customerName);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
