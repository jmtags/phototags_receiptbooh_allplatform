import { useState } from "react";
import {
  ArrowRight,
  Camera,
  ImagePlus,
  Palette,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  brandStyle,
  welcomeBackground,
  defaultBranding,
  type Branding,
} from "./branding";
import type { BoothModel } from "./useBooth";

export function BrandingSettings({ booth: b }: { booth: BoothModel }) {
  const [draft, setDraft] = useState<Branding>({ ...b.branding }),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(b.branding);
  const patch = (key: keyof Branding, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };
  async function upload(file?: File, target: "logo" | "background" = "logo") {
    if (!file) return;
    setError("");
    setMessage("");
    setLoading(true);
    let url = "";
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error(`Choose a PNG, JPEG or WebP ${target}.`);
      if (file.size > 10 * 1024 * 1024)
        throw new Error(`Choose a ${target} smaller than 10 MB.`);
      url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const ratio = Math.min(
          1,
          (target === "background" ? 1600 : 640) /
            Math.max(img.naturalWidth, img.naturalHeight),
        ),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      const logo = canvas.toDataURL(
        "image/webp",
        target === "background" ? 0.8 : 0.92,
      );
      if (logo.length >= (target === "background" ? 1_500_000 : 2_000_000))
        throw new Error(
          `This ${target} is too large to save. Choose a simpler or smaller image.`,
        );
      patch(target, logo);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The logo could not be opened. Try another image.",
      );
    } finally {
      if (url) URL.revokeObjectURL(url);
      setLoading(false);
    }
  }
  function save(value: Branding, reset = false) {
    setError("");
    try {
      setDraft(b.saveBranding(value));
      setMessage(
        reset
          ? "Default PhotoTags LRB branding restored."
          : "Branding saved. Your kiosk welcome screen is ready.",
      );
    } catch (e) {
      setMessage("");
      setError((e as Error).message);
    }
  }
  return (
    <section
      className="host-panel branding-settings"
      aria-labelledby="branding-heading"
    >
      <div className="host-panel-title">
        <Palette size={22} aria-hidden="true" />
        <div>
          <span className="section-kicker">Make it yours</span>
          <h2 id="branding-heading">Kiosk branding</h2>
        </div>
      </div>
      <p className="host-intro">
        Welcome guests with your business or event identity. Save your changes
        to apply them to the kiosk on this device.
      </p>
      <div className="branding-layout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(draft);
          }}
          className="branding-form"
        >
          <fieldset disabled={loading || b.busy || !!b.job}>
            <legend className="sr-only">Kiosk welcome branding</legend>
            <div className="branding-logo-field">
              <div className="branding-logo-thumb">
                <img
                  src={draft.logo || "/icons/icon-192.png"}
                  alt="Logo preview"
                />
              </div>
              <div>
                <label className="button button-secondary branding-upload">
                  <ImagePlus size={16} aria-hidden="true" />
                  Upload logo
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
                  PNG, JPEG or WebP, up to 10 MB. Transparent PNG works well.
                </p>
                {draft.logo && (
                  <button
                    type="button"
                    className="host-text-button"
                    onClick={() => patch("logo", "")}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Remove logo
                  </button>
                )}
              </div>
            </div>
            <div className="branding-fields">
              <div className="branding-background-field">
                <span className="field">Welcome background</span>
                <label className="button button-secondary branding-upload">
                  <ImagePlus size={16} aria-hidden="true" />
                  Upload background
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      void upload(e.target.files?.[0], "background");
                      e.target.value = "";
                    }}
                  />
                </label>
                {draft.background && (
                  <button
                    type="button"
                    className="host-text-button"
                    onClick={() => patch("background", "")}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Remove background
                  </button>
                )}
                <p className="field-help">
                  PNG, JPEG or WebP, up to 10 MB. The image fills the welcome
                  screen with a dark overlay to keep text readable.
                </p>
              </div>
            </div>
            <div className="branding-fields">
              <label className="field">
                Brand or event name
                <input
                  value={draft.name}
                  maxLength={48}
                  required
                  onChange={(e) => patch("name", e.target.value)}
                />
              </label>
              <label className="field">
                Tagline
                <input
                  value={draft.tagline}
                  maxLength={90}
                  onChange={(e) => patch("tagline", e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              Welcome headline
              <input
                value={draft.headline}
                maxLength={90}
                required
                onChange={(e) => patch("headline", e.target.value)}
              />
            </label>
            <label className="field">
              Welcome message
              <textarea
                value={draft.message}
                maxLength={220}
                rows={3}
                onChange={(e) => patch("message", e.target.value)}
              />
            </label>
            <div className="branding-fields">
              <label className="field">
                Start button text
                <input
                  value={draft.startLabel}
                  maxLength={28}
                  required
                  onChange={(e) => patch("startLabel", e.target.value)}
                />
              </label>
              <label className="field">
                Accent color
                <div className="branding-color">
                  <input
                    type="color"
                    value={draft.accent}
                    onChange={(e) => patch("accent", e.target.value)}
                  />
                  <span>{draft.accent.toUpperCase()}</span>
                </div>
              </label>
            </div>
            <div className="branding-actions">
              <button
                className="button button-primary"
                disabled={!dirty}
                type="submit"
              >
                <Save size={16} aria-hidden="true" />
                Save branding
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => save({ ...defaultBranding }, true)}
              >
                <RotateCcw size={15} aria-hidden="true" />
                Restore default branding
              </button>
            </div>
          </fieldset>
          <p className="branding-save-status" role="status">
            {loading
              ? "Preparing image…"
              : message ||
                (dirty
                  ? "Unsaved changes. The preview shows your draft."
                  : "Saved on this device. Available offline.")}
          </p>
          {error && (
            <p className="branding-error" role="alert">
              {error}
            </p>
          )}
        </form>
        <div className="branding-preview-column">
          <span className="section-kicker">Live welcome preview</span>
          <div
            className="branding-preview"
            style={brandStyle(draft)}
            aria-label="Kiosk branding preview"
          >
            <div className="branding-preview-header">
              <img src={draft.logo || "/icons/icon-192.png"} alt="" />
              <strong>{draft.name || defaultBranding.name}</strong>
            </div>
            <div
              className={`branding-preview-body ${draft.background ? "has-brand-background" : ""}`}
              style={welcomeBackground(draft)}
            >
              {draft.logo ? (
                <img
                  className="branding-preview-logo"
                  src={draft.logo}
                  alt=""
                />
              ) : (
                <Camera size={56} strokeWidth={1.3} aria-hidden="true" />
              )}
              <span>{draft.tagline}</span>
              <h3>{draft.headline || defaultBranding.headline}</h3>
              <p>{draft.message}</p>
              <div className="branding-preview-start">
                <Camera size={18} aria-hidden="true" />
                {draft.startLabel || defaultBranding.startLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </div>
            </div>
          </div>
          <p className="field-help">
            Your logo and name also appear in the kiosk header. Accent text
            switches automatically for contrast. Receipt artwork and printed
            branding keep their original designs.
          </p>
        </div>
      </div>
    </section>
  );
}
