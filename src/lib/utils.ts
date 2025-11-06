import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Encryption/decryption for password storage in localStorage
// Using AES-GCM encryption with Web Crypto API
const ENCRYPTION_KEY = "TFC-Nexus-2024-Key";

export async function encryptPassword(password: string): Promise<string> {
  try {
    // Use Web Crypto API for encryption
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Import key
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error("Encryption error:", error);
    // Fallback to simple encoding if crypto fails
    return btoa(unescape(encodeURIComponent(password)));
  }
}

export async function decryptPassword(encryptedPassword: string): Promise<string> {
  try {
    // Decode from base64
    const combined = new Uint8Array(
      atob(encryptedPassword)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Import key
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encrypted
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    // Fallback to simple decoding if crypto fails
    try {
      return decodeURIComponent(escape(atob(encryptedPassword)));
    } catch {
      return "";
    }
  }
}
