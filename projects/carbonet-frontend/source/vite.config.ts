import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const explicitBuildTarget = process.env.VITE_OUT_DIR?.trim();
const buildTarget = explicitBuildTarget || (process.env.VITE_BUILD_TARGET === "classes"
  ? "../target/classes/static/react-app"
  : "../src/main/resources/static/react-app");
const mirrorTarget = process.env.VITE_BUILD_TARGET === "classes"
  ? "../src/main/resources/static/react-app"
  : "../target/classes/static/react-app";

async function replaceDirectory(sourceDir: string, targetDir: string) {
  try {
    await rm(targetDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200
    });
    await mkdir(path.dirname(targetDir), { recursive: true });
    await cp(sourceDir, targetDir, { recursive: true });
  } catch (err) {
    console.warn("[sync-build-output] Skipped directory mirror copy due to: ", err.message);
  }
}

function syncBuildOutputPlugin() {
  return {
    name: "sync-build-output",
    async closeBundle() {
      const sourceDir = path.resolve(__dirname, buildTarget);
      const targetDirs = explicitBuildTarget ? [] : [
        path.resolve(__dirname, mirrorTarget),
      ];

      await Promise.all(targetDirs
        .filter((targetDir) => targetDir !== sourceDir)
        .map((targetDir) => replaceDirectory(sourceDir, targetDir)));
    }
  };
}

export default defineConfig({
  base: "/assets/react/",
  plugins: [react(), syncBuildOutputPlugin()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("./node_modules/react-dom", import.meta.url))
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"]
  },
  build: {
    outDir: buildTarget,
    emptyOutDir: true,
    manifest: true,
    // Hundreds of immutable chunks are verified by the asset-closure gate.
    // Recomputing every gzip size during each deploy adds latency without
    // changing emitted bytes or the fail-closed publication contract.
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("react/jsx-runtime")) {
            return "vendor-react";
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/assets/react/img": {
        target: "http://127.0.0.1:5175",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/assets\/react/, "")
      },
      "/assets/react/assets": {
        target: "http://127.0.0.1:5175",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/assets\/react/, "")
      },
      "/api": {
        target: "http://localhost:18000",
        changeOrigin: true
      },
      "/admin/api": {
        target: "http://localhost:18000",
        changeOrigin: true
      },
      "/en/admin/api": {
        target: "http://localhost:18000",
        changeOrigin: true
      }
    }
  }
});
