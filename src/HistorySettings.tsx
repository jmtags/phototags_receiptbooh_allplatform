import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  Folder,
  FolderOpen,
  HardDrive,
  MoreHorizontal,
  Pencil,
  Printer,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import {
  readHistoryAssets,
  type HistoryAssets,
  type HistoryEntry,
} from "./history";
import { deviceImageFile } from "./deviceFiles";
import { download, image, profiles } from "./receipt";
import { applyTrialWatermark } from "./trialWatermark";
import type { BoothModel } from "./useBooth";
import { DeviceFolderSettings, FolderExport } from "./DeviceFolderSettings";

const time = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
type Selection = { entry: HistoryEntry; assets: HistoryAssets; index: number };

export function HistorySettings({ booth: b }: { booth: BoothModel }) {
  const dates = [...new Set(b.historyEntries.map((entry) => entry.date))]
    .sort()
    .reverse();
  const [folder, setFolder] = useState("");
  const [storageOpen, setStorageOpen] = useState(false);
  return (
    <section className="photo-history" aria-label="Local photo history">
      <div className="history-library-heading">
        <div>
          <h2>Your photo folders</h2>
          <p>Open a folder to browse, share or reprint.</p>
        </div>
        <span>
          {dates.length} {dates.length === 1 ? "folder" : "folders"}
        </span>
      </div>
      {b.historyError && (
        <p className="alert" role="alert">
          {b.historyError}
        </p>
      )}
      {b.historyLoading ? (
        <p role="status">Loading saved sessions...</p>
      ) : !dates.length ? (
        <div className="history-empty">
          <FolderOpen size={34} aria-hidden="true" />
          <h2>Your moments will be here.</h2>
          <p>Photos and receipts are saved automatically, grouped by date.</p>
        </div>
      ) : (
        <nav className="history-folder-grid" aria-label="Photo date folders">
          {dates.map((date) => {
            const entries = b.historyEntries.filter(
              (entry) => entry.date === date,
            );
            const previews = entries
              .filter((entry) => entry.thumbnail)
              .slice(0, 4);
            return (
              <button
                className="history-folder-card"
                key={date}
                onClick={() => setFolder(date)}
                aria-label={`Open folder ${b.historyFolders[date] || date}`}
              >
                <span className="history-folder-cover" aria-hidden="true">
                  {previews.length ? (
                    previews.map((entry) => (
                      <img
                        key={entry.id}
                        src={entry.thumbnail}
                        alt=""
                        loading="lazy"
                      />
                    ))
                  ) : (
                    <Folder size={44} />
                  )}
                  <span className="history-folder-badge">
                    <Folder size={16} />
                  </span>
                </span>
                <span className="history-folder-caption">
                  <strong>{b.historyFolders[date] || date}</strong>
                  <small>
                    {entries.length}{" "}
                    {entries.length === 1 ? "session" : "sessions"}
                    {b.historyFolders[date] ? ` · ${date}` : ""}
                  </small>
                </span>
              </button>
            );
          })}
        </nav>
      )}
      <details
        className="history-storage"
        onToggle={(event) => setStorageOpen(event.currentTarget.open)}
      >
        <summary>
          <HardDrive size={18} aria-hidden="true" />
          <span>Local storage & imports</span>
          <small>
            {b.deviceFolderName || "Folders, backups and saved ZIP files"}
          </small>
        </summary>
        <DeviceFolderSettings booth={b} />
      </details>
      {b.deviceFolderError && !storageOpen && (
        <p role="alert" className="alert">
          {b.deviceFolderError}
        </p>
      )}
      {folder && (
        <HistoryFolderDialog
          key={folder}
          booth={b}
          date={folder}
          onClose={() => setFolder("")}
        />
      )}
    </section>
  );
}

