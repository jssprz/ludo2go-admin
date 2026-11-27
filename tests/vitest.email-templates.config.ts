import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: [
      'tests/emailTemplates.test.ts',
      'tests/emailTemplateRoutes.test.ts',
      'tests/emailTemplatesManager.test.tsx'
    ],
    setupFiles: ['tests/guideEditor.setup.ts'],
    clearMocks: true
  }
});
