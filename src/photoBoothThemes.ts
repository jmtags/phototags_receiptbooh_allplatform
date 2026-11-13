import { useMemo, useState } from "react";
import { useEventThemes } from "./eventThemes";
import { image, type Template } from "./receipt";

export type PhotoLayoutName = "double" | "rows" | "grid";
export function photoFrames(layout: PhotoLayoutName): NonNullable<Template["frames"]> {
  if (layout === "double") return [0, 1].flatMap(strip => [0, 1, 2, 3].map(photo => ({ photo, left: .055 + strip * .46, top: .12 + photo * .19, width: .43, height: .175 })));
  if (layout === "rows") return [0, 1, 2, 3].map(photo => ({ photo, left: .055, top: .12 + photo * .19, width: .89, height: .175 }));
  return [0, 1, 2, 3].map(photo => ({ photo, left: .055 + (photo % 2) * .46, top: .14 + Math.floor(photo / 2) * .36, width: .43, height: .33 }));
}
const designs: [string, string, PhotoLayoutName, string, string][] = [
  ["double_strip", "Double strip", "double", "#ffffff", "#172339"],
  ["story_rows", "Story rows", "rows", "#f4efe7", "#49382c"],
  ["spotlight", "Spotlight grid", "grid", "#182133", "#f0d595"],
  ["candy_pop", "Candy pop", "grid", "#f7d9e8", "#8b3f88"],
  ["sweet_hearts", "Sweet hearts", "double", "#fff0f3", "#b13c5b"],
  ["party_burst", "Party burst", "grid", "#d6f4ee", "#125a62"],
];
export const photoBoothBuiltins: Template[] = designs.map(([id, name, layout, bg, ink]) => ({
  id: `photo_${id}`, name, description: layout === "double" ? "Two matching four-photo strips" : layout === "rows" ? "Four moments in story rows" : "Four-photo 4 × 6 keepsake",
  area: [0, 0, 1, 1], frames: photoFrames(layout),
  artwork: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800" viewBox="0 0 1200 1800"><rect width="1200" height="1800" fill="${bg}"/><g fill="${ink}" font-family="sans-serif" text-anchor="middle"><text x="600" y="115" font-size="48" font-weight="bold">${name.toUpperCase()}</text><text x="600" y="1680" font-size="30">FOUR MOMENTS. ONE MEMORY.</text><text x="600" y="1730" font-size="20">PHOTOTAGS LRB</text></g></svg>`),
}));

function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; } }
export function usePhotoBoothThemes() {
  const library = useEventThemes("photo");
  const [hidden, setHidden] = useState<Record<string, string[]>>(() => {
    const value = read<Record<string, unknown>>("photoBoothHiddenThemes", {});
    return Object.fromEntries(Object.entries(value).filter(([, ids]) => Array.isArray(ids) && ids.every(id => typeof id === "string"))) as Record<string, string[]>;
  });
  const [defaults, setDefaults] = useState<Record<string, string>>(() => {
    const value = read<Record<string, unknown>>("photoBoothDefaultThemes", {});
    return Object.fromEntries(Object.entries(value).filter(([, id]) => typeof id === "string")) as Record<string, string>;
  });
  const themes = useMemo(() => [...photoBoothBuiltins, ...library.eventThemes.filter(t => !library.activeEvent || t.event === library.activeEvent)], [library.eventThemes, library.activeEvent]);
  const eventHidden = Object.hasOwn(hidden, library.activeEvent) ? hidden[library.activeEvent] : [];
  const selected = themes.filter(t => !eventHidden.includes(t.id));
  const availableThemes = selected.length ? selected : [themes[0]];
  const defaultId = Object.hasOwn(defaults, library.activeEvent) ? defaults[library.activeEvent] : "";
  const defaultTheme = availableThemes.find(t => t.id === defaultId) || availableThemes[0];
  function setVisible(id: string, visible: boolean) {
    if (!visible && availableThemes.length <= 1 && availableThemes.some(t => t.id === id)) throw new Error("Keep at least one PhotoBooth theme visible.");
    const ids = eventHidden, next = { ...hidden, [library.activeEvent]: visible ? ids.filter(i => i !== id) : [...new Set([...ids, id])] };
    localStorage.setItem("photoBoothHiddenThemes", JSON.stringify(next)); setHidden(next);
  }
  function setDefault(id: string) {
    if (!availableThemes.some(t => t.id === id)) throw new Error("Choose a visible theme first.");
    const next = { ...defaults, [library.activeEvent]: id };
    localStorage.setItem("photoBoothDefaultThemes", JSON.stringify(next)); setDefaults(next);
  }
  return { ...library, themes, availableThemes, defaultTheme, setVisible, setDefault };
}

export async function createPhotoBoothArtwork(event: string, headline: string, footer: string, background: string, ink: string, upload: string) {
  const c = document.createElement("canvas"); c.width = 1200; c.height = 1800;
  const ctx = c.getContext("2d")!; ctx.fillStyle = background; ctx.fillRect(0, 0, c.width, c.height);
  if (upload) { const img = await image(upload), scale = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight); ctx.drawImage(img, (c.width - img.naturalWidth * scale) / 2, (c.height - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale); }
  ctx.textAlign = "center"; ctx.fillStyle = ink; ctx.font = "bold 46px sans-serif"; ctx.fillText(headline, 600, 105, 1080);
  ctx.font = "26px sans-serif"; ctx.fillText(event, 600, 162, 1080); ctx.fillText(footer, 600, 1710, 1080);
  return c.toDataURL("image/png");
}
