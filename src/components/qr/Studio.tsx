import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Check, Copy, Download, FileCode2, History, ImagePlus, Info, Link2, Mail, Moon, Phone,
  QrCode, RotateCcw, Sun, Trash2, Type, Wifi, X,
} from "lucide-react";
import {
  PRESETS, buildPayload, defaultAppearance, emptyFields, fileName, isHex, matchPreset, scanWarnings, summarize,
  type Appearance, type ContentType, type CornerType, type DotType, type ECLevel, type Fields,
} from "@/lib/qr";
import { HISTORY_LIMIT, loadHistory, saveHistory, type HistoryItem } from "@/lib/history";
import { QRPreview, createQR } from "./QRPreview";
import { Field, Segmented } from "./Fields";

const TYPES: { value: ContentType; label: string; icon: typeof Link2 }[] = [
  { value: "url", label: "URL", icon: Link2 },
  { value: "text", label: "Text", icon: Type },
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "wifi", label: "Wi‑Fi", icon: Wifi },
];

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("qrstudio:theme", next ? "dark" : "light"); } catch { /* ignore */ }
  };
  return (
    <button type="button" onClick={toggle} className="icon-btn" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function ColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const bad = !isHex(draft);
  return (
    <Field id={id} label={label} error={bad ? "Use a 6-digit hex like #1a2b3c" : undefined}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={isHex(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="swatch" />
        <input
          id={id}
          className="input font-mono uppercase"
          value={draft}
          maxLength={7}
          aria-invalid={bad}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith("#")) v = "#" + v;
            setDraft(v);
            if (isHex(v)) onChange(v.toLowerCase());
          }}
        />
      </div>
    </Field>
  );
}

