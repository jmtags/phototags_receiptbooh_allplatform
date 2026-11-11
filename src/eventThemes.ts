import { useEffect, useState } from "react";
import type { Template } from "./receipt";

export type ThemeDesign = {
  headline: string;
  subtitle: string;
  footer: string;
  style: "classic" | "double" | "celebration";
  upload: string;
};
export type EventTheme = Template & {
  event: string;
  artwork: string;
  design: ThemeDesign;
  updatedAt: string;
};
export const newDesign = (): ThemeDesign => ({
  headline: "GOOD TIMES",
  subtitle: "One unforgettable moment",
  footer: "Thank you for celebrating with us",
  style: "double",
  upload: "",
});
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("phototags-event-themes", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("themes", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Event theme storage is unavailable on this device."));
  });
}
async function readThemes(): Promise<EventTheme[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("themes", "readonly"),
        request = transaction.objectStore("themes").getAll();
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () =>
        reject(
          transaction.error ||
            new Error("Event theme storage could not be read."),
        );
    });
  } finally {
    db.close();
  }
}
async function writeTheme(value: EventTheme | string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("themes", "readwrite"),
        store = transaction.objectStore("themes");
      if (typeof value === "string") store.delete(value);
      else store.put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          new Error(
            "The theme could not be saved. Check browser storage space and try again.",
          ),
        );
      transaction.onabort = () =>
        reject(
          new Error(
            "Theme storage was interrupted. Your previous library was kept.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
function valid(theme: EventTheme) {
  return (
    theme &&
    typeof theme.id === "string" &&
    theme.id.startsWith("event_") &&
    typeof theme.name === "string" &&
    typeof theme.event === "string" &&
    !!theme.design &&
    typeof theme.design.headline === "string" &&
    typeof theme.design.subtitle === "string" &&
    typeof theme.design.footer === "string" &&
    typeof theme.design.upload === "string" &&
    /^data:image\/(png|webp|jpeg);base64,/i.test(theme.artwork) &&
    Array.isArray(theme.area) &&
    theme.area.length === 4 &&
    theme.area.every(Number.isFinite) &&
    theme.area[0] >= 0 &&
    theme.area[1] >= 0 &&
    theme.area[2] <= 1 &&
    theme.area[3] <= 1 &&
    theme.area[2] > theme.area[0] &&
    theme.area[3] > theme.area[1]
  );
}
export function useEventThemes() {
  const [eventThemes, setEventThemes] = useState<EventTheme[]>([]),
    [themesLoading, setLoading] = useState(true),
    [themeError, setThemeError] = useState("");
  const [activeEvent, setActiveEventState] = useState(() => {
    try {
      return localStorage.getItem("activeEvent") || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    let active = true;
    readThemes()
      .then((themes) => {
        if (active) setEventThemes(themes.filter(valid));
      })
      .catch((e) => {
        if (active) setThemeError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  function setActiveEvent(value: string) {
    try {
      localStorage.setItem("activeEvent", value);
    } catch {
      throw new Error("The active event could not be saved on this device.");
    }
    setActiveEventState(value);
  }
  async function saveEventTheme(theme: EventTheme) {
    if (!valid(theme))
      throw new Error(
        "Check the theme artwork and photo placement before saving.",
      );
    await writeTheme(theme);
    setEventThemes((current) =>
      [...current.filter((t) => t.id !== theme.id), theme].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
  }
  async function deleteEventTheme(id: string) {
    await writeTheme(id);
    setEventThemes((current) => current.filter((t) => t.id !== id));
  }
  return {
    eventThemes,
    themesLoading,
    themeError,
    activeEvent,
    setActiveEvent,
    saveEventTheme,
    deleteEventTheme,
  };
}
function lines(context: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width && line) {
      result.push(line);
      line = word;
    } else line = next;
  }
  if (line) result.push(line);
  return result;
}
export function createThemeArtwork(design: ThemeDesign, event: string) {
  if (design.upload) return design.upload;
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 1843;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "black";
  ctx.fillStyle = "black";
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, 724, 1799);
  if (design.style === "double") ctx.strokeRect(34, 34, 700, 1775);
  if (design.style === "celebration") {
    for (let i = 0; i < 22; i++) {
      const y = 70 + i * 78;
      ctx.beginPath();
      ctx.arc(43, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(725, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.textAlign = "center";
  ctx.font = "700 24px sans-serif";
  ctx.fillText(event.toUpperCase(), 384, 99, 630);
  ctx.font = "700 58px Georgia, serif";
  const header = lines(ctx, design.headline, 620).slice(0, 3);
  header.forEach((line, i) => ctx.fillText(line, 384, 185 + i * 68, 630));
  ctx.font = "24px sans-serif";
  ctx.fillText(design.subtitle, 384, header.length * 68 + 165, 630);
  ctx.beginPath();
  ctx.moveTo(75, 410);
  ctx.lineTo(693, 410);
  ctx.stroke();
  ctx.font = "700 30px Georgia, serif";
  lines(ctx, design.footer, 610)
    .slice(0, 3)
    .forEach((line, i) => ctx.fillText(line, 384, 1625 + i * 42, 630));
  ctx.font = "18px sans-serif";
  ctx.fillText("A MOMENT TO KEEP", 384, 1765, 620);
  return c.toDataURL("image/png");
}
