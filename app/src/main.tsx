import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getServices } from "@/services";
import { App } from "./App";
import "./index.css";

const el = document.getElementById("root")!;
try {
  createRoot(el).render(<StrictMode><App services={getServices()} /></StrictMode>);
} catch (e) {
  // Fx manglende/ugyldig Supabase-opsætning – vis en forståelig besked i stedet for en hvid side.
  el.innerHTML = `<p style="padding:2rem;font-family:system-ui">Appen kunne ikke starte: ${String((e as Error).message ?? e).replace(/</g, "&lt;")}</p>`;
}
