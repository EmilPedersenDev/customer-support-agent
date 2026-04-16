import { defineConfig } from "vite";

// Dev: browser calls /api/* → proxied to Express (default http://localhost:3000).
// Vite dev server default: http://localhost:5173
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
