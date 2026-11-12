import { useState, type CSSProperties } from "react";

export const defaultBranding = {
  name: "PhotoTags LRB",
  tagline: "Your moment, made to keep.",
  headline: "Good times start here.",
  message: "A photo, a little personality, and a receipt to keep.",
  startLabel: "Start",
  accent: "#3158e8",
  logo: "",
  background: "",
};
export type Branding = typeof defaultBranding;
export const brandingKey = "phototags-kiosk-branding-v1";
export function cleanBranding(value: Partial<Branding>): Branding {
  const text = (key: keyof Branding, max: number, required = false) => {
    const input =
      typeof value[key] === "string"
        ? value[key].trim().slice(0, max)
        : defaultBranding[key];
    return required && !input ? defaultBranding[key] : input;
  };
  return {
    name: text("name", 48, true),
    tagline: text("tagline", 90),
    headline: text("headline", 90, true),
    message: text("message", 220),
    startLabel: text("startLabel", 28, true),
    accent:
      typeof value.accent === "string" && /^#[0-9a-f]{6}$/i.test(value.accent)
        ? value.accent
        : defaultBranding.accent,
    logo:
      typeof value.logo === "string" &&
      value.logo.length < 2_000_000 &&
      /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value.logo)
        ? value.logo
        : "",
    background:
      typeof value.background === "string" &&
      value.background.length < 1_500_000 &&
      /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(
        value.background,
      )
        ? value.background
        : "",
  };
}
export function welcomeBackground(branding: Branding): CSSProperties {
  return branding.background
    ? {
        backgroundImage: `linear-gradient(rgba(10, 14, 25, .76), rgba(10, 14, 25, .76)), url("${branding.background}")`,
      }
    : {};
}
function loadBranding(): Branding {
  try {
    const stored = JSON.parse(localStorage.getItem(brandingKey) || "null");
    if (!stored || typeof stored !== "object") return { ...defaultBranding };
    const branding=cleanBranding(stored);
    const oldDefaults=branding.name==="PhotoTags"&&Object.entries(defaultBranding).every(([key,value])=>key==="name"||branding[key as keyof Branding]===value);
    if(oldDefaults)branding.name=defaultBranding.name;
    return branding;
  } catch {
    return { ...defaultBranding };
  }
}
export function useBranding() {
  const [branding, setBranding] = useState(loadBranding);
  function saveBranding(value: Branding) {
    const next = cleanBranding(value);
    try {
      localStorage.setItem(brandingKey, JSON.stringify(next));
    } catch {
      throw new Error(
        "Branding could not be saved on this device. Free some browser storage or allow site storage, then try again. Your previous branding is still active.",
      );
    }
    setBranding(next);
    return next;
  }
  return { branding, saveBranding };
}
export function accentInk(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}
export function brandStyle(branding: Branding): CSSProperties {
  return {
    "--brand-accent": branding.accent,
    "--brand-on-accent": accentInk(branding.accent),
  } as CSSProperties;
}
