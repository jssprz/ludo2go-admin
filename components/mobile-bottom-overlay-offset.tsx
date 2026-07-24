'use client';

import { useEffect } from 'react';

const OVERLAY_SELECTOR = '[data-mobile-fixed-bottom]';

function getOverlayHeight(): number {
  if (typeof window === 'undefined') return 0;

  const overlays = Array.from(document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR));
  if (overlays.length === 0) return 0;

  return overlays.reduce((maxHeight, overlay) => {
    const rect = overlay.getBoundingClientRect();
    const style = window.getComputedStyle(overlay);
    const isVisible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight;

    if (!isVisible) return maxHeight;

    return Math.max(maxHeight, Math.ceil(rect.height));
  }, 0);
}

function applyOverlayOffset() {
  const height = getOverlayHeight();
  document.documentElement.style.setProperty('--mobile-fixed-bottom-offset', `${height}px`);
}

export function MobileBottomOverlayOffset() {
  useEffect(() => {
    applyOverlayOffset();

    const resizeObserver = new ResizeObserver(() => {
      applyOverlayOffset();
    });

    const observeOverlays = () => {
      const overlays = Array.from(document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR));
      overlays.forEach((overlay) => resizeObserver.observe(overlay));
      applyOverlayOffset();
    };

    const mutationObserver = new MutationObserver(() => {
      resizeObserver.disconnect();
      observeOverlays();
    });

    observeOverlays();
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-mobile-fixed-bottom', 'data-state', 'hidden', 'aria-hidden']
    });

    window.addEventListener('resize', applyOverlayOffset);
    window.addEventListener('orientationchange', applyOverlayOffset);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', applyOverlayOffset);
      window.removeEventListener('orientationchange', applyOverlayOffset);
      document.documentElement.style.setProperty('--mobile-fixed-bottom-offset', '0px');
    };
  }, []);

  return null;
}