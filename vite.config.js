import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      "dm2drefranqueado-398246262001.southamerica-east1.run.app",
      ".run.app",
    ],
  },
});
