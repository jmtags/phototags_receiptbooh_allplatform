import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ImagePlus, Layers3, Plus, Save, Trash2 } from "lucide-react";
import {
  artwork,
  compose,
  defaultPlacement,
  thermal,
  type ShotCount,
  type Template,
} from "./receipt";
import {
  createThemeArtwork,
  newDesign,
  type EventTheme,
  type ThemeDesign,
} from "./eventThemes";
import type { BoothModel } from "./useBooth";

const initialArea = (): [number, number, number, number] => [
  0.09, 0.28, 0.91, 0.78,
];
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export function ThemeSettings({ booth: b }: { booth: BoothModel }) {
  const [id, setId] = useState<string | null>(null),
    [event, setEvent] = useState(b.activeEvent),
    [name, setName] = useState("My receipt"),
    [description, setDescription] = useState("Custom event receipt"),
    [design, setDesign] = useState<ThemeDesign>(newDesign),
    [area, setArea] = useState(initialArea),
    [shots, setShots] = useState<ShotCount>(1),
    [preview, setPreview] = useState(""),
    [size, setSize] = useState({ width: 384, height: 922 }),
    [rendering, setRendering] = useState(true),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; area: typeof area } | null>(null);
  const locked = b.busy || !!b.job || saving || uploading;
  const events = [...new Set(b.eventThemes.map((t) => t.event))].sort((a, b) =>
    a.localeCompare(b),
  );
  const patch = (key: keyof ThemeDesign, value: string) => {
    setDesign((current) => ({ ...current, [key]: value }));
    setMessage("");
  };
  useEffect(() => {
    let active = true;
    setRendering(true);
    const template: Template = {
      id: "draft",
      name,
      description,
      area,
      artwork: createThemeArtwork(design, event || "YOUR EVENT"),
    };
    compose(template, null, b.profile, 1, false, "portrait", {
      photos: Array(shots).fill(null),
      placements: Array.from({ length: shots }, defaultPlacement),
      shotCount: shots,
      stickers: [],
      strokes: [],
    })
      .then((c) => {
        if (!active) return;
        setPreview(
          (b.thermalView
            ? thermal(c, b.profile, b.gamma).preview
            : c
          ).toDataURL(),
        );
        setSize({ width: c.width, height: c.height });
        setRendering(false);
      })
      .catch(() => {
        if (active) {
          setError(
            "The theme preview could not be rendered. Try another artwork image.",
          );
          setRendering(false);
          setPreview("");
        }
      });
    return () => {
      active = false;
    };
  }, [design, event, area, shots, b.profile, b.gamma, b.thermalView]);
  function fresh() {
    setId(null);
    setName("My receipt");
    setEvent(b.activeEvent);
    setDescription("Custom event receipt");
    setDesign(newDesign());
    setArea(initialArea());
    setError("");
    setMessage("");
    setDeleteId(null);
  }
  function edit(theme: EventTheme) {
    setId(theme.id);
    setName(theme.name);
    setEvent(theme.event);
    setDescription(theme.description);
    setDesign({ ...newDesign(), ...theme.design });
    setArea([...theme.area]);
    setError("");
    setMessage("");
    setDeleteId(null);
    document
      .getElementById("theme-editor-heading")
      ?.scrollIntoView({ block: "start" });
  }
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setUploading(true);
    let url = "";
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error("Choose a PNG, JPEG or WebP receipt artwork image.");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose artwork smaller than 10 MB.");
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      if (
        image.naturalHeight / image.naturalWidth < 1 ||
        image.naturalHeight / image.naturalWidth > 5
      )
        throw new Error(
          "Use portrait receipt artwork with a height between 1 and 5 times its width.",
        );
      const scale = Math.min(
          1,
          960 / image.naturalWidth,
          3000 / image.naturalHeight,
        ),
        c = document.createElement("canvas");
      c.width = Math.round(image.naturalWidth * scale);
      c.height = Math.round(image.naturalHeight * scale);
      c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
      patch("upload", c.toDataURL("image/webp", 0.94));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (url) URL.revokeObjectURL(url);
      setUploading(false);
    }
  }
  async function save() {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const next: EventTheme = {
        id: id || `event_${crypto.randomUUID()}`,
        name: name.trim(),
        event: event.trim(),
        description: description.trim() || "Custom event receipt",
        area: [...area],
        artwork: createThemeArtwork(design, event.trim()),
        design: { ...design },
        updatedAt: new Date().toISOString(),
      };
      if (!next.name || !next.event)
        throw new Error("Enter an event name and a theme name.");
      await b.saveEventTheme(next);
      setId(next.id);
      b.setActiveEvent(next.event);
      setMessage(
        `Saved for ${next.event}. Manage its launch visibility in the event collection above.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove(themeId: string) {
    setError("");
    setSaving(true);
    try {
      await b.deleteEventTheme(themeId);
      if (id === themeId) fresh();
      setDeleteId(null);
      setMessage("Theme deleted from this device.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function geometry(key: "left" | "top" | "width" | "height", value: number) {
    setArea((current) => {
      let [x, y, r, bottom] = current,
        w = r - x,
        h = bottom - y;
      const v = value / 100;
      if (key === "left") x = clamp(v, 0, 1 - w);
      if (key === "top") y = clamp(v, 0, 1 - h);
      if (key === "width") w = clamp(v, 0.15, 1 - x);
      if (key === "height") h = clamp(v, 0.15, 1 - y);
      return [x, y, x + w, y + h];
    });
    setMessage("");
  }
  function move(e: PointerEvent) {
    if (!drag.current || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect(),
      start = drag.current,
      [l, t, r, bottom] = start.area,
      w = r - l,
      h = bottom - t,
      x = clamp(l + (e.clientX - start.x) / rect.width, 0, 1 - w),
      y = clamp(t + (e.clientY - start.y) / rect.height, 0, 1 - h);
    setArea([x, y, x + w, y + h]);
  }
  return (
    <div className="theme-settings">
      <section className="host-panel event-selection">
        <div className="host-panel-title">
          <Layers3 size={22} aria-hidden="true" />
          <div>
            <h2>Event collection</h2>
            <p className="field-help">
              Choose an event, then select the built-in and custom themes guests
              can use in the kiosk.
            </p>
          </div>
        </div>
        <label className="field">
          Active event
          <select
            value={b.activeEvent}
            disabled={locked || b.themesLoading}
            onChange={(e) => {
              try {
                b.setActiveEvent(e.target.value);
                setError("");
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            <option value="">All events</option>
            {[
              ...new Set([
                ...events,
                ...(b.activeEvent ? [b.activeEvent] : []),
              ]),
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </section>
      <section className="host-panel" aria-labelledby="launch-theme-heading">
        <h2 id="launch-theme-heading">Themes shown in launch mode</h2>
        <p className="field-help">
          Selections save automatically for the active event on this device.
          Keep at least one theme selected. New themes are shown by default.
        </p>
        <div className="launch-theme-options">
          {b.launchThemes.map((theme) => {
            const shown = b.availableThemes.some((t) => t.id === theme.id);
            return (
              <label className="launch-theme-option" key={theme.id}>
                <img src={artwork(theme)} alt="" loading="lazy" />
                <span>
                  <strong>{theme.name}</strong>
                  <small>{theme.event || "Built-in theme"}</small>
                </span>
                <input
                  type="checkbox"
                  aria-label={`Show ${theme.name}${theme.event ? ` for ${theme.event}` : ""} in launch mode`}
                  checked={shown}
                  disabled={
                    locked ||
                    b.themesLoading ||
                    (shown && b.availableThemes.length === 1)
                  }
                  onChange={(e) =>
                    b.setThemeVisible(theme.id, e.target.checked)
                  }
                />
              </label>
            );
          })}
        </div>
        <p className="field-help" role="status">
          {b.availableThemes.length} {b.availableThemes.length === 1 ? "theme" : "themes"} selected for launch mode.
        </p>
      </section>
      {b.themeError && (
        <div className="branding-error" role="alert">
          {b.themeError}
        </div>
      )}
      {error && (
        <div className="branding-error" role="alert">
          {error}
        </div>
      )}
      <p className="theme-status" role="status">
        {message ||
          (b.themesLoading
            ? "Loading saved event themes…"
            : "Saved themes stay on this device and work offline.")}
      </p>
      <section className="host-panel" aria-labelledby="theme-editor-heading">
        <div className="theme-editor-header">
          <div>
            <span className="section-kicker">Design a keepsake</span>
            <h2 id="theme-editor-heading">
              {id ? "Edit event theme" : "Create event theme"}
            </h2>
          </div>
          <button
            className="button button-secondary"
            disabled={locked}
            onClick={fresh}
          >
            <Plus size={16} aria-hidden="true" />
            New theme
          </button>
        </div>
        <div className="theme-editor-layout">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={locked || b.themesLoading}>
              <legend className="sr-only">Event theme details</legend>
              <label className="field">
                Event name
                <input
                  value={event}
                  maxLength={80}
                  required
                  onChange={(e) => {
                    setEvent(e.target.value);
                    setMessage("");
                  }}
                  placeholder="e.g. Mia & Alex Wedding"
                />
              </label>
              <label className="field">
                Theme name
                <input
                  value={name}
                  maxLength={60}
                  required
                  onChange={(e) => {
                    setName(e.target.value);
                    setMessage("");
                  }}
                />
              </label>
              <label className="field">
                Theme description
                <input
                  value={description}
                  maxLength={120}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="theme-artwork-options">
                <label className="button button-secondary branding-upload">
                  <ImagePlus size={16} aria-hidden="true" />
                  Upload receipt artwork
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      void upload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="field-help">
                  Optional portrait PNG, JPEG or WebP, up to 10 MB. Mark where
                  photos should appear; the selected photo area is replaced by
                  the guest’s shots.
                </p>
                {design.upload && (
                  <button
                    type="button"
                    className="host-text-button"
                    onClick={() => patch("upload", "")}
                  >
                    Use the built-in theme designer
                  </button>
                )}
              </div>
              {!design.upload && (
                <>
                  <label className="field">
                    Receipt headline
                    <input
                      value={design.headline}
                      maxLength={90}
                      onChange={(e) => patch("headline", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Receipt subtitle
                    <input
                      value={design.subtitle}
                      maxLength={90}
                      onChange={(e) => patch("subtitle", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Receipt footer
                    <input
                      value={design.footer}
                      maxLength={140}
                      onChange={(e) => patch("footer", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Frame style
                    <select
                      value={design.style}
                      onChange={(e) => patch("style", e.target.value)}
                    >
                      <option value="classic">Classic border</option>
                      <option value="double">Double border</option>
                      <option value="celebration">Celebration dots</option>
                    </select>
                  </label>
                </>
              )}
              <h3 className="theme-placement-heading">Photo placement</h3>
              <p className="field-help">
                Drag the outlined photo area in the preview, use the arrow keys,
                or adjust these controls.
              </p>
              <div className="theme-placement-fields">
                {(
                  [
                    ["left", area[0], 1 - (area[2] - area[0])],
                    ["top", area[1], 1 - (area[3] - area[1])],
                    ["width", area[2] - area[0], 1 - area[0]],
                    ["height", area[3] - area[1], 1 - area[1]],
                  ] as const
                ).map(([key, value, max]) => (
                  <label className="field" key={key}>
                    Photo area {key}
                    <input
                      type="range"
                      min={key === "width" || key === "height" ? 15 : 0}
                      max={Math.round(max * 100)}
                      step="1"
                      value={Math.round(value * 100)}
                      onChange={(e) => geometry(key, +e.target.value)}
                    />
                    <output>{Math.round(value * 100)}%</output>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="button button-primary"
                disabled={rendering || !preview}
              >
                <Save size={16} aria-hidden="true" />
                {saving ? "Saving theme…" : "Save theme for event"}
              </button>
            </fieldset>
          </form>
          <div className="theme-preview-column">
            <label className="field">
              Preview photo count
              <select
                value={shots}
                onChange={(e) => setShots(+e.target.value as ShotCount)}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option value={n} key={n}>
                    {n} {n === 1 ? "shot" : "shots"}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-help">
              {b.thermalView ? "Thermal preview" : "Color preview"} ·{" "}
              {size.width} dots · Photo outline is editor-only.
            </p>
            <div
              ref={previewRef}
              className="theme-design-preview"
              style={{ aspectRatio: `${size.width}/${size.height}` }}
            >
              {preview && (
                <img
                  src={preview}
                  alt="Custom theme preview"
                  draggable={false}
                />
              )}
              <button
                type="button"
                className="theme-photo-area"
                aria-label="Move photo area"
                disabled={locked}
                style={{
                  left: `${area[0] * 100}%`,
                  top: `${area[1] * 100}%`,
                  width: `${(area[2] - area[0]) * 100}%`,
                  height: `${(area[3] - area[1]) * 100}%`,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = {
                    x: e.clientX,
                    y: e.clientY,
                    area: [...area],
                  };
                }}
                onPointerMove={move}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onKeyDown={(e) => {
                  const keys: Record<string, ["left" | "top", number]> = {
                    ArrowLeft: ["left", -1],
                    ArrowRight: ["left", 1],
                    ArrowUp: ["top", -1],
                    ArrowDown: ["top", 1],
                  };
                  const action = keys[e.key];
                  if (action) {
                    e.preventDefault();
                    geometry(
                      action[0],
                      (action[0] === "left" ? area[0] : area[1]) * 100 +
                        action[1],
                    );
                  }
                }}
              >
                <span>Photo area</span>
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="host-panel" aria-labelledby="saved-theme-heading">
        <h2 id="saved-theme-heading">Saved event themes</h2>
        <p className="host-intro">
          {b.eventThemes.length} custom{" "}
          {b.eventThemes.length === 1 ? "theme" : "themes"} saved. Choose Edit
          to update a design without creating another copy.
        </p>
        <div className="saved-theme-grid">
          {b.eventThemes.map((theme) => (
            <article key={theme.id} className="saved-theme-card">
              <img src={artwork(theme)} alt="" />
              <div>
                <span className="section-kicker">{theme.event}</span>
                <h3>{theme.name}</h3>
                <p>{theme.description}</p>
                <div className="saved-theme-actions">
                  <button
                    className="button button-secondary"
                    disabled={locked}
                    onClick={() => edit(theme)}
                  >
                    Edit {theme.name}
                  </button>
                  <button
                    className="button button-quiet"
                    disabled={locked}
                    onClick={() => setDeleteId(theme.id)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete
                  </button>
                </div>
                {deleteId === theme.id && (
                  <div className="theme-delete-confirm">
                    <p>Delete {theme.name} from this device?</p>
                    <button
                      className="button button-secondary"
                      disabled={locked}
                      onClick={() => void remove(theme.id)}
                    >
                      Confirm delete
                    </button>
                    <button
                      className="button button-quiet"
                      onClick={() => setDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
