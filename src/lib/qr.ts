export type ContentType = "url" | "text" | "email" | "phone" | "wifi";
export type ECLevel = "L" | "M" | "Q" | "H";
export type DotType = "square" | "rounded" | "dots" | "classy" | "extra-rounded";
export type CornerType = "square" | "extra-rounded" | "dot";
export type WifiSecurity = "WPA" | "WEP" | "nopass";

export interface Fields {
  url: string;
  text: string;
  email: string;
  subject: string;
  body: string;
  phone: string;
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

export interface Appearance {
  fg: string;
  bg: string;
  ec: ECLevel;
  size: number;
  margin: number;
  dot: DotType;
  corner: CornerType;
}

export const MAX_PAYLOAD = 1200;

export const emptyFields: Fields = {
  url: "",
  text: "",
  email: "",
  subject: "",
  body: "",
  phone: "",
  ssid: "",
  password: "",
  security: "WPA",
  hidden: false,
};

export const defaultAppearance: Appearance = {
  fg: "#111111",
  bg: "#ffffff",
  ec: "M",
  size: 1024,
  margin: 4,
  dot: "square",
  corner: "square",
};

export interface Preset {
  id: string;
  name: string;
  fg: string;
  bg: string;
  dot: DotType;
  corner: CornerType;
}

export const PRESETS: Preset[] = [
  { id: "classic", name: "Classic", fg: "#111111", bg: "#ffffff", dot: "square", corner: "square" },
  { id: "midnight", name: "Midnight", fg: "#e8ecf4", bg: "#0f172a", dot: "rounded", corner: "extra-rounded" },
  { id: "ocean", name: "Ocean", fg: "#0b4f6c", bg: "#eef8fb", dot: "dots", corner: "extra-rounded" },
  { id: "forest", name: "Forest", fg: "#1f4d2b", bg: "#f3f7ef", dot: "classy", corner: "square" },
  { id: "violet", name: "Violet", fg: "#4c1d95", bg: "#f7f3ff", dot: "extra-rounded", corner: "dot" },
  { id: "minimal", name: "Minimal Light", fg: "#3a3a3a", bg: "#fafaf7", dot: "rounded", corner: "extra-rounded" },
];

export function matchPreset(a: Appearance): string | null {
  const p = PRESETS.find(
    (p) =>
      p.fg.toLowerCase() === a.fg.toLowerCase() &&
      p.bg.toLowerCase() === a.bg.toLowerCase() &&
      p.dot === a.dot &&
      p.corner === a.corner,
  );
  return p ? p.id : null;
}

export const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeUrl(raw: string) {
  const v = raw.trim();
  if (!v) return v;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

function escWifi(s: string) {
  return s.replace(/([\\;,:"])/g, "\\$1");
}

export type BuildResult =
  | { status: "empty" }
  | { status: "invalid"; errors: Partial<Record<keyof Fields, string>> }
  | { status: "ok"; payload: string };

export function buildPayload(type: ContentType, f: Fields): BuildResult {
  const errs: Partial<Record<keyof Fields, string>> = {};
  let payload = "";
  switch (type) {
    case "url": {
      if (!f.url.trim()) return { status: "empty" };
      const u = normalizeUrl(f.url);
      try {
        const parsed = new URL(u);
        if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes("."))
          errs.url = "Enter a full web address, like example.com";
      } catch {
        errs.url = "That doesn't look like a valid web address";
      }
      payload = u;
      break;
    }
    case "text":
      if (!f.text) return { status: "empty" };
      payload = f.text;
      break;
    case "email": {
      if (!f.email.trim()) return { status: "empty" };
      if (!EMAIL_RE.test(f.email.trim())) errs.email = "Enter a valid email, like name@example.com";
      const q: string[] = [];
      if (f.subject) q.push(`subject=${encodeURIComponent(f.subject)}`);
      if (f.body) q.push(`body=${encodeURIComponent(f.body)}`);
      payload = `mailto:${f.email.trim()}${q.length ? "?" + q.join("&") : ""}`;
      break;
    }
    case "phone": {
      if (!f.phone.trim()) return { status: "empty" };
      const cleaned = f.phone.replace(/[\s().-]/g, "");
      if (!/^\+?\d{4,15}$/.test(cleaned)) errs.phone = "Use digits only, optionally starting with +";
      payload = `tel:${cleaned}`;
      break;
    }
    case "wifi": {
      if (!f.ssid.trim()) return { status: "empty" };
      if (f.ssid.length > 32) errs.ssid = "Network names are at most 32 characters";
      if (f.security === "WPA" && f.password.length > 0 && f.password.length < 8)
        errs.password = "WPA passwords need at least 8 characters";
      if (f.security !== "nopass" && !f.password) errs.password = "Enter the network password";
      payload = `WIFI:T:${f.security};S:${escWifi(f.ssid)};${
        f.security !== "nopass" ? `P:${escWifi(f.password)};` : ""
      }${f.hidden ? "H:true;" : ""};`;
      break;
    }
  }
  if (new TextEncoder().encode(payload).length > MAX_PAYLOAD)
    errs[type === "wifi" ? "ssid" : (type as keyof Fields)] =
      `Content is too long (max ${MAX_PAYLOAD} bytes) — shorten it for a reliable code`;
  if (Object.keys(errs).length) return { status: "invalid", errors: errs };
  return { status: "ok", payload };
}

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

export function contrast(a: string, b: string) {
  if (!isHex(a) || !isHex(b)) return 21;
  const l1 = Math.max(lum(a), lum(b)), l2 = Math.min(lum(a), lum(b));
  return (l1 + 0.05) / (l2 + 0.05);
}

export interface Warning {
  level: "warn" | "info";
  text: string;
}

export function scanWarnings(a: Appearance, payload: string, hasLogo: boolean): Warning[] {
  const w: Warning[] = [];
  const c = contrast(a.fg, a.bg);
  if (c < 3) w.push({ level: "warn", text: `Low contrast (${c.toFixed(1)}:1). Aim for at least 4:1.` });
  else if (c < 4.5) w.push({ level: "info", text: `Contrast is ${c.toFixed(1)}:1 — fine for most scanners, higher is safer.` });
  if (isHex(a.fg) && isHex(a.bg) && lum(a.fg) > lum(a.bg))
    w.push({ level: "info", text: "Light code on dark background — some older scanners can't read inverted codes." });
  if (a.margin < 2) w.push({ level: "warn", text: "Very small quiet zone. Leave some empty space around the code." });
  if (hasLogo && (a.ec === "L" || a.ec === "M"))
    w.push({ level: "warn", text: "Logos cover part of the code. Use error correction Q or H." });
  if (payload.length > 600) w.push({ level: "info", text: "Long content makes a dense code. Print it larger for reliability." });
  if (a.size < 512 && payload.length > 300) w.push({ level: "info", text: "Dense code at a small size — consider a larger export." });
  return w;
}

export function fileName(type: ContentType, ext: string) {
  return `qr-${type}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export function summarize(type: ContentType, f: Fields) {
  switch (type) {
    case "url": return f.url;
    case "text": return f.text.slice(0, 60);
    case "email": return f.email;
    case "phone": return f.phone;
    case "wifi": return f.ssid;
  }
}
