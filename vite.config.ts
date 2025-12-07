import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const defineEnv = Object.entries(env).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      acc[`process.env.${key}`] = JSON.stringify(value);
      return acc;
    },
    {}
  );

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",

      // ⭐ Allow ALL ngrok domains so we never edit this again
      // Allow all hosts to avoid blocking quick tunnel hostnames
      allowedHosts: true,

      cors: true,

      // ⭐ Required for ngrok v3 — fixes ERR_NGROK_3200 and 403 responses
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-cache",
      },

      proxy: {
        "/ws/voice": {
          target: "http://localhost:8081",
          ws: true,
          changeOrigin: true,
        },
      },
    },

    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            firebase: [
              "firebase/app",
              "firebase/auth",
              "firebase/firestore",
              "firebase/functions",
            ],
          },
        },
      },
    },

    plugins: [react()],
    define: defineEnv,

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
