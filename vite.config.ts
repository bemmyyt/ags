import { defineConfig } from 'vite';

export default defineConfig({
  // Relative output paths work both locally and from the repository subpath on
  // GitHub Pages (https://<owner>.github.io/<repository>/).
  base: './',
  server: { host: '0.0.0.0' },
  build: { target: 'es2022', sourcemap: true },
});
