import { defineConfig } from 'vite';

export default defineConfig({
  // 用相對路徑，丟到 Cloudflare Pages / GitHub Pages 的子路徑都不會壞
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    // Phaser 本身就 1MB+，這個警告沒有意義
    chunkSizeWarningLimit: 2048,
  },
});