export function Studio() {
  const [type, setType] = useState<ContentType>("url");
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [ap, setAp] = useState<Appearance>(defaultAppearance);
  const [logo, setLogo] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [saveWifi, setSaveWifi] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHistory(loadHistory()), []);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setFields((f) => ({ ...f, [k]: v }));
  const setA = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setAp((a) => ({ ...a, [k]: v }));

  const result = useMemo(() => buildPayload(type, fields), [type, fields]);
  const debouncedResult = useDebounced(result, 150);
  const livePayload = debouncedResult.status === "ok" ? debouncedResult.payload : null;
  const payload = result.status === "ok" ? livePayload : null;
  const errors = result.status === "invalid" ? result.errors : {};
  const presetId = matchPreset(ap);
  const warnings = payload ? scanWarnings(ap, payload, !!logo) : [];
  const colorsOk = isHex(ap.fg) && isHex(ap.bg);

  const remember = () => {
    if (!payload) return;
    if (type === "wifi" && !saveWifi && fields.password) return;
    const item: HistoryItem = {
      id: `${Date.now()}`,
      type,
      fields: type === "wifi" && !saveWifi ? { ...fields, password: "" } : fields,
      appearance: ap,
      payload,
      ts: Date.now(),
    };
    const next = [item, ...history.filter((h) => !(h.payload === payload && JSON.stringify(h.appearance) === JSON.stringify(ap)))].slice(0, HISTORY_LIMIT);
    setHistory(next);
    if (!saveHistory(next)) toast.error("Couldn't save to history — browser storage is unavailable or full.");
  };

  const exportQR = async (ext: "png" | "svg") => {
    if (!payload) return;
    setBusy(true);
    try {
      const qr = await createQR(ap, payload, logo, ap.size, ext === "png" ? "canvas" : "svg");
      const blob = (await qr.getRawData(ext)) as Blob | null;
      if (!blob || blob.size < 100) throw new Error("empty");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName(type, ext);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      remember();
      toast.success(`Downloaded ${ext.toUpperCase()}`);
    } catch {
      toast.error("Export failed. Try a smaller size or remove the logo.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!payload) return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const qr = await createQR(ap, payload, logo, ap.size, "canvas");
        const blob = (await qr.getRawData("png")) as Blob;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("QR image copied to clipboard");
      } else {
        await navigator.clipboard.writeText(payload);
        toast.success("Image copy isn't supported here — copied the encoded text instead");
      }
      remember();
    } catch {
      toast.error("Couldn't copy. Use Download PNG instead.");
    }
  };

  const onLogo = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(file.type)) { toast.error("Please choose a PNG, JPG, WEBP, GIF or SVG image."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB."); return; }
    const r = new FileReader();
    r.onload = () => {
      const src = String(r.result);
      const img = new Image();
      img.onload = () => {
        setLogo(src);
        if (ap.ec === "L" || ap.ec === "M") setA("ec", "H");
        toast.info("Logo added — error correction set to H for better scanning.");
      };
      img.onerror = () => toast.error("That image couldn't be loaded.");
      img.src = src;
    };
    r.readAsDataURL(file);
  };

  const restore = (h: HistoryItem) => {
    setType(h.type);
    setFields(h.fields);
    setAp(h.appearance);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setFields(emptyFields);
    setLogo(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="app-header">
        <div className="container-app flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="logo-mark"><QrCode className="h-5 w-5" aria-hidden /></div>
            <div className="min-w-0">
              <p className="font-display text-base font-semibold leading-tight">QR Studio</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container-app flex-1 py-6 md:py-10">
        <h1 className="sr-only">QR Studio — QR code generator</h1>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          {/* Left: config */}
          <div className="space-y-6 min-w-0">
            <section className="panel" aria-labelledby="content-h">
              <div className="panel-head">
                <h2 id="content-h" className="panel-title">Content</h2>
                <button type="button" className="btn-ghost" onClick={reset}><RotateCcw className="h-3.5 w-3.5" /> New</button>
              </div>
              <div role="tablist" aria-label="Content type" className="type-tabs">
                {TYPES.map(({ value, label, icon: Icon }) => (
                  <button key={value} role="tab" type="button" aria-selected={type === value} onClick={() => setType(value)} className="type-tab">
                    <Icon className="h-4 w-4" aria-hidden /> <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-4 pt-5">
                {type === "url" && (
                  <Field id="url" label="Website URL" error={errors.url} hint="https:// is added automatically if missing.">
                    <input id="url" className="input" inputMode="url" autoComplete="url" placeholder="example.com" value={fields.url} aria-invalid={!!errors.url} aria-describedby={errors.url ? "url-err" : undefined} onChange={(e) => set("url", e.target.value)} />
                  </Field>
                )}
                {type === "text" && (
                  <Field id="text" label="Text" error={errors.text} hint={`${new TextEncoder().encode(fields.text).length} / 1200 bytes`}>
                    <textarea id="text" rows={4} className="input resize-y" placeholder="Anything you want to share" value={fields.text} aria-invalid={!!errors.text} onChange={(e) => set("text", e.target.value)} />
                  </Field>
                )}
                {type === "email" && (
                  <>
                    <Field id="email" label="Email address" error={errors.email}>
                      <input id="email" type="email" className="input" placeholder="name@example.com" value={fields.email} aria-invalid={!!errors.email} onChange={(e) => set("email", e.target.value)} />
                    </Field>
                    <Field id="subject" label="Subject (optional)">
                      <input id="subject" className="input" value={fields.subject} onChange={(e) => set("subject", e.target.value)} />
                    </Field>
                    <Field id="body" label="Message (optional)">
                      <textarea id="body" rows={3} className="input resize-y" value={fields.body} onChange={(e) => set("body", e.target.value)} />
                    </Field>
                  </>
                )}
                {type === "phone" && (
                  <Field id="phone" label="Phone number" error={errors.phone} hint="Include the country code, e.g. +91 98765 43210">
                    <input id="phone" type="tel" className="input" placeholder="+1 555 123 4567" value={fields.phone} aria-invalid={!!errors.phone} onChange={(e) => set("phone", e.target.value)} />
                  </Field>
                )}
                {type === "wifi" && (
                  <>
                    <Field id="ssid" label="Network name (SSID)" error={errors.ssid}>
                      <input id="ssid" className="input" value={fields.ssid} aria-invalid={!!errors.ssid} onChange={(e) => set("ssid", e.target.value)} />
                    </Field>
                    <div className="space-y-1.5">
                      <span className="field-label">Security</span>
                      <Segmented label="Security" value={fields.security} onChange={(v) => set("security", v)} options={[{ value: "WPA", label: "WPA/WPA2" }, { value: "WEP", label: "WEP" }, { value: "nopass", label: "None" }]} />
                    </div>
                    {fields.security !== "nopass" && (
                      <Field id="password" label="Password" error={errors.password}>
                        <input id="password" type="password" autoComplete="off" className="input" value={fields.password} aria-invalid={!!errors.password} onChange={(e) => set("password", e.target.value)} />
                      </Field>
                    )}
                    <label className="check-row"><input type="checkbox" checked={fields.hidden} onChange={(e) => set("hidden", e.target.checked)} /> Hidden network</label>
                    <label className="check-row"><input type="checkbox" checked={saveWifi} onChange={(e) => setSaveWifi(e.target.checked)} /> Save password in this browser's history</label>
                    <p className="text-xs text-muted-foreground">By default, Wi‑Fi passwords are never saved to history. Only enable this on a device you trust.</p>
                  </>
                )}
              </div>
            </section>

            <section className="panel" aria-labelledby="style-h">
              <div className="panel-head">
                <h2 id="style-h" className="panel-title">Appearance</h2>
                <span className="chip">{presetId ? PRESETS.find((p) => p.id === presetId)?.name : "Custom"}</span>
              </div>

              <div className="preset-grid" role="radiogroup" aria-label="Presets">
                {PRESETS.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={presetId === p.id} className="preset" onClick={() => setAp((a) => ({ ...a, fg: p.fg, bg: p.bg, dot: p.dot, corner: p.corner }))}>
                    <span className="preset-swatch" style={{ background: p.bg }}><span style={{ background: p.fg }} /></span>
                    <span className="truncate">{p.name}</span>
                    {presetId === p.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 pt-5">
                <ColorInput id="fg" label="Foreground" value={ap.fg} onChange={(v) => setA("fg", v)} />
                <ColorInput id="bg" label="Background" value={ap.bg} onChange={(v) => setA("bg", v)} />
              </div>

              <div className="space-y-4 pt-5">
                <div className="space-y-1.5">
                  <span className="field-label">Module style</span>
                  <Segmented<DotType> label="Module style" value={ap.dot} onChange={(v) => setA("dot", v)} options={[{ value: "square", label: "Square" }, { value: "rounded", label: "Rounded" }, { value: "dots", label: "Dots" }, { value: "classy", label: "Classy" }, { value: "extra-rounded", label: "Soft" }]} />
                </div>
                <div className="space-y-1.5">
                  <span className="field-label">Corner style</span>
                  <Segmented<CornerType> label="Corner style" value={ap.corner} onChange={(v) => setA("corner", v)} options={[{ value: "square", label: "Square" }, { value: "extra-rounded", label: "Rounded" }, { value: "dot", label: "Circle" }]} />
                </div>
                <div className="space-y-1.5">
                  <span className="field-label">Error correction</span>
                  <Segmented<ECLevel> label="Error correction" value={ap.ec} onChange={(v) => setA("ec", v)} options={[{ value: "L", label: "L · 7%" }, { value: "M", label: "M · 15%" }, { value: "Q", label: "Q · 25%" }, { value: "H", label: "H · 30%" }]} />
                  <p className="text-xs text-muted-foreground">Higher levels survive damage or logos better, but make the code denser and hold less data.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="size" className="field-label">Export size</label>
                    <select id="size" className="input" value={ap.size} onChange={(e) => setA("size", Number(e.target.value))}>
                      {[256, 512, 1024, 2048].map((s) => <option key={s} value={s}>{s} × {s} px</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="margin" className="field-label flex justify-between"><span>Quiet zone</span><span className="font-mono text-muted-foreground">{ap.margin}%</span></label>
                    <input id="margin" type="range" min={0} max={15} value={ap.margin} onChange={(e) => setA("margin", Number(e.target.value))} className="range" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="field-label">Center logo (optional)</span>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="sr-only" aria-label="Upload logo" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ""; }} />
                  <div className="flex flex-wrap items-center gap-3">
                    {logo && <img src={logo} alt="Selected logo" className="h-11 w-11 rounded-lg border border-border object-contain bg-card p-1" />}
                    <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> {logo ? "Replace" : "Add logo"}</button>
                    {logo && <button type="button" className="btn-ghost" onClick={() => setLogo(null)}><X className="h-4 w-4" /> Remove</button>}
                  </div>
                  <p className="text-xs text-muted-foreground">Logos can reduce scannability. Always test with a few phones before printing.</p>
                </div>
              </div>
            </section>
          </div>

          {/* Right: preview */}
          <aside className="panel lg:sticky lg:top-6 order-first lg:order-none" aria-labelledby="preview-h">
            <div className="panel-head">
              <h2 id="preview-h" className="panel-title">Preview</h2>
              <span className="text-xs font-mono text-muted-foreground">{ap.size}px · EC {ap.ec}</span>
            </div>
            <QRPreview appearance={ap} payload={colorsOk ? payload : null} logo={logo} />

            <div className="grid grid-cols-2 gap-2 pt-5">
              <button type="button" className="btn-primary col-span-2" disabled={!payload || busy} onClick={() => exportQR("png")}><Download className="h-4 w-4" /> Download PNG</button>
              <button type="button" className="btn-secondary" disabled={!payload || busy} onClick={() => exportQR("svg")}><FileCode2 className="h-4 w-4" /> SVG</button>
              <button type="button" className="btn-secondary" disabled={!payload || busy} onClick={copy}><Copy className="h-4 w-4" /> Copy</button>
            </div>

            <div aria-live="polite" className="pt-5 space-y-2">
              {payload && warnings.length === 0 && (
                <p className="note note-ok"><Check className="h-4 w-4 shrink-0" aria-hidden /> Good contrast and quiet zone. Still, test before printing.</p>
              )}
              {warnings.map((w) => (
                <p key={w.text} className={`note ${w.level === "warn" ? "note-warn" : "note-info"}`}>
                  {w.level === "warn" ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> : <Info className="h-4 w-4 shrink-0" aria-hidden />}
                  <span><span className="sr-only">{w.level === "warn" ? "Warning: " : "Note: "}</span>{w.text}</span>
                </p>
              ))}
              {warnings.some((w) => w.level === "warn") && (
                <button type="button" className="btn-ghost" onClick={() => setAp((a) => ({ ...defaultAppearance, size: a.size, ec: logo ? "H" : "M" }))}><RotateCcw className="h-3.5 w-3.5" /> Reset to high-contrast style</button>
              )}
              {payload && <p className="text-[11px] text-muted-foreground">Checks are heuristics, not a scan guarantee.</p>}
            </div>
          </aside>
        </div>

        <section className="panel mt-6" aria-labelledby="recent-h">
          <div className="panel-head">
            <h2 id="recent-h" className="panel-title flex items-center gap-2"><History className="h-4 w-4" aria-hidden /> Recent</h2>
            {history.length > 0 && (confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Clear all?</span>
                <button type="button" className="btn-danger" onClick={() => { setHistory([]); saveHistory([]); setConfirmClear(false); }}>Clear</button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setConfirmClear(true)}><Trash2 className="h-3.5 w-3.5" /> Clear history</button>
            ))}
          </div>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Codes you download or copy are saved here, on this device only.</p>
          ) : (
            <ul className="recent-grid">
              {history.map((h) => {
                const T = TYPES.find((t) => t.value === h.type)!;
                return (
                  <li key={h.id}>
                    <button type="button" className="recent-item" onClick={() => restore(h)}>
                      <span className="preset-swatch" style={{ background: h.appearance.bg }}><span style={{ background: h.appearance.fg }} /></span>
                      <span className="min-w-0 text-left">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><T.icon className="h-3 w-3" aria-hidden />{T.label} · {new Date(h.ts).toLocaleDateString()}</span>
                        <span className="block truncate text-sm font-medium">{summarize(h.type, h.fields) || "—"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container-app py-6 flex flex-col sm:flex-row gap-2 justify-between text-xs text-muted-foreground">
          <p><span className="font-semibold text-foreground">QR Studio</span></p>
          <p>Everything is generated on your device. Nothing is uploaded.</p>
        </div>
      </footer>
    </div>
  );
}
