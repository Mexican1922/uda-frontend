import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.svg", "icons/*.png", "manifest.json"],
      manifest: false, // we manage public/manifest.json ourselves

      workbox: {
        // Cache the app shell (JS/CSS/HTML) with CacheFirst — fast loads
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],

        // Runtime caching strategies
        runtimeCaching: [
          {
            // Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts woff2 files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // YouTube thumbnail images — StaleWhileRevalidate so art always shows
            urlPattern: /^https:\/\/i\.ytimg\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "youtube-thumbnails",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Our API — NetworkFirst so fresh data wins, falls back to cache
            urlPattern: /\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 2 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        // Enable SW in dev so you can test offline behaviour without building
        enabled: false,
      },
    }),
  ],

  server: {
    port: 5177,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
});
