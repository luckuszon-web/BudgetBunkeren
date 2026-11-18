import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getServices } from "@/services";
import { readBootParams } from "@/lib/boot-params";
import { listenForInstall } from "@/lib/install";
import { App } from "./App";
import { ErrorBoundary } from "@/components/layout/ErrorScreen";
import "./index.css";

const el = document.getElementById("root")!;
const boot = readBootParams();   // før Supabase og routeren læser adressen
listenForInstall();

// Offline: appens filer gemmes af den fælles service worker (kun på https og ikke under automatiske tests)
if ("serviceWorker" in navigator && location.protocol === "https:" && !navigator.webdriver) {
  navigator.serviceWorker.register("../sw.js", { scope: "../" }).catch(() => {});
}

try {
  createRoot(el).render(<StrictMode><ErrorBoundary><App services={getServices()} boot={boot} /></ErrorBoundary></StrictMode>);
} catch (e) {
  // Fx manglende/ugyldig Supabase-opsætning – vis en forståelig besked i stedet for en hvid side.
  el.innerHTML = `<p style="padding:2rem;font-family:system-ui">Appen kunne ikke starte: ${String((e as Error).message ?? e).replace(/</g, "&lt;")}</p>`;
}
