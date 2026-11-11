import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['tests/orderTracking.test.tsx', 'tests/couriers.test.tsx', 'tests/deliveryProof.test.tsx', 'tests/deliveryProofApi.test.ts', 'tests/orderStatusEmail.test.ts', 'tests/orderItemsManagementApi.test.ts', 'tests/orderItemsControl.test.tsx'],
    setupFiles: ['tests/guideEditor.setup.ts'],
    clearMocks: true
  }
});