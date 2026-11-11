import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FolderOpen, HardDrive, Share2, Upload } from "lucide-react";
import {
  deviceImageFile,
  makeDeviceArchive,
  readDeviceArchive,
  supportsLocalFolder,
} from "./deviceFiles";
import { download } from "./receipt";
import type { BoothModel } from "./useBooth";

export function DeviceFolderSettings({ booth: b }: { booth: BoothModel }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const supported = supportsLocalFolder();
  const busy = b.deviceFolderWorking || opening || b.busy;
  return (
    <section
      className="device-folder-settings"
      aria-labelledby="device-folder-heading"
    >
      <div className="device-folder-title">
        <HardDrive size={23} aria-hidden="true" />
        <div>
          <span className="section-kicker">Save outside the browser</span>
          <h2 id="device-folder-heading">Device folder</h2>
        </div>
      </div>
      <p>
        {supported
          ? "Choose a folder on this device. Photos and receipts save automatically inside PhotoTags Receipt Booth, grouped by date. Choosing an existing booth folder also opens its saved sessions."
          : "This browser requires you to save through Files or Downloads. Prepare a date folder below, then save its ZIP to a local folder. On iPhone or iPad, choose Save to Files from the share sheet, or save the downloaded ZIP from Downloads."}
      </p>
      {b.deviceFolderName && (
        <p className="device-folder-destination">
          <FolderOpen size={18} aria-hidden="true" />
          <strong>{b.deviceFolderName}</strong>
          <span>
            {b.deviceFolderReady
              ? "Automatic saving on"
              : "Access needs reconnecting"}
          </span>
        </p>
      )}
      <div className="device-folder-actions">
        {supported && (
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void b.connectDeviceFolder()}
          >
            <FolderOpen size={17} aria-hidden="true" />
            {b.deviceFolderName ? "Change local folder" : "Choose local folder"}
          </button>
        )}
        {supported && b.deviceFolderName && !b.deviceFolderReady && (
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => void b.reconnectDeviceFolder()}
          >
            Reconnect folder
          </button>
        )}
        {b.deviceFolderReady && (
          <button
            className="button button-secondary"
            disabled={busy || !b.historyEntries.length}
            onClick={() =>
              void b.saveHistoryToDevice().catch((e) => setError(e.message))
            }
          >
            Save cached sessions to folder
          </button>
        )}
        {b.deviceFolderName && (
          <button
            className="button button-quiet"
            disabled={busy}
            onClick={() =>
              void b.disconnectDeviceFolder().catch((e) => setError(e.message))
            }
          >
            Disconnect folder
          </button>
        )}
        <label
          className={`button button-secondary device-import ${busy ? "disabled" : ""}`}
        >
          <Upload size={17} aria-hidden="true" />
          Open saved ZIP
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={busy}
            aria-label="Open saved ZIP"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setOpening(true);
              setMessage("");
              setError("");
              try {
                const count = await b.importHistory(
                  await readDeviceArchive(file),
                );
                setMessage(
                  `Opened ${count} saved ${count === 1 ? "session" : "sessions"}.`,
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setOpening(false);
              }
            }}
          />
        </label>
      </div>
      <p className="field-help">
        The browser keeps a working cache for browsing and reprints. Device
        files remain if you clear that cache. Renaming a date folder writes a
        new folder; earlier device copies are kept.
      </p>
      {(b.deviceFolderStatus || message || opening) && (
        <p className="device-save-status" role="status">
          {opening ? "Opening saved archive…" : message || b.deviceFolderStatus}
        </p>
      )}
      {(error || b.deviceFolderError) && (
        <p className="alert" role="alert">
          {error || b.deviceFolderError}
        </p>
      )}
    </section>
  );
}

export function FolderExport({
  booth: b,
  date,
  name,
}: {
  booth: BoothModel;
  date: string;
  name: string;
}) {
  const [archive, setArchive] = useState<File | null>(null),
    [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const request = useRef(0);
  const revision = b.historyEntries
    .filter((e) => e.date === date)
    .map((e) => `${e.id}:${e.updatedAt}`)
    .join("|");
  useEffect(() => {
    request.current++;
    setArchive(null);
    setPreparing(false);
    setMessage("");
    setError("");
  }, [date, name, revision]);
  const shareable =
    archive &&
    typeof navigator.share === "function" &&
    navigator.canShare?.({ files: [archive] });
  return (
    <div className="folder-export">
      {!archive ? (
        <button
          className="button button-secondary"
          disabled={preparing || b.historyLoading}
          onClick={async () => {
            const run = ++request.current;
            setPreparing(true);
            setError("");
            try {
              const records = await b.readAllHistory(date);
              if (!records.length)
                throw new Error("This folder has no saved sessions.");
              const file = makeDeviceArchive(records, { [date]: name }, name);
              if (request.current === run) setArchive(file);
            } catch (e) {
              if (request.current === run) setError((e as Error).message);
            } finally {
              if (request.current === run) setPreparing(false);
            }
          }}
        >
          <Download size={16} aria-hidden="true" />
          {preparing ? "Preparing folder…" : "Prepare folder for Files"}
        </button>
      ) : (
        <>
          {shareable && (
            <button
              className="button button-primary"
              onClick={() => {
                // The file is ready before this click, preserving native user activation.
                void navigator
                  .share({ files: [archive] })
                  .then(() =>
                    setMessage(
                      "Share sheet closed. Your files are kept only if you chose a save destination.",
                    ),
                  )
                  .catch((e) => {
                    if (e.name !== "AbortError")
                      setError(
                        "The share sheet could not save this archive. Use Download folder ZIP instead.",
                      );
                  });
              }}
            >
              <Share2 size={16} aria-hidden="true" />
              Save folder to Files
            </button>
          )}
          <button
            className="button button-secondary"
            onClick={() => download(archive, archive.name)}
          >
            <Download size={16} aria-hidden="true" />
            Download folder ZIP
          </button>
          <p className="field-help">
            {archive.name} ·{" "}
            {Math.max(0.1, archive.size / 1024 / 1024).toFixed(1)} MB. Save
            locally, then extract the ZIP to browse its date folders. Use Open
            saved ZIP to reprint here later.
          </p>
        </>
      )}
      {message && (
        <p role="status" className="field-help">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SaveImageToFiles({
  source,
  name,
}: {
  source: string;
  name: string;
}) {
  const [error, setError] = useState("");
  const file = useMemo(() => deviceImageFile(source, name), [source, name]);
  useEffect(() => setError(""), [source]);
  if (
    typeof navigator.share !== "function" ||
    !navigator.canShare?.({ files: [file] })
  )
    return null;
  return (
    <>
      <button
        className="button button-secondary"
        onClick={() => {
          void navigator.share({ files: [file] }).catch((e) => {
            if (e.name !== "AbortError")
              setError("Could not open the share sheet. Use Download instead.");
          });
        }}
      >
        <Share2 size={17} aria-hidden="true" />
        Save image to Files
      </button>
      {error && (
        <p role="alert" className="field-help">
          {error}
        </p>
      )}
    </>
  );
}
