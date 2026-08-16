import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/standx-api": {
        target: "https://perps.standx.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/standx-api/, ""),
      },
      "/tv-scan": {
        target: "https://scanner.tradingview.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tv-scan/, ""),
      },
    },
  },
});