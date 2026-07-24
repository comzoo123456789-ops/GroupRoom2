import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Vite가 React 클라이언트(index.html)와 Cloudflare Worker(wrangler.jsonc의 main)를
// 하나의 개발 서버에서 함께 구동한다. `npm run dev` 한 번으로 프론트+API+DO 전부 동작.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
