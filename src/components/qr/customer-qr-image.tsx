"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildCustomerQrPayload } from "@/lib/qr/customer-qr";

interface CustomerQrImageProps {
  customerId: string;
  customerName: string;
  size?: number;
}

export function CustomerQrImage({
  customerId,
  customerName,
  size = 200,
}: CustomerQrImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(buildCustomerQrPayload(customerId), {
      width: size,
      margin: 2,
      color: {
        dark: "#4A2C17",
        light: "#FFFDF8",
      },
    })
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

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground"
        style={{ width: size, height: size }}
      >
        Loading QR…
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- QR data URL
    <img
      src={dataUrl}
      alt={`QR code for ${customerName}`}
      className="rounded-xl border bg-white p-3 shadow-sm"
      width={size}
      height={size}
    />
  );
}
