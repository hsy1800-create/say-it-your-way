import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`          → dist/ (GitHub Pages용)
// `npm run build:preview`  → dist-preview/index.html (파일 하나짜리 체험판)
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview';
  return {
    base: './',
    define: { __PREVIEW__: JSON.stringify(preview) },
    plugins: preview ? [viteSingleFile()] : [],
    build: { outDir: preview ? 'dist-preview' : 'dist', emptyOutDir: true },
  };
});
