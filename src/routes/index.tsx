import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/qr/Studio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QR Studio — Design & download scannable QR codes" },
      { name: "description", content: "Create custom QR codes for links, text, email, phone and Wi‑Fi. Style, preview and download PNG or SVG — all in your browser." },
      { property: "og:title", content: "QR Studio — Design & download scannable QR codes" },
      { property: "og:description", content: "Custom QR codes for links, text, email, phone and Wi‑Fi. Private, in-browser, free." },
    ],
  }),
  component: Studio,
});
