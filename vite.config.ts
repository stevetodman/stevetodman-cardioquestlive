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
    },
    plugins: [react()],
    define: defineEnv,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
