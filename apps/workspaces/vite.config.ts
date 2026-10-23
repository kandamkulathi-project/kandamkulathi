import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react()],
  server: { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
  preview: { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
});
