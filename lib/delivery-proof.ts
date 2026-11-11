import { getVercelOidcToken } from '@vercel/oidc';

// Vercel functions reject request bodies above 4.5 MB; the client downscales photos before upload.
export const DELIVERY_PROOF_MAX_BYTES = 4 * 1024 * 1024;

export const DELIVERY_PROOF_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export type DeliveryProof = {
  pathname: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string | null;
};

export function deliveryProofPrefix(orderId: string): string {
  return `orders/${orderId}/delivery-proof/`;
}

export function isDeliveryProofPathname(orderId: string, pathname: string): boolean {
  const prefix = deliveryProofPrefix(orderId);
  return pathname.startsWith(prefix) && /^[A-Za-z0-9._-]+$/.test(pathname.slice(prefix.length));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readDeliveryProofs(metadata: unknown): DeliveryProof[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.deliveryProofs)) return [];
  return metadata.deliveryProofs.filter(
    (proof): proof is DeliveryProof => isRecord(proof) && typeof proof.pathname === 'string' && typeof proof.uploadedAt === 'string'
  );
}

export function appendDeliveryProof(metadata: unknown, proof: DeliveryProof): Record<string, unknown> {
  const base = isRecord(metadata) ? metadata : {};
  return { ...base, deliveryProofs: [...readDeliveryProofs(metadata), proof] };
}

/**
 * Credentials for the private (sensitive) blob store. Passing an explicit OIDC token and store id
 * prevents @vercel/blob from silently falling back to BLOB_READ_WRITE_TOKEN (the public store).
 */
export async function sensitiveBlobAuth(): Promise<{ storeId: string; oidcToken: string }> {
  const storeId = process.env.SENSITIVE_BLOB_STORE_ID?.trim();
  if (!storeId) throw new Error('SENSITIVE_BLOB_STORE_ID is not configured.');
  let oidcToken: string | undefined;
  try {
    oidcToken = await getVercelOidcToken();
  } catch {
    oidcToken = undefined;
  }
  if (!oidcToken) throw new Error('Vercel OIDC token unavailable; cannot access the private blob store.');
  return { storeId, oidcToken };
}
