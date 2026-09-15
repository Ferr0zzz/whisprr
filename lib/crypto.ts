// Toutes ces fonctions tournent UNIQUEMENT côté navigateur.
// Le serveur ne voit jamais une clé de déchiffrement en clair :
// c'est ça qui fait l'architecture "zero-knowledge".

const ALGO = "AES-GCM";

/** Génère une clé AES-GCM aléatoire de 256 bits. */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGO, length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/** Exporte une clé en base64url, pour pouvoir la mettre dans l'URL (fragment #). */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufferToBase64Url(raw);
}

/** Réimporte une clé depuis sa forme base64url (récupérée dans l'URL). */
export async function importKey(base64url: string): Promise<CryptoKey> {
  const raw = base64UrlToBuffer(base64url);
  return crypto.subtle.importKey("raw", raw, ALGO, true, ["encrypt", "decrypt"]);
}

/** Chiffre un texte. Retourne le ciphertext + l'IV, tous deux en base64url. */
export async function encryptText(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

  return {
    ciphertext: bufferToBase64Url(ciphertextBuffer),
    iv: bufferToBase64Url(iv),
  };
}

/** Déchiffre un texte à partir du ciphertext + IV + clé. */
export async function decryptText(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv: base64UrlToBuffer(iv) },
    key,
    base64UrlToBuffer(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

// --- Helpers d'encodage (base64 "url-safe", sans + / = qui posent problème dans une URL) ---

function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
