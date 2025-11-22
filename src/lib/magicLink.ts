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

/**
 * Extract body content from HTML
 */
export function extractBodyContent(html: string | null): string {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.body;
    if (body) {
      const tiptapDiv = body.querySelector('.contract-preview-container .tiptap-rendered') || 
                       body.querySelector('.tiptap-rendered');
      if (tiptapDiv) {
        return tiptapDiv.innerHTML;
      }
      return body.innerHTML;
    }
    return html;
  } catch {
    return html || "";
  }
}
 
/**
 * Extract styles from HTML
 */
export function extractStylesFromHtml(html: string | null): { css: string; links: string } {
  if (!html) return { css: "", links: "" };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const head = doc.head;
    if (!head) return { css: "", links: "" };
    
    let css = "";
    const styleTags = head.querySelectorAll("style");
    styleTags.forEach((tag) => {
      css += tag.textContent || "";
    });
    
    let links = "";
    const linkTags = head.querySelectorAll('link[rel="stylesheet"]');
    linkTags.forEach((tag) => {
      links += tag.outerHTML || "";
    });
    
    return { css, links };
  } catch {
    return { css: "", links: "" };
  }
}

