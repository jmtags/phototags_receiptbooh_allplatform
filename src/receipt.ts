export type Profile = "deli" | "g80";
export type PhotoLayout = "portrait" | "square";
export type ShotCount = 1 | 2 | 3 | 4;
export type PhotoPlacement = {
  zoom: number;
  mirror: boolean;
  x: number;
  y: number;
  rotation?: number;
};
export type ReceiptSticker = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
};
export type SignatureStroke = {
  id: string;
  points: { x: number; y: number }[];
  width: number;
};
export type ReceiptContent = {
  color?: boolean;
  photos: (string | null)[];
  placements: PhotoPlacement[];
  shotCount: ShotCount;
  stickers: ReceiptSticker[];
  strokes: SignatureStroke[];
};
export const defaultPlacement = (): PhotoPlacement => ({
  zoom: 1,
  mirror: false,
  x: 0,
  y: 0,
  rotation: 0,
});
export const profiles = {
  deli: { name: "Deli ES423", width: 384, mm: 48 },
  g80: { name: "VOZY G80 · 80 mm", width: 576, mm: 72 },
} as const;
export const templates = [
  {
    id: "super_snap",
    name: "Super Snap",
    description: "A little main-character energy.",
    area: [0.112, 0.328, 0.888, 0.802],
  },
  {
    id: "snap_hero",
    name: "Snap Hero",
    description: "Your everyday superhero.",
    area: [0.079, 0.163, 0.925, 0.563],
  },
  {
    id: "phototags_times",
    name: "PhotoTags Times",
    description: "A moment worth the headlines.",
    area: [0.052, 0.379, 0.95, 0.708],
  },
  {
    id: "wanted",
    name: "Wanted",
    description: "Wanted for making memories.",
    area: [0.073, 0.263, 0.927, 0.731],
  },
  {
    id: "fashion",
    name: "Fashion",
    description: "Your very own cover moment.",
    area: [0.058, 0.242, 0.943, 0.76],
  },
] as const;
export type Template = {
  id: string;
  name: string;
  description: string;
  area: readonly [number, number, number, number];
  artwork?: string;
  event?: string;
  frames?: readonly { photo: number; left: number; top: number; width: number; height: number }[];
};
export const artwork = (t: Template) =>
  t.artwork || `/assets/receipt_design_${t.id}.webp`;
