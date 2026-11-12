import { useEffect, useRef, useState } from "react";
import { canonicalKey, digest, encode64, verifyLightPermit, type LightPermit } from "./lightPermit";

export const lightLicensingEnabled = import.meta.env.VITE_LIGHT_LICENSING_ENABLED === "true";
const apiOrigin = import.meta.env.VITE_LIGHT_API_ORIGIN || "";
const publicKeyText = import.meta.env.VITE_LIGHT_PUBLIC_KEY_JWK || "";
type Identity = { id: string; privateKey: CryptoKey; publicKey: JsonWebKey; keyHash: string };
export type LightPlan = { id: string; name: string; amount: number; currency: string; duration_days: number | null; max_installations: number };
export type LightPayment = { paymentId: string; status: string; planId?: string; amount?: number; currency?: string; reference?: string; qrImageUrl?: string; expiresAt?: string; checkoutUrl?: string };
type Reply = Partial<LightPayment> & { ok: boolean; status?: string; permit?: string | null; challenge?: string; plans?: LightPlan[]; checkoutUrl?: string; paymentId?: string };
const DB = "phototags-light-license";
async function storage<T>(key: string, value?: T): Promise<T | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("values");
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction("values", value === undefined ? "readonly" : "readwrite");
      const request = value === undefined ? tx.objectStore("values").get(key) : tx.objectStore("values").put(value, key);
      tx.oncomplete = () => resolve(value === undefined ? request.result : value);
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error("License storage unavailable."));
    });
  } finally { db.close(); }
}
let identityPromise: Promise<Identity> | undefined;
async function validateIdentity(identity: Identity): Promise<Identity> {
  if (!identity.privateKey || identity.privateKey.type !== "private" || identity.privateKey.extractable ||
      identity.keyHash !== await digest(JSON.stringify(canonicalKey(identity.publicKey)))) throw new Error("This installation's saved license identity is damaged. Ask your host for recovery.");
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, identity.privateKey, nonce);
  const publicKey = await crypto.subtle.importKey("jwk", canonicalKey(identity.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signature, nonce)) throw new Error("The license identity does not match this installation's private key.");
  return identity;
}
export function installationIdentity(): Promise<Identity> {
  // Cross-tab initialization uses an atomic add; all tabs subsequently use the winner's key.
  return identityPromise ||= (async () => {
    const existing = await storage<Identity>("identity");
    if (existing) return validateIdentity(existing);
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    const publicKey = canonicalKey(await crypto.subtle.exportKey("jwk", pair.publicKey));
    const candidate: Identity = { id: crypto.randomUUID(), privateKey: pair.privateKey, publicKey, keyHash: await digest(JSON.stringify(publicKey)) };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(DB, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("values", "readwrite"), store = tx.objectStore("values");
      const get = store.get("identity"); get.onsuccess = () => { if (!get.result) store.add(candidate, "identity"); };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }).finally(() => db.close());
    return validateIdentity((await storage<Identity>("identity"))!);
  })().catch(error => { identityPromise = undefined; throw error; });
}
class ApiError extends Error { constructor(public code: string, public httpStatus: number) { super(code === "light_inline_qr_not_configured" ? "In-app QR payments need a Light service database update. Ask your host to finish setup." : code.replace(/_/g, " ")); } }
async function api(route: string, body?: object): Promise<Reply> {
  if (!apiOrigin) throw new Error("Light license service is not configured. Ask your host to finish setup.");
  const origin = new URL(apiOrigin);
  if (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1") throw new Error("License server must use HTTPS.");
  const response = await fetch(`${origin.origin}/api/light?route=${route}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new ApiError(result.status || "license_server_unavailable", response.status);
  return result;
}
async function authenticated(action: string, identity: Identity, data: object): Promise<Reply> {
  const result = await api("challenge", { installationId: identity.id, publicKey: identity.publicKey, action, bodyHash: await digest(JSON.stringify(data)) });
  if (!result.challenge) throw new Error("License challenge unavailable.");
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, identity.privateKey, new TextEncoder().encode(result.challenge));
  return api(action, { installationId: identity.id, data, auth: { publicKey: identity.publicKey, challenge: result.challenge, signature: encode64(signature) } });
}
export function useLightLicense() {
  const [identity, setIdentity] = useState<Identity>();
  const [claims, setClaims] = useState<LightPermit>();
  const [message, setMessage] = useState(lightLicensingEnabled ? "Checking this installation's license..." : "Licensing is not enabled on this deployment.");
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(!lightLicensingEnabled);
  const [plans, setPlans] = useState<LightPlan[]>([]);
  const [plansError, setPlansError] = useState("");
  const [payment, setPayment] = useState<LightPayment>();
  const [completedPayment, setCompletedPayment] = useState("");
  const [pendingPaymentId, setPendingPaymentId] = useState(() => {
    try { return new URL(location.href).searchParams.get("light_payment") || localStorage.getItem("phototags.light.payment") || ""; } catch { return ""; }
  });
  const [name, setName] = useState(() => { try { return localStorage.getItem("phototags.light.name") || "My PhotoTags Light booth"; } catch { return "My PhotoTags Light booth"; } });
  const [tick, setTick] = useState(Date.now());
  const latest = useRef(0), claimsRef = useRef<LightPermit | undefined>(undefined), inFlight = useRef(false);
  const trustedUntil = useRef(0);
  function valid() {
    return !lightLicensingEnabled || !!claimsRef.current && Date.now() < claimsRef.current.exp * 1000 &&
      Date.now() >= trustedUntil.current - 300000;
  }
  function metadata() { return { name, platform: /iPad|iPhone/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 ? "iOS/iPadOS" : navigator.platform || "Web" }; }
  async function accept(result: Reply, id: Identity) {
    if (result.permit) {
      const p = await verifyLightPermit(result.permit, JSON.parse(publicKeyText), id.id, id.keyHash);
      await storage("permit", result.permit);
      trustedUntil.current = Date.now(); await storage("lastClock", trustedUntil.current);
      claimsRef.current = p; setClaims(p); setMessage("License active. Offline permit saved on this installation.");
    } else if (result.status === "unlicensed") {
      await storage("permit", ""); claimsRef.current = undefined; setClaims(undefined); setMessage("Activate a PhotoTags Light license to launch this booth.");
    }
  }
  async function run(action: string, data: object = {}) {
    if (!lightLicensingEnabled || inFlight.current) return;
    inFlight.current = true;
    const generation = ++latest.current; setBusy(true);
    try {
      if (!publicKeyText) throw new Error("Light license verification key is not configured. Ask your host to finish setup.");
      const id = identity || await installationIdentity(); setIdentity(id);
      const result = await authenticated(action, id, { ...metadata(), ...data });
      if (generation === latest.current) {
        await accept(result, id);
        if (result.paymentId && result.status) setPayment(previous => ({ ...previous, ...result, paymentId: result.paymentId!, status: result.status! }));
      }
      return result;
    } catch (error) {
      if (generation !== latest.current) return;
      if (error instanceof ApiError && ["installation_blocked", "installation_key_mismatch", "invalid_installation_proof"].includes(error.code)) {
        await storage("permit", ""); claimsRef.current = undefined; setClaims(undefined);
      }
      setMessage(`${(error as Error).message}${valid() ? " Your saved offline permit remains usable until its expiry." : ""}`);
      return { ok: false, status: error instanceof ApiError ? error.code : "license_request_failed" } satisfies Reply;
    } finally { inFlight.current = false; if (generation === latest.current) { setBusy(false); setLoaded(true); setTick(Date.now()); } }
  }
  async function refresh() {
    const paymentId = new URL(location.href).searchParams.get("light_payment") || localStorage.getItem("phototags.light.payment");
    if (paymentId) {
      const r = await run("payment-status", { paymentId });
      if (r?.status === "licensed" && r.permit) {
        localStorage.removeItem("phototags.light.payment");
        setPendingPaymentId(""); setPayment(undefined); setCompletedPayment(paymentId);
        const url = new URL(location.href); url.searchParams.delete("light_payment"); history.replaceState(null, "", url);
      } else if (r?.status === "failed") {
        localStorage.removeItem("phototags.light.payment"); setPendingPaymentId("");
        setMessage("This payment was cancelled. You can generate a new QR code.");
      }
      if (r && r.status !== "licensed" && !claimsRef.current) await run("check");
      return r;
    }
    return run("check");
  }
  useEffect(() => {
    if (!lightLicensingEnabled) return;
    let alive = true;
    void (async () => {
      try {
        const id = await installationIdentity(); if (!alive) return; setIdentity(id);
        trustedUntil.current = await storage<number>("lastClock") || 0;
        const saved = await storage<string>("permit");
        if (saved && publicKeyText) {
          try {
            const p = await verifyLightPermit(saved, JSON.parse(publicKeyText), id.id, id.keyHash);
            if (validClock()) { claimsRef.current = p; setClaims(p); setMessage("Using this installation's saved offline license permit."); }
          } catch { setMessage("Your offline permit needs an online license check."); }
        }
        setLoaded(true);
        if (navigator.onLine) await refresh();
      } catch (e) { if (alive) { setMessage((e as Error).message); setLoaded(true); } }
    })();
    function validClock() { return Date.now() >= trustedUntil.current - 300000; }
    const clock = setInterval(() => {
      if (!validClock()) { claimsRef.current = undefined; setClaims(undefined); setMessage("The device clock changed. Connect and check your license."); }
      else { trustedUntil.current = Math.max(trustedUntil.current, Date.now()); void storage("lastClock", trustedUntil.current).catch(() => {}); }
      setTick(Date.now());
    }, 10000);
    return () => { alive = false; clearInterval(clock); latest.current++; };
  }, []);
  useEffect(() => {
    if (!lightLicensingEnabled) return;
    const online = () => { void refresh(); };
    window.addEventListener("online", online);
    const timer = setInterval(() => { if (navigator.onLine) void refresh(); }, 15 * 60000);
    return () => { window.removeEventListener("online", online); clearInterval(timer); };
  }, [identity, name]);
  async function loadPlans() {
    try { setPlans((await api("plans")).plans || []); setPlansError(""); } catch (e) { setPlansError(`Could not load Light plans: ${(e as Error).message}`); }
  }
  useEffect(() => {
    if (!lightLicensingEnabled || !pendingPaymentId) return;
    const poll = () => { if (navigator.onLine && document.visibilityState === "visible") void refresh(); };
    const timer = setInterval(poll, 6000);
    window.addEventListener("focus", poll); document.addEventListener("visibilitychange", poll);
    return () => { clearInterval(timer); window.removeEventListener("focus", poll); document.removeEventListener("visibilitychange", poll); };
  }, [pendingPaymentId, identity, name]);
  async function checkout(planId: string, email: string, acceptedAgreement: boolean) {
    setCompletedPayment("");
    let result = await run("qr-checkout", { planId, email, acceptedAgreement });
    // During a staged rollout, preserve payment access on the previous service.
    // These failures occur before QR reservation/provider creation; never retry an uncertain creation.
    if (result && !result.ok && ["invalid_challenge_request", "light_route_not_found", "light_inline_qr_not_configured"].includes(result.status || "")) {
      const hosted = await run("checkout", { planId, email, acceptedAgreement });
      if (hosted?.checkoutUrl && hosted.paymentId) {
        const url = new URL(hosted.checkoutUrl);
        if (url.protocol !== "https:" || !url.hostname.endsWith(".paymongo.com")) { setMessage("Checkout address was rejected."); return; }
        result = { ...hosted, status: "hosted_pending" }; setPayment(result as LightPayment);
        setMessage("In-app QR setup is being completed. You can finish this payment using the PayMongo link below.");
      }
    }
    if (result?.paymentId) {
      localStorage.setItem("phototags.light.payment", result.paymentId); setPendingPaymentId(result.paymentId);
      if (result.status === "paid") await refresh();
      return result;
    }
  }
  return { enabled: lightLicensingEnabled, allowed: !lightLicensingEnabled || loaded && valid(), hasAccess: valid,
    loaded, busy, identityId: identity?.id || "", claims,
    message: claims && Date.now() >= claims.exp * 1000 ? "Your offline license permit has expired. Connect and check your license to continue." : message,
    name, plans, plansError, tick, payment, pendingPaymentId, completedPayment,
    beginActivation() { setCompletedPayment(""); },
    setName(value: string) { setName(value); localStorage.setItem("phototags.light.name", value); },
    refresh, activate: (licenseKey: string) => run("activate", { licenseKey: licenseKey.trim().toUpperCase() }), loadPlans, checkout };
}
export type LightLicenseModel = ReturnType<typeof useLightLicense>;
