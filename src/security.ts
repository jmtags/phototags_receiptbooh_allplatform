import { useState } from "react";

const key = "phototags-kiosk-security-v1";
type Credential = { salt: string; hash: string };
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
async function digest(pin: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bytes = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    material,
    256,
  );
  return hex(new Uint8Array(bytes));
}
export function useSecurity() {
  const [credential, setCredential] = useState<Credential | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      return saved &&
        /^[a-f0-9]{32}$/.test(saved.salt) &&
        /^[a-f0-9]{64}$/.test(saved.hash)
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const [failures, setFailures] = useState(0),
    [pinLockedUntil, setLockedUntil] = useState(0);
  async function verifyPin(pin: string) {
    if (!credential || Date.now() < pinLockedUntil || !/^\d{6}$/.test(pin))
      return false;
    const candidate = await digest(pin, credential.salt);
    const correct = candidate === credential.hash;
    if (correct) {
      setFailures(0);
      setLockedUntil(0);
    } else {
      const attempts = failures + 1;
      setFailures(attempts >= 5 ? 0 : attempts);
      if (attempts >= 5) setLockedUntil(Date.now() + 30000);
    }
    return correct;
  }
  async function savePin(pin: string, current: string) {
    if (credential && !(await verifyPin(current)))
      throw new Error(
        "The current PIN is incorrect or temporarily locked. Try again.",
      );
    if (pin && !/^\d{6}$/.test(pin))
      throw new Error("Use exactly six numbers for your PIN.");
    const next = pin
      ? { salt: hex(crypto.getRandomValues(new Uint8Array(16))), hash: "" }
      : null;
    if (next) next.hash = await digest(pin, next.salt);
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch {
      throw new Error(
        "Security settings could not be saved on this device. Your previous PIN was kept.",
      );
    }
    setCredential(next);
    setFailures(0);
    setLockedUntil(0);
  }
  return { hasPin: !!credential, verifyPin, savePin, pinLockedUntil };
}
