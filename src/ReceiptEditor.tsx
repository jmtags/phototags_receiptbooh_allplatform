import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
  type CSSProperties,
} from "react";
import { Check, PenLine, Smile, X, Undo2 } from "lucide-react";
import {
  artwork,
  photoSlots,
  defaultPlacement,
  type PhotoPlacement,
  type ReceiptSticker,
} from "./receipt";
import { stickerCatalog, stickerCategories } from "./stickers";
import type { BoothModel } from "./useBooth";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const angle = (value: number) => ((((value + 180) % 360) + 360) % 360) - 180;
type Drag = {
  type: "photo" | "sticker";
  index: number;
  id: string;
  placement: PhotoPlacement;
  sticker: ReceiptSticker | null;
  currentPlacement: PhotoPlacement;
  currentSticker: ReceiptSticker | null;
  origin: { x: number; y: number };
  distance: number;
  angle: number;
};
export function ReceiptEditor({
  booth: b,
  chosen,
  onChoose,
}: {
  booth: BoothModel;
  chosen: boolean;
  onChoose: () => void;
}) {
  const [mode, setMode] = useState<"stickers" | "signature">("stickers"),
    [category, setCategory] = useState<string>("Hats"),
    [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState<{ x: number; y: number }[]>([]);
  const canvas = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    drawing = useRef<number | null>(null),
    points = useRef<{ x: number; y: number }[]>([]);
  const slots = photoSlots(
    b.template,
    b.receiptSize.width,
    b.receiptSize.height,
    b.shotCount,
    b.layout,
  );
  useEffect(() => {
    for (const id of pointers.current.keys()) {
      if (canvas.current?.hasPointerCapture(id))
        canvas.current.releasePointerCapture(id);
    }
    pointers.current.clear();
    drag.current = null;
    drawing.current = null;
    points.current = [];
    setDraft([]);
  }, [mode, b.template.id]);
  function metrics() {
    const ps = [...pointers.current.values()];
    const first = ps[0],
      second = ps[1] ?? first;
    return {
      origin: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      distance: Math.hypot(second.x - first.x, second.y - first.y),
      angle:
        (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI,
    };
  }
  function rebase() {
    const d = drag.current;
    if (!d || !pointers.current.size) return;
    Object.assign(d, metrics(), {
      placement: { ...d.currentPlacement },
      sticker: d.currentSticker ? { ...d.currentSticker } : null,
    });
  }
  function point(e: ReactPointerEvent) {
    const rect = canvas.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    };
  }
  function down(
    e: ReactPointerEvent<HTMLElement>,
    type: "photo" | "sticker",
    index: number,
    id = "",
  ) {
    if (b.busy || b.job || pointers.current.size >= 2) return;
    e.preventDefault();
    e.stopPropagation();
    canvas.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag.current) {
      if (type === "photo") {
        b.selectPhoto(index);
        setSelected(null);
      } else setSelected(id);
      const sticker = b.stickers.find((s) => s.id === id);
      drag.current = {
        type,
        index,
        id,
        placement: { ...b.placements[index] },
        currentPlacement: { ...b.placements[index] },
        sticker: sticker ? { ...sticker } : null,
        currentSticker: sticker ? { ...sticker } : null,
        ...metrics(),
      };
    }
    rebase();
  }
  function move(e: ReactPointerEvent) {
    if (b.busy || b.job) return;
    if (drawing.current === e.pointerId) {
      if (points.current.length < 2000) {
        points.current.push(point(e));
        setDraft([...points.current]);
      }
      return;
    }
    const d = drag.current;
    if (!d || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = canvas.current!.getBoundingClientRect();
    const current = metrics();
    const dx = current.origin.x - d.origin.x,
      dy = current.origin.y - d.origin.y;
    const scale =
      pointers.current.size === 2 && d.distance > 1
        ? current.distance / d.distance
        : 1;
    const turn =
      pointers.current.size === 2 && d.distance > 1
        ? angle(current.angle - d.angle)
        : 0;
    if (d.type === "sticker" && d.sticker) {
      d.currentSticker = {
        ...d.sticker,
        x: clamp(d.sticker.x + dx / rect.width, 0.02, 0.98),
        y: clamp(d.sticker.y + dy / rect.height, 0.02, 0.98),
        size: clamp(d.sticker.size * scale, 0.08, 0.65),
        rotation: angle(d.sticker.rotation + turn),
      };
      b.updateSticker(d.id, d.currentSticker);
    } else {
      const slot = slots[d.index];
      d.currentPlacement = {
        ...d.placement,
        x: clamp(
          d.placement.x + dx / ((rect.width * slot.w) / b.receiptSize.width),
          -2,
          2,
        ),
        y: clamp(
          d.placement.y + dy / ((rect.height * slot.h) / b.receiptSize.height),
          -2,
          2,
        ),
        zoom: clamp(d.placement.zoom * scale, 1, 3),
        rotation: angle((d.placement.rotation ?? 0) + turn),
      };
      b.updatePlacement(d.index, d.currentPlacement);
    }
  }
  function end(e: ReactPointerEvent, cancel = false) {
    if (drawing.current === e.pointerId) {
      if (!cancel) b.addStroke(points.current);
      drawing.current = null;
      points.current = [];
      setDraft([]);
    }
    if (!pointers.current.delete(e.pointerId)) return;
    if (!pointers.current.size) drag.current = null;
    else rebase();
  }
  function photoKeys(e: KeyboardEvent, index: number) {
    if (b.busy || b.job) return;
    const p = b.placements[index];
    if (["+", "=", "-", "[", "]", "0", "m", "M"].includes(e.key)) {
      e.preventDefault();
      b.selectPhoto(index);
      if (e.key === "0") b.updatePlacement(index, defaultPlacement());
      else if (e.key.toLowerCase() === "m")
        b.updatePlacement(index, { mirror: !p.mirror });
      else if (e.key === "[" || e.key === "]")
        b.updatePlacement(index, {
          rotation: angle((p.rotation ?? 0) + (e.key === "[" ? -5 : 5)),
        });
      else
        b.updatePlacement(index, {
          zoom: clamp(p.zoom + (e.key === "-" ? -0.05 : 0.05), 1, 3),
        });
      return;
    }
    const delta = {
      ArrowLeft: [-0.03, 0],
      ArrowRight: [0.03, 0],
      ArrowUp: [0, -0.03],
      ArrowDown: [0, 0.03],
    }[e.key];
    if (!delta) return;
    e.preventDefault();
    b.selectPhoto(index);
    b.updatePlacement(index, {
      x: clamp(p.x + delta[0], -2, 2),
      y: clamp(p.y + delta[1], -2, 2),
    });
  }
  function stickerKeys(e: KeyboardEvent, id: string) {
    if (b.busy || b.job) return;
    const sticker = b.stickers.find((s) => s.id === id);
    if (!sticker) return;
    if (["+", "=", "-", "[", "]"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "[" || e.key === "]")
        b.updateSticker(id, {
          rotation: angle(sticker.rotation + (e.key === "[" ? -5 : 5)),
        });
      else
        b.updateSticker(id, {
          size: clamp(
            sticker.size + (e.key === "-" ? -0.01 : 0.01),
            0.08,
            0.65,
          ),
        });
      return;
    }
    const delta = {
      ArrowLeft: [-0.02, 0],
      ArrowRight: [0.02, 0],
      ArrowUp: [0, -0.02],
      ArrowDown: [0, 0.02],
    }[e.key];
    if (e.key === "Delete") {
      e.preventDefault();
      b.removeSticker(id);
      setSelected(null);
      return;
    }
    if (!delta) return;
    e.preventDefault();
    const s = b.stickers.find((v) => v.id === id)!;
    b.updateSticker(id, {
      x: clamp(s.x + delta[0], 0.02, 0.98),
      y: clamp(s.y + delta[1], 0.02, 0.98),
    });
  }
  return (
    <section className="decorate-editor" aria-label="Decorate your receipt">
      <p id="receipt-gesture-help" className="sr-only">
        Drag to move. Use two fingers to pinch to resize and twist to rotate.
        With keyboard focus, use arrow keys to move, plus or minus to resize,
        and square brackets to rotate. Press Delete to remove a sticker, or zero
        to reset a photo. Press M to mirror a photo.
      </p>
      <div
        className="decorate-tools"
        role="group"
        aria-label="Decoration tools"
      >
        <button
          className={mode === "stickers" ? "active" : ""}
          aria-pressed={mode === "stickers"}
          onClick={() => setMode("stickers")}
        >
          <Smile aria-hidden="true" size={25} />
          <span>Cute icons</span>
        </button>
        <button
          className={mode === "signature" ? "active" : ""}
          aria-pressed={mode === "signature"}
          onClick={() => {
            setMode("signature");
            setSelected(null);
          }}
        >
          <PenLine aria-hidden="true" size={25} />
          <span>Signature</span>
        </button>
      </div>
      {mode === "stickers" ? (
        <div className="sticker-library">
          <div className="sticker-library-heading">
            <label>
              Sticker category
              <select
                name="sticker-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {stickerCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <span>{b.stickers.length}/24 added</span>
          </div>
          <div
            className="sticker-strip"
            role="group"
            aria-label={`${category} stickers`}
          >
            {stickerCatalog
              .filter((s) => s.category === category)
              .map((s) => (
                <button
                  key={s.id}
                  aria-label={`Add ${s.name} sticker`}
                  title={s.name}
                  disabled={b.stickers.length >= 24}
                  onClick={() => {
                    const id = b.addSticker(s.id);
                    if (id) setSelected(id);
                  }}
                >
                  <img
                    src={s.src}
                    alt=""
                    width="44"
                    height="44"
                    loading="lazy"
                  />
                  <span>{s.name}</span>
                </button>
              ))}
          </div>
        </div>
      ) : (
        <div className="signature-toolbar">
          <p>Draw on the receipt to sign.</p>
          <button
            className="button button-secondary"
            disabled={!b.strokes.length}
            onClick={b.undoStroke}
          >
            <Undo2 aria-hidden="true" size={16} />
            Undo stroke
          </button>
          <button
            className="button button-quiet"
            disabled={!b.strokes.length}
            onClick={b.clearStrokes}
          >
            Clear signature
          </button>
        </div>
      )}
      <div className="decorate-workspace">
        <div
          className="decorate-themes"
          role="group"
          aria-label="Choose receipt theme"
        >
          {b.availableThemes.map((t) => (
            <button
              key={t.id}
              aria-label={t.event ? `${t.name} for ${t.event}` : t.name}
              className={chosen && b.template.id === t.id ? "selected" : ""}
              aria-pressed={chosen && b.template.id === t.id}
              onClick={() => {
                b.setTemplateId(t.id);
                onChoose();
              }}
            >
              <img src={artwork(t)} alt="" width="85" height="204" />
              <strong>{t.name}</strong>
              <span>
                {t.event ? `${t.event} · ${t.description}` : t.description}
              </span>
              {chosen && b.template.id === t.id && (
                <Check
                  className="theme-selected-mark"
                  aria-hidden="true"
                  size={15}
                />
              )}
            </button>
          ))}
        </div>
        <div className="decorate-preview-column">
          <div
            ref={canvas}
            className={`receipt-canvas ${mode === "signature" ? "signature-mode" : ""}`}
            style={
              {
                aspectRatio: `${b.receiptSize.width}/${b.receiptSize.height}`,
                "--receipt-ratio": b.receiptSize.width / b.receiptSize.height,
              } as CSSProperties
            }
            onPointerMove={move}
            onPointerUp={(e) => end(e)}
            onPointerCancel={(e) => end(e, true)}
            onLostPointerCapture={(e) => end(e, true)}
            onPointerDown={(e) => {
              if (mode !== "signature") {
                if (drag.current)
                  down(
                    e,
                    drag.current.type,
                    drag.current.index,
                    drag.current.id,
                  );
                return;
              }
              if (b.busy || b.job || drawing.current !== null) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              drawing.current = e.pointerId;
              points.current = [point(e)];
              setDraft([...points.current]);
            }}
          >
            {b.preview && (
              <img
                src={b.preview}
                alt="Your themed receipt preview"
                width={b.receiptSize.width}
                height={b.receiptSize.height}
                draggable={false}
              />
            )}
            {mode === "stickers" &&
              slots.map((slot, index) => (
                <button
                  key={index}
                  className={`photo-drag-handle ${b.activePhoto === index && !selected ? "selected" : ""}`}
                  aria-label={`Adjust photo ${index + 1}`}
                  aria-describedby="receipt-gesture-help"
                  onDoubleClick={() =>
                    !b.busy &&
                    !b.job &&
                    b.updatePlacement(index, defaultPlacement())
                  }
                  aria-pressed={b.activePhoto === index && !selected}
                  style={{
                    left: `${(slot.x / b.receiptSize.width) * 100}%`,
                    top: `${(slot.y / b.receiptSize.height) * 100}%`,
                    width: `${(slot.w / b.receiptSize.width) * 100}%`,
                    height: `${(slot.h / b.receiptSize.height) * 100}%`,
                  }}
                  onPointerDown={(e) => down(e, "photo", index)}
                  onKeyDown={(e) => photoKeys(e, index)}
                  onClick={(e) => {
                    if (e.detail === 0) {
                      b.selectPhoto(index);
                      setSelected(null);
                    }
                  }}
                >
                  <span>Photo {index + 1}</span>
                </button>
              ))}
            {mode === "stickers" &&
              b.stickers.map((s) => {
                const asset = stickerCatalog.find((v) => v.id === s.assetId)!;
                return (
                  <div
                    key={s.id}
                    className="sticker-placement"
                    style={{
                      left: `${s.x * 100}%`,
                      top: `${s.y * 100}%`,
                      width: `${s.size * 100}%`,
                      height: `${((s.size * b.receiptSize.width * asset.height) / asset.width / b.receiptSize.height) * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
                    }}
                  >
                    <button
                      className={`sticker-drag-handle ${selected === s.id ? "selected" : ""}`}
                      aria-label={`Move ${asset.name} sticker`}
                      aria-describedby="receipt-gesture-help"
                      aria-pressed={selected === s.id}
                      onPointerDown={(e) =>
                        down(e, "sticker", b.activePhoto, s.id)
                      }
                      onKeyDown={(e) => stickerKeys(e, s.id)}
                      onClick={(e) => {
                        if (e.detail === 0) setSelected(s.id);
                      }}
                    />
                    <button
                      className="sticker-remove-x"
                      disabled={b.busy || !!b.job}
                      style={{ transform: `rotate(${-s.rotation}deg)` }}
                      aria-label={`Remove ${asset.name} sticker`}
                      title={`Remove ${asset.name} sticker`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        b.removeSticker(s.id);
                        if (selected === s.id) setSelected(null);
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            {!!draft.length && (
              <svg
                aria-hidden="true"
                className="signature-draft"
                viewBox={`0 0 ${b.receiptSize.width} ${b.receiptSize.height}`}
              >
                <polyline
                  points={draft
                    .map(
                      (p) =>
                        `${p.x * b.receiptSize.width},${p.y * b.receiptSize.height}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="black"
                  strokeWidth={b.receiptSize.width * 0.008}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <div className="decorate-receipt-caption" aria-live="polite">
            {chosen ? b.template.name : "Choose a theme"} · {b.shotCount}{" "}
            {b.shotCount === 1 ? "shot" : "shots"}
            {b.rendering ? " · Updating…" : ""}
          </div>
        </div>
      </div>
    </section>
  );
}