function HistoryFolderDialog({
  booth: b,
  date,
  onClose,
}: {
  booth: BoothModel;
  date: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [editing, setEditing] = useState(false),
    [name, setName] = useState("");
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const entries = b.historyEntries.filter((entry) => entry.date === date),
    folderName = b.historyFolders[date] || date;
  const origin = useRef("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      modal = dialog.current!;
    modal.showModal();
    heading.current?.focus();
    return () => {
      modal.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (selected && !entries.some((entry) => entry.id === selected.entry.id))
      setSelected(null);
  }, [b.historyEntries, selected]);
  function back() {
    setSelected(null);
    setError("");
    requestAnimationFrame(() =>
      dialog.current
        ?.querySelector<HTMLElement>(
          `[data-image-id="${CSS.escape(origin.current)}"]`,
        )
        ?.focus(),
    );
  }
  return (
    <dialog
      ref={dialog}
      className="history-modal"
      aria-labelledby="history-folder-title"
      onCancel={(event) => {
        event.preventDefault();
        if (selected) back();
        else onClose();
      }}
    >
      <header className="history-modal-header">
        <div className="history-modal-title">
          {selected && (
            <button
              className="icon-button"
              aria-label="Back to folder"
              onClick={back}
            >
              <ArrowLeft size={21} />
            </button>
          )}
          <div>
            <span className="section-kicker">Photo history · {date}</span>
            <h2 ref={heading} tabIndex={-1} id="history-folder-title">
              {folderName}
            </h2>
          </div>
        </div>
        <button
          className="icon-button"
          aria-label="Close photo folder"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      <div className="history-modal-body">
        {(error || b.error) && (
          <p role="alert" className="alert">
            {error || b.error}
          </p>
        )}
        {b.job && (
          <div className="alert warning" role="status">
            <div>
              <strong>Check your last print before continuing</strong>
              <p>
                {b.printMessage ||
                  "A previous print needs review. Check the paper and queue."}
              </p>
            </div>
            <button
              className="button button-secondary"
              disabled={b.working}
              onClick={b.resolvePrint}
            >
              I checked the printer
            </button>
          </div>
        )}
        {selected && (
          <HistoryImageViewer
            key={`${selected.entry.id}:${selected.index}`}
            booth={b}
            selection={selected}
            folderName={folderName}
            onDeleted={() => setSelected(null)}
          />
        )}
        <div hidden={!!selected}>
          <div className="history-gallery-toolbar">
            <p>
              {entries.length} {entries.length === 1 ? "session" : "sessions"}{" "}
              <span>· Select an image to view it</span>
            </p>
            <details className="history-folder-options">
              <summary
                className="button button-quiet"
                aria-label="Folder options"
              >
                <MoreHorizontal size={20} />
                <span>Folder options</span>
              </summary>
              <div>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    setName(folderName);
                    setEditing(!editing);
                  }}
                >
                  <Pencil size={16} />
                  Rename folder
                </button>
                <FolderExport booth={b} date={date} name={folderName} />
              </div>
            </details>
          </div>
          {editing && (
            <form
              className="history-rename"
              onSubmit={async (event) => {
                event.preventDefault();
                if (saving) return;
                setSaving(true);
                setError("");
                try {
                  await b.renameHistoryFolder(date, name);
                  setEditing(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label className="field">
                Folder name
                <input
                  value={name}
                  maxLength={80}
                  required
                  disabled={saving}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <button className="button button-primary" disabled={saving}>
                {saving ? "Saving..." : "Save folder name"}
              </button>
            </form>
          )}
          {!entries.length ? (
            <div className="history-empty">
              <FolderOpen size={32} />
              <h3>This folder is empty.</h3>
              <p>Your other saved folders are kept.</p>
            </div>
          ) : (
            entries.map((entry) => (
              <HistorySession
                key={entry.id + entry.updatedAt}
                entry={entry}
                onSelect={(assets, index) => {
                  origin.current = `${entry.id}:${index}`;
                  setSelected({ entry, assets, index });
                  requestAnimationFrame(() => heading.current?.focus());
                }}
              />
            ))
          )}
        </div>
      </div>
    </dialog>
  );
}

function HistorySession({
  entry,
  onSelect,
}: {
  entry: HistoryEntry;
  onSelect: (assets: HistoryAssets, index: number) => void;
}) {
  const element = useRef<HTMLElement>(null);
  const [assets, setAssets] = useState<HistoryAssets | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true,
      started = false;
    const load = () => {
      if (started) return;
      started = true;
      setError("");
      readHistoryAssets(entry.id)
        .then((value) => {
          if (active) setAssets(value);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    };
    if (typeof IntersectionObserver === "undefined") load();
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (items) => {
              if (items.some((item) => item.isIntersecting)) {
                load();
                observer?.disconnect();
              }
            },
            { rootMargin: "250px" },
          )
        : null;
    if (element.current) observer?.observe(element.current);
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [entry.id, entry.updatedAt, retry]);
  const images = assets
    ? [
        ...(assets.receipt
          ? [{ index: -1, source: assets.receipt, label: "Receipt" }]
          : []),
        ...assets.photos.flatMap((source, index) =>
          source ? [{ index, source, label: `Photo ${index + 1}` }] : [],
        ),
      ]
    : [];
  return (
    <article
      ref={element}
      className="history-session"
      aria-label={`${entry.theme} session at ${time(entry.createdAt)}`}
    >
      <div className="history-session-heading">
        <h3>{entry.theme}</h3>
        <span>{time(entry.createdAt)}</span>
      </div>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button
            className="button button-secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry images
          </button>
        </p>
      ) : !assets ? (
        <div className="history-gallery-loading" role="status">
          Opening saved images...
        </div>
      ) : (
        <div className="history-file-grid">
          {images.map((item) => (
            <button
              key={item.index}
              className="history-file"
              data-image-id={`${entry.id}:${item.index}`}
              aria-label={`View ${item.label.toLowerCase()} from ${entry.theme} at ${time(entry.createdAt)}`}
              onClick={() => onSelect(assets!, item.index)}
            >
              <span>
                <img src={item.source} alt="" loading="lazy" />
              </span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function HistoryImageViewer({
  booth: b,
  selection: { entry, assets, index },
  folderName,
  onDeleted,
}: {
  booth: BoothModel;
  selection: Selection;
  folderName: string;
  onDeleted: () => void;
}) {
  const original = index === -1 ? assets.receipt : assets.photos[index];
  const [prepared, setPrepared] = useState<{
      original: string;
      trial: boolean;
      source: string;
    } | null>(null),
    [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false),
    [saving, setSaving] = useState(false);
  const trial = b.lightLicense.isTrial;
  useEffect(() => {
    let active = true;
    setError("");
    if (!original) return;
    if (!trial) {
      setPrepared({ original, trial, source: original });
      return;
    }
    image(original)
      .then((img) => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        applyTrialWatermark(canvas);
        if (active)
          setPrepared({
            original,
            trial,
            source: canvas.toDataURL("image/png"),
          });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [original, trial]);
  const source =
    prepared?.original === original && prepared.trial === trial
      ? prepared.source
      : "";
  const filename = `${folderName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")}-${entry.id.slice(0, 8)}-${index === -1 ? "receipt" : `photo-${index + 1}`}`;
  const file = useMemo(
    () => (source ? deviceImageFile(source, filename) : null),
    [source, filename],
  );
  const canShare =
    !!file &&
    typeof navigator.share === "function" &&
    !!navigator.canShare?.({ files: [file] });
  return (
    <section className="history-image-viewer" aria-label="Selected saved image">
      <div className="history-image-meta">
        <strong>
          {index === -1 ? "Decorated receipt" : `Photo ${index + 1}`}
        </strong>
        <span>
          {entry.theme} · {time(entry.createdAt)}
        </span>
      </div>
      <div className="history-image">
        {source ? (
          <img
            src={source}
            alt={
              index === -1
                ? "Saved receipt preview"
                : `Saved photo ${index + 1}`
            }
          />
        ) : (
          <p role="status">Preparing image...</p>
        )}
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <div className="history-image-actions">
        <button
          className="button button-primary"
          disabled={!source || !b.printer || b.busy || !!b.job}
          onClick={() => void b.printHistoryReceipt(entry.id, index)}
        >
          <Printer size={18} />
          {index === -1 ? "Reprint receipt" : "Reprint photo"}
        </button>
        <button
          className="button button-secondary"
          disabled={!file}
          onClick={() => {
            if (!file) return;
            if (!canShare) {
              download(file, file.name);
              return;
            }
            void navigator.share({ files: [file] }).catch((e) => {
              if (e.name !== "AbortError")
                setError("Could not share this image. Use Download instead.");
            });
          }}
        >
          <Share2 size={18} />
          {canShare ? "Share image" : "Save image"}
        </button>
        {canShare && (
          <button
            className="button button-quiet"
            disabled={!file}
            onClick={() => {
              if (file) download(file, file.name);
            }}
          >
            <Download size={17} />
            Download {index === -1 ? "receipt" : "photo"}
          </button>
        )}
      </div>
      <p className="field-help">
        {b.printer
          ? `One copy · ${profiles[b.profile].name} · ${b.printer}`
          : "Select a printer in Printer connection to reprint."}
      </p>
      <details className="history-image-more">
        <summary>More options</summary>
        {!deleting ? (
          <button
            className="button button-quiet"
            disabled={b.busy || !!b.job}
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={16} />
            Delete saved session
          </button>
        ) : (
          <div className="history-delete-confirm">
            <p>
              Delete this session's cached photos and receipt? Files saved to
              your device are kept.
            </p>
            <button
              className="button button-secondary"
              disabled={saving || b.busy || !!b.job}
              onClick={async () => {
                if (saving) return;
                setSaving(true);
                setError("");
                try {
                  await b.deleteHistory(entry.id);
                  onDeleted();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Delete permanently
            </button>
            <button
              className="button button-quiet"
              disabled={saving}
              onClick={() => setDeleting(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </details>
    </section>
  );
}
