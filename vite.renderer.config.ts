import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Plugin to copy PDF.js worker, cmaps, and KaTeX CSS to output directory
const copyAssetsPlugin = () => ({
  name: 'copy-assets',
  writeBundle() {
    // Copy PDF.js worker from react-pdf's bundled pdfjs-dist
    const workerSource = path.join(__dirname, 'node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.js');
    const workerDest = path.join(__dirname, 'dist/renderer/pdf.worker.min.js');
    if (fs.existsSync(workerSource)) {
      fs.copyFileSync(workerSource, workerDest);
      console.log('[vite] Copied pdf.worker.min.js to output directory');
    }
    // Copy cmaps from react-pdf's bundled pdfjs-dist
    const cmapsSource = path.join(__dirname, 'node_modules/react-pdf/node_modules/pdfjs-dist/cmaps');
    const cmapsDest = path.join(__dirname, 'dist/renderer/cmaps');
    if (fs.existsSync(cmapsSource)) {
      fs.mkdirSync(cmapsDest, { recursive: true });
      const files = fs.readdirSync(cmapsSource);
      for (const file of files) {
        fs.copyFileSync(path.join(cmapsSource, file), path.join(cmapsDest, file));
      }
      console.log(`[vite] Copied ${files.length} cmaps to output directory`);
    }
    // Copy KaTeX CSS
    const katexCssSource = path.join(__dirname, 'node_modules/katex/dist/katex.min.css');
    const katexCssDest = path.join(__dirname, 'dist/renderer/katex.min.css');
    if (fs.existsSync(katexCssSource)) {
      fs.copyFileSync(katexCssSource, katexCssDest);
      console.log('[vite] Copied katex.min.css to output directory');
    }
  },
});

export default defineConfig({
  plugins: [react(), copyAssetsPlugin()],
  root: path.join(__dirname, 'src/renderer'),
  base: './',
  publicDir: 'public',
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.join(__dirname, 'src/renderer/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
      '@renderer': path.join(__dirname, 'src/renderer'),
      '@shared': path.join(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 3000,
    strictPort: true, // Don't auto-switch ports — Electron expects 3000
  },
  css: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },
});
