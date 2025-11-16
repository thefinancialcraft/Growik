/**
 * Generate a secure magic link token for contract signing
 * Uses crypto.getRandomValues for secure random token generation
 */
export function generateMagicLinkToken(): string {
  // Generate a secure random token using crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  // Convert to base64url format (URL-safe)
  const base64 = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return base64;
}

/**
 * Generate a full magic link URL for contract signing
 */
export function generateMagicLink(collaborationId: string): string {
  const token = generateMagicLinkToken();
  const baseUrl = window.location.origin;
  return `${baseUrl}/contract-sign/${token}`;
}

/**
 * Extract token from magic link URL
 */
export function extractTokenFromUrl(url: string): string | null {
  const match = url.match(/\/contract-sign\/([^\/]+)/);
  return match ? match[1] : null;
}

