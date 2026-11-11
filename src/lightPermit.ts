export type LightPermit = {
  product: "phototags_light"; type: "permit"; sub: string; keyHash: string;
  licenseId: string; plan: string; iat: number; exp: number; licenseExpiresAt: string | null;
};
export function decode64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
export function encode64(value: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(value instanceof Uint8Array ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) : value))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
export async function digest(value: string): Promise<string> {
  return encode64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
export function canonicalKey(key: JsonWebKey): JsonWebKey {
  return { kty: "EC", crv: "P-256", x: key.x, y: key.y };
}
export async function verifyLightPermit(token: string, jwk: JsonWebKey, id: string, keyHash: string, now = Date.now()): Promise<LightPermit> {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 5000) throw new Error("Invalid license permit.");
  const [header, body, signature] = parts;
  const metadata = JSON.parse(new TextDecoder().decode(decode64(header)));
  if (metadata.alg !== "ES256" || metadata.typ !== "JWT" || jwk.d) throw new Error("Invalid license signature algorithm.");
  const key = await crypto.subtle.importKey("jwk", canonicalKey(jwk), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, decode64(signature), new TextEncoder().encode(`${header}.${body}`))) throw new Error("Invalid license signature.");
  const p = JSON.parse(new TextDecoder().decode(decode64(body))) as LightPermit;
  if (p.product !== "phototags_light" || p.type !== "permit" || p.sub !== id || p.keyHash !== keyHash ||
      !Number.isFinite(p.iat) || !Number.isFinite(p.exp) || p.exp <= p.iat || p.exp * 1000 <= now || p.iat * 1000 > now + 300000 ||
      p.exp - p.iat > 30 * 86400 || typeof p.licenseId !== "string" || typeof p.plan !== "string" ||
      p.licenseExpiresAt !== null && (!Number.isFinite(Date.parse(p.licenseExpiresAt)) || Date.parse(p.licenseExpiresAt) < p.exp * 1000)) throw new Error("License permit expired or belongs to another installation. Connect to refresh your license.");
  return p;
}
