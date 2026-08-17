const KEY_HEX_LENGTH = 64;

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `${base64(iv)}:${base64(new Uint8Array(ciphertext))}`;
}

export async function decryptToken(ciphertext: string): Promise<string> {
  const [ivBase64, payloadBase64] = ciphertext.split(":");
  if (!ivBase64 || !payloadBase64) throw new Error("Invalid encrypted token format");

  const key = await encryptionKey();
  const iv = fromBase64(ivBase64);
  const payload = fromBase64(payloadBase64);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload);
  return new TextDecoder().decode(plaintext);
}

async function encryptionKey() {
  const raw = Deno.env.get("MOLLIE_TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("Missing MOLLIE_TOKEN_ENCRYPTION_KEY");

  const keyBytes = /^[0-9a-f]{64}$/i.test(raw)
    ? hexToBytes(raw)
    : new TextEncoder().encode(raw);
  if (keyBytes.byteLength !== 32) {
    throw new Error(`MOLLIE_TOKEN_ENCRYPTION_KEY must be ${KEY_HEX_LENGTH} hex chars or 32 bytes`);
  }

  return await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
