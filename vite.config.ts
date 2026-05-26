import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlifyPlugin from "@netlify/vite-plugin-tanstack-start";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    netlifyPlugin(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