export function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "A local image is missing or unreadable. Go online and prepare offline files again.",
        ),
      );
    img.src = src;
  });
}
export function photoSlots(
  template: Template,
  width: number,
  height: number,
  count: ShotCount = 1,
  layout: PhotoLayout = "portrait",
) {
  if (template.frames) return template.frames.map(frame => ({ x: frame.left * width, y: frame.top * height, w: frame.width * width, h: frame.height * height, photo: frame.photo }));
  const [l, t, r, b] = template.area,
    inset = Math.max(2, width * 0.006),
    gap = Math.max(5, width * 0.018);
  const x = l * width + inset,
    y = t * height + inset,
    w = (r - l) * width - 2 * inset,
    h = (b - t) * height - 2 * inset;
  let boxes: { x: number; y: number; w: number; h: number }[];
  if (count === 2)
    boxes = [
      { x, y, w, h: (h - gap) / 2 },
      { x, y: y + (h + gap) / 2, w, h: (h - gap) / 2 },
    ];
  else if (count === 3) {
    const split = h * 0.56;
    boxes = [
      { x, y, w, h: split - gap / 2 },
      { x, y: y + split + gap / 2, w: (w - gap) / 2, h: h - split - gap / 2 },
      {
        x: x + (w + gap) / 2,
        y: y + split + gap / 2,
        w: (w - gap) / 2,
        h: h - split - gap / 2,
      },
    ];
  } else if (count === 4)
    boxes = [0, 1, 2, 3].map((i) => ({
      x: x + ((i % 2) * (w + gap)) / 2,
      y: y + (Math.floor(i / 2) * (h + gap)) / 2,
      w: (w - gap) / 2,
      h: (h - gap) / 2,
    }));
  else boxes = [{ x, y, w, h }];
  return boxes.map((box, photo) => {
    if (layout !== "square") return { ...box, photo };
    const side = Math.min(box.w, box.h);
    return {
      x: box.x + (box.w - side) / 2,
      y: box.y + (box.h - side) / 2,
      w: side,
      h: side,
      photo,
    };
  });
}
export async function compose(
  template: Template,
  photo: string | null,
  profile: Profile,
  zoom = 1,
  mirror = false,
  layout: PhotoLayout = "portrait",
  content?: ReceiptContent,
  outputWidth: number = profiles[profile].width,
) {
  const bg = await image(artwork(template));
  const c = document.createElement("canvas");
  c.width = Math.max(1,Math.min(1600,Math.round(outputWidth)));
  c.height = Math.round((c.width * bg.naturalHeight) / bg.naturalWidth);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bg, 0, 0, c.width, c.height);
  const [l, t, r, b] = template.area;
  const inset = Math.max(2, c.width * 0.006);
  ctx.fillStyle = "#fff";
  if (!template.frames) ctx.fillRect(
    l * c.width,
    t * c.height,
    (r - l) * c.width,
    (b - t) * c.height,
  );
  const photos = content?.photos ?? [photo],
    slots = photoSlots(
      template,
      c.width,
      c.height,
      content?.shotCount ?? 1,
      layout,
    );
  for (let index = 0; index < slots.length; index++) {
    const { x, y, w, h } = slots[index],
      placement = content?.placements[slots[index].photo] ?? { zoom, mirror, x: 0, y: 0 },
      src = photos[slots[index].photo];
    if (src) {
      const img = await image(src);
      const rotation = ((placement.rotation ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rotation),
        sin = Math.sin(rotation);
      // Cover the slot in the photo's rotated coordinate system, so twisting
      // never exposes empty corners or draws outside the existing photo frame.
      const coverW = w * Math.abs(cos) + h * Math.abs(sin);
      const coverH = w * Math.abs(sin) + h * Math.abs(cos);
      const scale =
        Math.max(coverW / img.naturalWidth, coverH / img.naturalHeight) *
        placement.zoom;
      const limitX = Math.max(0, (img.naturalWidth * scale - coverW) / 2);
      const limitY = Math.max(0, (img.naturalHeight * scale - coverH) / 2);
      const localX = Math.max(
        -limitX,
        Math.min(limitX, placement.x * w * cos + placement.y * h * sin),
      );
      const localY = Math.max(
        -limitY,
        Math.min(limitY, -placement.x * w * sin + placement.y * h * cos),
      );
      const dx = localX * cos - localY * sin,
        dy = localX * sin + localY * cos;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.translate(x + w / 2 + dx, y + h / 2 + dy);
      ctx.rotate(rotation);
      if (placement.mirror) ctx.scale(-1, 1);
      ctx.drawImage(
        img,
        (-img.naturalWidth * scale) / 2,
        (-img.naturalHeight * scale) / 2,
        img.naturalWidth * scale,
        img.naturalHeight * scale,
      );
      ctx.restore();
    } else {
      ctx.fillStyle = "#f6f3f5";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#666";
      ctx.font = `${Math.round(Math.min(c.width * 0.037, w * 0.11))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        slots.length === 1 ? "YOUR MOMENT HERE" : `PHOTO ${slots[index].photo + 1}`,
        x + w / 2,
        y + h / 2,
      );
    }
    ctx.strokeStyle = "#000";
    ctx.lineWidth = Math.max(2, c.width * 0.006);
    ctx.strokeRect(x, y, w, h);
  }
  if (content) {
    // Only added stickers are decoded; the rest of the catalog stays in the browser cache.
    for (const sticker of content.stickers) {
      const img = await image(`/stickers/${sticker.assetId}.webp`),
        w = sticker.size * c.width,
        h = (w * img.naturalHeight) / img.naturalWidth;
      ctx.save();
      ctx.translate(sticker.x * c.width, sticker.y * c.height);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of content.strokes) {
      if (stroke.points.length < 2) continue;
      ctx.lineWidth = stroke.width * c.width;
      ctx.beginPath();
      stroke.points.forEach((p, i) =>
        i
          ? ctx.lineTo(p.x * c.width, p.y * c.height)
          : ctx.moveTo(p.x * c.width, p.y * c.height),
      );
      ctx.stroke();
    }
  }
  if (content?.color === false) {
    const pixels = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const gray = Math.round(pixels.data[i] * 0.2126 + pixels.data[i + 1] * 0.7152 + pixels.data[i + 2] * 0.0722);
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  return c;
}
// Ported from Android ThermalEscPosJob and G80PhotoRaster. One byte per black/white pixel.
export function monochrome(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  profile: Profile,
  gamma = profile === "g80" ? 1.5 : 1,
) {
  if (
    rgba.length !== width * height * 4 ||
    width < 1 ||
    height < 1 ||
    height > 65535
  )
    throw new Error("Invalid raster dimensions");
  const black = new Uint8Array(width * height);
  let errors = new Float64Array(width + 2),
    next = new Float64Array(width + 2);
  for (let y = 0; y < height; y++) {
    const direction = profile === "g80" && y % 2 ? -1 : 1;
    for (let i = 0; i < width; i++) {
      const x = direction === 1 ? i : width - 1 - i,
        p = (y * width + x) * 4,
        a = rgba[p + 3];
      const gray = Math.floor(
        (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000,
      );
      const composited =
        profile === "g80"
          ? Math.floor((gray * a + 255 * (255 - a) + 127) / 255)
          : a < 128
            ? 255
            : gray;
      const adjusted =
        gamma === 1 ? composited : 255 * Math.pow(composited / 255, 1 / gamma);
      const value = Math.max(0, Math.min(255, adjusted + errors[x + 1]));
      const ink =
        profile === "g80"
          ? composited === 0 || (composited !== 255 && value < 127.5)
          : value < 148;
      black[y * width + x] = ink ? 1 : 0;
      const error =
        profile === "g80" && (composited === 0 || composited === 255)
          ? 0
          : value - (ink ? 0 : 255);
      errors[x + direction + 1] += (error * 7) / 16;
      next[x - direction + 1] += (error * 3) / 16;
      next[x + 1] += (error * 5) / 16;
      next[x + direction + 1] += error / 16;
    }
    [errors, next] = [next, errors];
    next.fill(0);
  }
  return black;
}
export function encode(
  black: Uint8Array,
  width: number,
  height: number,
  profile: Profile,
) {
  if (
    width !== profiles[profile].width ||
    height < 1 ||
    height > 65535 ||
    black.length !== width * height
  )
    throw new Error("Profile/raster mismatch");
  const out: number[] = [27, 64, 27, 97, 1];
  if (profile === "g80") {
    const stride = Math.ceil(width / 8);
    out.push(
      29,
      118,
      48,
      0,
      stride & 255,
      stride >> 8,
      height & 255,
      height >> 8,
    );
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x += 8) {
        let byte = 0;
        for (let b = 0; b < 8; b++)
          if (black[y * width + x + b]) byte |= 128 >> b;
        out.push(byte);
      }
  } else {
    out.push(27, 51, 24);
    for (let y = 0; y < height; y += 24) {
      out.push(27, 42, 33, width & 255, width >> 8);
      for (let x = 0; x < width; x++)
        for (let band = 0; band < 3; band++) {
          let byte = 0;
          for (let b = 0; b < 8; b++) {
            const py = y + band * 8 + b;
            if (py < height && black[py * width + x]) byte |= 128 >> b;
          }
          out.push(byte);
        }
      out.push(10);
    }
  }
  out.push(27, 50, 10, 10, 10, 29, 86, 66, 0);
  return new Uint8Array(out);
}
export function thermal(
  canvas: HTMLCanvasElement,
  profile: Profile,
  gamma: number,
) {
  const { width, height } = canvas,
    ctx = canvas.getContext("2d")!;
  const bits = monochrome(
    ctx.getImageData(0, 0, width, height).data,
    width,
    height,
    profile,
    gamma,
  );
  const preview = document.createElement("canvas");
  preview.width = width;
  preview.height = height;
  const target = preview.getContext("2d")!,
    data = target.createImageData(width, height);
  for (let i = 0; i < bits.length; i++) {
    const v = bits[i] ? 0 : 255;
    data.data.set([v, v, v, 255], i * 4);
  }
  target.putImageData(data, 0, 0);
  return { preview, bytes: encode(bits, width, height, profile) };
}
export function download(data: Blob | string, name: string) {
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  if (typeof data !== "string")
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function printerTestPhoto() {
  const logo = await image("/assets/logo.png");
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 800;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 600, 800);
  ctx.drawImage(logo, 100, 15, 400, 400);
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText("PRINTER TEST", 300, 470);
  ctx.font = "20px sans-serif";
  ctx.fillText("CHECK WIDTH · TONE · FEED", 300, 510);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgb(${i * 23},${i * 23},${i * 23})`;
    ctx.fillRect(60 + i * 40, 550, 40, 100);
  }
  ctx.fillStyle = "black";
  ctx.font = "16px sans-serif";
  ctx.fillText("TEST ARTWORK · NOT PRINT PROOF", 300, 710);
  return c.toDataURL("image/png");
}
