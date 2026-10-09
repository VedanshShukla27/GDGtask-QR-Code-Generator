import { useEffect, useRef, useState } from "react";
import { QrCode } from "lucide-react";
import type { Appearance } from "@/lib/qr";

type QRInstance = import("qr-code-styling").default;

export function buildOptions(a: Appearance, data: string, logo: string | null, size: number, type: "svg" | "canvas") {
  return {
    width: size,
    height: size,
    type,
    data,
    margin: Math.round((size * a.margin) / 100),
    image: logo ?? undefined,
    qrOptions: { errorCorrectionLevel: a.ec },
    dotsOptions: { color: a.fg, type: a.dot },
    backgroundOptions: { color: a.bg },
    cornersSquareOptions: { color: a.fg, type: a.corner },
    cornersDotOptions: { color: a.fg, type: a.corner === "extra-rounded" ? "dot" : a.corner === "dot" ? "dot" : "square" },
    imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: Math.round(size / 100) },
  } as const;
}

export async function createQR(a: Appearance, data: string, logo: string | null, size: number, type: "svg" | "canvas") {
  const { default: QRCodeStyling } = await import("qr-code-styling");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new QRCodeStyling(buildOptions(a, data, logo, size, type) as any);
}

export function QRPreview({ appearance, payload, logo }: { appearance: Appearance; payload: string | null; logo: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const qr = useRef<QRInstance | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    const opts = buildOptions(appearance, payload, logo, 400, "svg");
    (async () => {
      try {
        if (!qr.current) {
          const inst = await createQR(appearance, payload, logo, 400, "svg");
          if (cancelled) return;
          qr.current = inst;
          if (ref.current) {
            ref.current.innerHTML = "";
            inst.append(ref.current);
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          qr.current.update({ ...opts, image: logo ?? "" } as any);
        }
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [appearance, payload, logo]);

  useEffect(() => {
    if (!payload) qr.current = null;
  }, [payload]);

  return (
    <div className="qr-stage aspect-square w-full max-w-[360px] mx-auto">
      {payload && !failed ? (
        <div ref={ref} className="h-full w-full [&_svg]:h-full [&_svg]:w-full [&_canvas]:h-full [&_canvas]:w-full" role="img" aria-label="Generated QR code preview" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
          <QrCode className="h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">{failed ? "Couldn't generate this code" : "Your QR code will appear here"}</p>
          <p className="text-xs text-muted-foreground">{failed ? "Try shortening the content or changing settings." : "Fill in valid content on the left to get started."}</p>
        </div>
      )}
    </div>
  );
}
