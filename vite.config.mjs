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
      "/binance-api": {
        target: "https://api.binance.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/binance-api/, ""),
      },
      "/mexc-api": {
        target: "https://api.mexc.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/mexc-api/, ""),
      },
      "/yahoo-api": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/yahoo-api/, ""),
      },
    },
  },
});