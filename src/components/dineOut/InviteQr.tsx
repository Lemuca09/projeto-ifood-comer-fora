"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function InviteQr({ url, size = 200 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    void QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (error) {
    return (
      <div className="flex h-[200px] w-[200px] items-center justify-center rounded-if border border-[var(--ifdl-color-border)] bg-page p-3 text-center text-[11px] text-muted">
        Não foi possível gerar o QR. Use o link do convidado.
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="flex h-[200px] w-[200px] animate-pulse items-center justify-center rounded-if bg-neutral-100 text-[11px] text-muted">
        Gerando QR…
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="QR Code para entrar no split da conta"
      width={size}
      height={size}
      className="rounded-if border border-[var(--ifdl-color-border)] bg-white"
    />
  );
}
