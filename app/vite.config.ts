import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Bygges til ../docs/ny (GitHub Pages: /BudgetBunkeren/ny/). Relative stier, så appen virker i enhver undermappe.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "../docs/ny", emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 800 },
});
