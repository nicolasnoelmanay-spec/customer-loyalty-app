"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { loyaltyConfig } from "@/config/loyalty";
import {
  createRegistrationQrCardDataUrl,
  getRegistrationQrCardDimensions,
  getRegistrationQrDownloadFileName,
} from "@/lib/qr/registration-qr-card";
import { getMemberRegistrationQrTitle } from "@/lib/qr/registration-qr";
import {
  downloadQrImage,
  getQrDownloadButtonLabel,
  getQrDownloadHint,
} from "@/lib/qr/download-qr-image";
import { Button } from "@/components/ui/button";

interface RegistrationQrImageProps {
  size?: number;
  showDownload?: boolean;
  title?: string;
}

export function RegistrationQrImage({
  size = 220,
  showDownload = false,
  title = getMemberRegistrationQrTitle(),
}: RegistrationQrImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloadLabel, setDownloadLabel] = useState("Download QR Code");
  const [downloadHint, setDownloadHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    createRegistrationQrCardDataUrl(title, size)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [size, title]);

  useEffect(() => {
    setDownloadLabel(getQrDownloadButtonLabel());
    setDownloadHint(getQrDownloadHint());
  }, []);

  async function handleDownload() {
    if (!dataUrl || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await downloadQrImage(dataUrl, getRegistrationQrDownloadFileName());
    } catch {
      setSaveError("Could not save the QR code. Try again or screenshot the code.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!dataUrl) {
    const cardSize = getRegistrationQrCardDimensions(size, title);
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground"
          style={{ width: cardSize.width, height: cardSize.height }}
        >
          Loading QR…
        </div>
      </div>
    );
  }

  const cardSize = getRegistrationQrCardDimensions(size, title);

  return (
    <div className="flex w-full max-w-full flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- QR card data URL */}
      <img
        src={dataUrl}
        alt={`QR code to join ${loyaltyConfig.programName}`}
        className="max-w-full rounded-xl border bg-white shadow-sm"
        width={cardSize.width}
        height={cardSize.height}
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
