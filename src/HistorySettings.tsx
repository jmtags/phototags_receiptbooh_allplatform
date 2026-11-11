import { useEffect, useState } from "react";
import {
  Download,
  Folder,
  FolderOpen,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { readHistoryAssets, type HistoryAssets } from "./history";
import { download, profiles } from "./receipt";
import type { BoothModel } from "./useBooth";
import {
  DeviceFolderSettings,
  FolderExport,
  SaveImageToFiles,
} from "./DeviceFolderSettings";

export function HistorySettings({ booth: b }: { booth: BoothModel }) {
  const dates = [...new Set(b.historyEntries.map((e) => e.date))]
    .sort()
    .reverse();
  const [folder, setFolder] = useState("");
  const date = dates.includes(folder) ? folder : dates[0] || "";
  const entries = b.historyEntries.filter((e) => e.date === date);
  const [selection, setSelection] = useState("");
  const entry = entries.find((e) => e.id === selection) || entries[0];
  const [loadedAssets, setAssets] = useState<HistoryAssets | null>(null);
  const assets = loadedAssets?.id === entry?.id ? loadedAssets : null;
  const [view, setView] = useState(-1);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const folderName = b.historyFolders[date] || date;
  useEffect(() => {
    let active = true;
    setAssets(null);
    setView(-1);
    setDeleting(false);
    setError("");
    if (entry)
      readHistoryAssets(entry.id)
        .then((value) => {
          if (!active) return;
          setAssets(value);
          if (!value.receipt) setView(value.photos.findIndex(Boolean));
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [entry?.id, entry?.updatedAt]);
  const source = view === -1 ? assets?.receipt : assets?.photos[view];
  const time = (value: string) =>
    new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <section className="photo-history" aria-label="Local photo history">
      <p className="host-intro">
        Browse saved photos and receipts, save them to a local device folder,
        and open them here again for reprinting.
      </p>
      <DeviceFolderSettings booth={b} />
      {(error || b.historyError) && (
        <p role="alert" className="alert">
          {error || b.historyError}
        </p>
      )}
      {b.historyLoading ? (
        <p role="status">Loading saved sessions…</p>
      ) : !dates.length ? (
        <div className="history-empty">
          <FolderOpen size={34} aria-hidden="true" />
          <h2>Your moments will be here.</h2>
          <p>
            Captured photos are saved automatically. Finished receipts become
            available for reprinting.
          </p>
        </div>
      ) : (
        <div className="history-layout">
          <nav className="history-folders" aria-label="Photo date folders">
            {dates.map((key) => (
              <button
                key={key}
                aria-current={date === key ? "page" : undefined}
                onClick={() => {
                  setFolder(key);
                  setSelection("");
                  setEditing(false);
                }}
              >
                <Folder size={19} aria-hidden="true" />
                <span>
                  <strong>{b.historyFolders[key] || key}</strong>
                  <small>
                    {b.historyFolders[key] ? `${key} · ` : ""}
                    {b.historyEntries.filter((e) => e.date === key).length}{" "}
                    sessions
                  </small>
                </span>
              </button>
            ))}
          </nav>
          <div className="history-collection">
            <div className="history-folder-heading">
              <div>
                <span className="section-kicker">Local folder · {date}</span>
                <h2>{folderName}</h2>
              </div>
              <button
                className="button button-secondary"
                onClick={() => {
                  setName(folderName);
                  setEditing(!editing);
                }}
              >
                <Pencil size={16} aria-hidden="true" />
                Rename folder
              </button>
            </div>
            {editing && (
              <form
                className="history-rename"
                onSubmit={async (e) => {
                  e.preventDefault();
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
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button className="button button-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save folder name"}
                </button>
              </form>
            )}
            <FolderExport booth={b} date={date} name={folderName} />
            <div
              className="history-cards"
              role="group"
              aria-label="Saved sessions"
            >
              {entries.map((item) => (
                <button
                  key={item.id}
                  className={`history-card ${entry?.id === item.id ? "selected" : ""}`}
                  aria-pressed={entry?.id === item.id}
                  onClick={() => setSelection(item.id)}
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      width="72"
                      height="170"
                      loading="lazy"
                    />
                  ) : (
                    <FolderOpen size={28} aria-hidden="true" />
                  )}
                  <strong>{item.theme}</strong>
                  <span>
                    {time(item.createdAt)} · {item.shots}{" "}
                    {item.shots === 1 ? "photo" : "photos"}
                  </span>
                  <small>
                    {item.hasReceipt ? "Receipt ready" : "Photos saved"}
                  </small>
                </button>
              ))}
            </div>
          </div>
          {entry && (
            <section
              className="history-detail"
              aria-label="Selected saved session"
            >
              <h2>{entry.theme}</h2>
              <p>
                {date} · {time(entry.createdAt)}
              </p>
              <div
                className="history-view-tabs"
                role="group"
                aria-label="Saved images"
              >
                {assets?.receipt && (
                  <button
                    className="button"
                    aria-pressed={view === -1}
                    onClick={() => setView(-1)}
                  >
                    View receipt
                  </button>
                )}
                {assets?.photos.map(
                  (photo, index) =>
                    photo && (
                      <button
                        key={index}
                        className="button"
                        aria-pressed={view === index}
                        onClick={() => setView(index)}
                      >
                        View photo {index + 1}
                      </button>
                    ),
                )}
              </div>
              <div className="history-image">
                {source ? (
                  <img
                    src={source}
                    alt={
                      view === -1
                        ? "Saved receipt preview"
                        : `Saved photo ${view + 1}`
                    }
                  />
                ) : (
                  <p role="status">
                    {assets
                      ? "No receipt available yet."
                      : "Opening saved images…"}
                  </p>
                )}
              </div>
              <div className="history-detail-actions">
                {source && (
                  <SaveImageToFiles
                    source={source}
                    name={`${date}-${entry.id.slice(0, 8)}-${view === -1 ? "receipt" : `photo-${view + 1}`}`}
                  />
                )}
                <button
                  className="button button-primary"
                  disabled={!assets?.receipt || !b.printer || b.busy || !!b.job}
                  onClick={() => void b.printHistoryReceipt(entry.id)}
                >
                  <Printer size={18} aria-hidden="true" />
                  Reprint receipt
                </button>
                <p className="field-help">
                  {b.printer
                    ? `One copy · ${profiles[b.profile].name} · ${b.printer}`
                    : "Connect and select a printer in Printer connection to reprint."}
                </p>
                <button
                  className="button button-secondary"
                  disabled={!source}
                  onClick={() => {
                    if (!source) return;
                    const extension = source.startsWith("data:image/jpeg")
                      ? "jpg"
                      : "png";
                    download(
                      source,
                      `${folderName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")}-${entry.id.slice(0, 8)}-${view === -1 ? "receipt" : `photo-${view + 1}`}.${extension}`,
                    );
                  }}
                >
                  <Download size={17} aria-hidden="true" />
                  Download {view === -1 ? "receipt" : "photo"}
                </button>
                {!deleting ? (
                  <button
                    className="button button-quiet"
                    disabled={b.busy || !!b.job}
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Delete saved session
                  </button>
                ) : (
                  <div className="history-delete-confirm">
                    <p>
                      Delete this session’s cached photos and receipt from this
                      browser? Files already saved to your device are kept.
                    </p>
                    <button
                      className="button button-secondary"
                      disabled={saving || b.busy || !!b.job}
                      onClick={async () => {
                        setSaving(true);
                        setError("");
                        try {
                          await b.deleteHistory(entry.id);
                          setSelection("");
                          setDeleting(false);
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
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
