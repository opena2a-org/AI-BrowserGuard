import { resolve } from 'path';
import { defineConfig } from 'vite';

/**
 * Determine which entry to build based on the ENTRY env var.
 * Chrome extensions need separate builds because:
 * - Content scripts cannot load ES module imports (no shared chunks)
 * - Background service worker supports modules but content scripts don't
 *
 * Usage: ENTRY=background vite build, ENTRY=content vite build, ENTRY=popup vite build
 * Or: npm run build (runs all three sequentially via build script)
 */
const entry = process.env.ENTRY || 'all';

function getConfig() {
  const sharedConfig = {
    target: 'es2022' as const,
    minify: false as const,
    sourcemap: 'inline' as const,
  };

  if (entry === 'content') {
    return defineConfig({
      build: {
        ...sharedConfig,
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'src/content/index.ts'),
          formats: ['iife'],
          name: 'AIBrowserGuardContent',
          fileName: () => 'content/index.js',
        },
      },
      resolve: { alias: { '@': resolve(__dirname, 'src') } },
    });
  }

  if (entry === 'background') {
    return defineConfig({
      build: {
        ...sharedConfig,
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'src/background/index.ts'),
          formats: ['es'],
          fileName: () => 'background/index.js',
        },
        rollupOptions: {
          output: { inlineDynamicImports: true },
        },
      },
      resolve: { alias: { '@': resolve(__dirname, 'src') } },
    });
  }

  if (entry === 'popup') {
    return defineConfig({
      // Use src/popup as root so index.html lands at dist/popup/index.html
      root: resolve(__dirname, 'src/popup'),
      base: './',
      build: {
        ...sharedConfig,
        outDir: resolve(__dirname, 'dist/popup'),
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, 'src/popup/index.html'),
          output: {
            entryFileNames: 'popup.js',
            assetFileNames: (assetInfo) => {
              if (assetInfo.name?.endsWith('.css')) return 'styles.css';
              return 'assets/[name]-[hash][extname]';
            },
            inlineDynamicImports: true,
          },
        },
      },
      resolve: { alias: { '@': resolve(__dirname, 'src') } },
    });
  }

  // Default: build all (used by the build script)
  // This config is only used for TypeScript checking; actual builds use the script
  return defineConfig({
    build: {
      ...sharedConfig,
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background/index.ts'),
          content: resolve(__dirname, 'src/content/index.ts'),
          popup: resolve(__dirname, 'src/popup/index.html'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'background') return 'background/index.js';
            if (chunkInfo.name === 'content') return 'content/index.js';
            if (chunkInfo.name === 'popup') return 'popup/popup.js';
            return '[name]/[name].js';
          },
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) return 'popup/styles.css';
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
  });
}

export default getConfig();
