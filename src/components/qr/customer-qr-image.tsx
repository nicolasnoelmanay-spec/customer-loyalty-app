"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import QRCode from "qrcode";
import { buildCustomerQrPayload } from "@/lib/qr/customer-qr";
import {
  downloadQrImage,
  getQrDownloadButtonLabel,
  getQrDownloadHint,
} from "@/lib/qr/download-qr-image";
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloadLabel, setDownloadLabel] = useState("Download QR Code");
  const [downloadHint, setDownloadHint] = useState<string | null>(null);

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

  useEffect(() => {
    setDownloadLabel(getQrDownloadButtonLabel());
    setDownloadHint(getQrDownloadHint());
  }, []);

  const fileName =
    downloadFileName ?? defaultDownloadFileName(customerId, customerName);

  async function handleDownload() {
    if (!dataUrl || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await downloadQrImage(dataUrl, fileName);
    } catch {
      setSaveError("Could not save the QR code. Try again or screenshot the code.");
    } finally {
      setIsSaving(false);
    }
  }

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
    <div className="flex w-full max-w-full flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL */}
      <img
        src={dataUrl}
        alt={`QR code for ${customerName}`}
        className="max-w-full rounded-xl border bg-white p-3 shadow-sm"
        width={size}
        height={size}
      />
      {showDownload && (
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 w-full sm:w-auto"
            disabled={isSaving}
            onClick={() => void handleDownload()}
          >
            <Download className="size-4" />
            {isSaving ? "Saving..." : downloadLabel}
          </Button>
          {downloadHint && !saveError && (
            <p className="text-center text-xs text-muted-foreground">{downloadHint}</p>
          )}
          {saveError && (
            <p className="text-center text-xs text-destructive">{saveError}</p>
          )}
        </div>
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
  await downloadQrImage(dataUrl, fileName);
}
