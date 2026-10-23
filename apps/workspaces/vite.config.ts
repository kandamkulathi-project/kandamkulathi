import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "base-uri 'none'; object-src 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "geolocation=(), usb=(), camera=(self), microphone=(self)",
};
export default defineConfig({
  plugins: [react()],
  server: { headers },
  preview: { headers },
});
