import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: { configurable: true, value: () => false },
  setPointerCapture: { configurable: true, value: () => {} },
  releasePointerCapture: { configurable: true, value: () => {} },
  scrollIntoView: { configurable: true, value: () => {} }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});