import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseLocalFolder,
  readDeviceRecords,
  writeDeviceRecord,
  type DiskDirectory,
  type ImportedRecord,
} from "./deviceFiles";

export type HistoryEntry = {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  theme: string;
  shots: number;
  thumbnail: string;
  hasReceipt: boolean;
};
export type HistoryAssets = {
  id: string;
  photos: (string | null)[];
  receipt: string | null;
};
export type HistoryRecord = HistoryEntry & HistoryAssets;
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("phototags-photo-history", 2);
      request.onupgradeneeded = () => {
        for (const store of ["entries", "assets", "folders", "settings"])
          if (!request.result.objectStoreNames.contains(store))
            request.result.createObjectStore(store, { keyPath: "id" });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        connection = undefined;
        reject(new Error("Local photo history could not be opened."));
      };
      request.onblocked = () => {
        connection = undefined;
        reject(new Error("Close other booth tabs and reopen photo history."));
      };
    });
  return connection;
}
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => () => T,
) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const result = work(tx);
    tx.oncomplete = () => resolve(result());
    tx.onerror = tx.onabort = () =>
      reject(
        new Error(
          "Photo history could not be saved or read. Check this browser’s storage space and try again.",
        ),
      );
  });
}
export async function readHistoryAssets(id: string): Promise<HistoryAssets> {
  const result = await transaction(["assets"], "readonly", (tx) => {
    const request = tx.objectStore("assets").get(id);
    return () => request.result as HistoryAssets | undefined;
  });
  if (!result) throw new Error("This saved session is no longer available.");
  return result;
}
export function usePhotoHistory() {
  const deleted = useRef(new Set<string>());
  const folderHandle = useRef<DiskDirectory | null>(null),
    folderReady = useRef(false);
  const folderNames = useRef<Record<string, string>>({});
  const pending = useRef(new Map<string, HistoryRecord>());
  const draining = useRef<Promise<void> | null>(null);
  const [deviceFolderName, setDeviceFolderName] = useState("");
  const [deviceFolderReady, setDeviceFolderReady] = useState(false);
  const [deviceFolderError, setDeviceFolderError] = useState("");
  const [deviceFolderStatus, setDeviceFolderStatus] = useState("");
  const [deviceFolderWorking, setDeviceFolderWorking] = useState(false);
  const [historyEntries, setEntries] = useState<HistoryEntry[]>([]);
  const [historyFolders, setFolders] = useState<Record<string, string>>({});
  const [historyLoading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    let active = true;
    transaction(["entries", "folders", "settings"], "readonly", (tx) => {
      const entries = tx.objectStore("entries").getAll();
      const folders = tx.objectStore("folders").getAll();
      const destination = tx.objectStore("settings").get("deviceFolder");
      return () => ({
        entries: entries.result as HistoryEntry[],
        folders: folders.result as { id: string; name: string }[],
        destination: destination.result?.handle as DiskDirectory | undefined,
      });
    })
      .then((result) => {
        if (!active) return;
        setEntries(
          result.entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
        setFolders(
          Object.fromEntries(result.folders.map((f) => [f.id, f.name])),
        );
        folderNames.current = Object.fromEntries(
          result.folders.map((f) => [f.id, f.name]),
        );
        if (
          result.destination &&
          typeof result.destination.queryPermission === "function"
        ) {
          folderHandle.current = result.destination;
          setDeviceFolderName(result.destination.name);
          void result.destination
            .queryPermission({ mode: "readwrite" })
            .then((permission) => {
              if (!active || folderHandle.current !== result.destination)
                return;
              folderReady.current = permission === "granted";
              setDeviceFolderReady(folderReady.current);
              if (!folderReady.current)
                setDeviceFolderError(
                  "Reconnect the device folder to resume automatic saving. The browser copy is kept.",
                );
              setDeviceFolderStatus(
                folderReady.current
                  ? "Automatic folder saving is on."
                  : "Reconnect this folder to allow saving again.",
              );
            })
            .catch(() => {
              if (active && folderHandle.current === result.destination) {
                setDeviceFolderStatus(
                  "Reconnect this folder to allow saving again.",
                );
                setDeviceFolderError(
                  "Reconnect the device folder to resume automatic saving. The browser copy is kept.",
                );
              }
            });
        }
      })
      .catch((e) => {
        if (active) setHistoryError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  function drainDeviceQueue(): Promise<void> {
    if (draining.current) return draining.current;
    draining.current = (async () => {
      while (
        pending.current.size &&
        folderHandle.current &&
        folderReady.current
      ) {
        const target = folderHandle.current;
        const [id, record] = pending.current.entries().next().value!;
        pending.current.delete(id);
        if (deleted.current.has(id)) continue;
        try {
          if (
            (await target.queryPermission({ mode: "readwrite" })) !== "granted"
          )
            throw new Error("Folder permission needs to be renewed.");
          await writeDeviceRecord(
            target,
            record,
            folderNames.current[record.date] || record.date,
          );
          if (target === folderHandle.current)
            setDeviceFolderStatus(`Saved to ${target.name}.`);
        } catch (e) {
          if (target === folderHandle.current) {
            folderReady.current = false;
            setDeviceFolderReady(false);
            setDeviceFolderError(
              `Could not save to the device folder. ${(e as Error).message} The browser copy is kept; reconnect and save again.`,
            );
          }
          break;
        }
      }
    })().finally(() => {
      draining.current = null;
    });
    return draining.current;
  }
  function queueDeviceRecord(record: HistoryRecord) {
    if (
      !folderHandle.current ||
      !folderReady.current ||
      deleted.current.has(record.id)
    )
      return;
    pending.current.set(record.id, record);
    void drainDeviceQueue();
  }
  const saveHistory = useCallback(async (record: HistoryRecord) => {
    if (deleted.current.has(record.id)) return;
    const { photos, receipt, ...entry } = record;
    try {
      await transaction(["entries", "assets"], "readwrite", (tx) => {
        if (deleted.current.has(record.id)) return () => undefined;
        tx.objectStore("entries").put(entry);
        tx.objectStore("assets").put({ id: record.id, photos, receipt });
        return () => undefined;
      });
      if (deleted.current.has(record.id)) return;
      setEntries((current) =>
        [entry, ...current.filter((e) => e.id !== entry.id)].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setHistoryError("");
      queueDeviceRecord(record);
    } catch (e) {
      setHistoryError((e as Error).message);
    }
  }, []);
  async function renameHistoryFolder(id: string, name: string) {
    const cleaned = name.trim().slice(0, 80);
    if (!cleaned) throw new Error("Enter a folder name.");
    await transaction(["folders"], "readwrite", (tx) => {
      tx.objectStore("folders").put({ id, name: cleaned });
      return () => undefined;
    });
    setFolders((current) => ({ ...current, [id]: cleaned }));
    folderNames.current = { ...folderNames.current, [id]: cleaned };
    if (folderReady.current) {
      for (const record of await readAllHistory())
        if (record.date === id && !deleted.current.has(record.id))
          pending.current.set(record.id, record);
      await drainDeviceQueue();
    }
  }
  async function deleteHistory(id: string) {
    deleted.current.add(id);
    pending.current.delete(id);
    try {
      await transaction(["entries", "assets"], "readwrite", (tx) => {
        tx.objectStore("entries").delete(id);
        tx.objectStore("assets").delete(id);
        return () => undefined;
      });
    } catch (error) {
      deleted.current.delete(id);
      throw error;
    }
    setEntries((current) => current.filter((e) => e.id !== id));
  }
  async function readAllHistory(date?: string): Promise<HistoryRecord[]> {
    const entries = await transaction(["entries"], "readonly", (tx) => {
      const request = tx.objectStore("entries").getAll();
      return () => request.result as HistoryEntry[];
    });
    return Promise.all(
      entries
        .filter((entry) => !date || entry.date === date)
        .map(async (entry) => ({
          ...entry,
          ...(await readHistoryAssets(entry.id)),
        })),
    );
  }
  async function importHistory(records: ImportedRecord[]) {
    let imported = 0;
    for (const { record, folderName } of records) {
      const { photos, receipt, ...entry } = record;
      const accepted = await transaction(["entries", "assets", "folders"], "readwrite", (tx) => {
        let accepted = false;
        const current = tx.objectStore("entries").get(entry.id);
        current.onsuccess = () => {
          if (current.result && current.result.updatedAt >= entry.updatedAt) return;
          accepted = true;
          tx.objectStore("entries").put(entry);
          tx.objectStore("assets").put({ id: record.id, photos, receipt });
          if (!folderNames.current[entry.date] && folderName !== entry.date)
            tx.objectStore("folders").put({ id: entry.date, name: folderName });
        };
        return () => accepted;
      });
      if (!accepted) continue;
      deleted.current.delete(entry.id);
      if (!folderNames.current[entry.date] && folderName !== entry.date) {
        folderNames.current[entry.date] = folderName;
        setFolders((previous) => ({ ...previous, [entry.date]: folderName }));
      }
      setEntries((previous) =>
        [entry, ...previous.filter((e) => e.id !== entry.id)].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
      imported++;
    }
    return imported;
  }
  async function saveHistoryToDevice() {
    if (!folderReady.current || !folderHandle.current)
      throw new Error("Connect your local folder first.");
    setDeviceFolderWorking(true);
    setDeviceFolderError("");
    try {
      for (const record of await readAllHistory())
        if (!deleted.current.has(record.id))
          pending.current.set(record.id, record);
      await drainDeviceQueue();
    } finally {
      setDeviceFolderWorking(false);
    }
  }
  async function activateDeviceFolder(target: DiskDirectory) {
    folderHandle.current = target;
    folderReady.current = false;
    setDeviceFolderReady(false);
    setDeviceFolderName(target.name);
    setDeviceFolderError("");
    const imported = await importHistory(await readDeviceRecords(target));
    // Native handles are serializable in supporting browsers. If persistence is
    // unavailable the selected folder still works for this visit.
    try {
      await transaction(["settings"], "readwrite", (tx) => {
        tx.objectStore("settings").put({ id: "deviceFolder", handle: target });
        return () => undefined;
      });
    } catch {
      setDeviceFolderStatus(
        "Folder connected for this visit. Choose it again after reopening.",
      );
    }
    folderReady.current = true;
    setDeviceFolderReady(true);
    setDeviceFolderStatus(
      `Folder connected. ${imported} saved sessions opened.`,
    );
    await saveHistoryToDevice();
  }
  async function connectDeviceFolder() {
    setDeviceFolderWorking(true);
    setDeviceFolderError("");
    try {
      await activateDeviceFolder(await chooseLocalFolder());
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setDeviceFolderError((e as Error).message);
    } finally {
      setDeviceFolderWorking(false);
    }
  }
  async function reconnectDeviceFolder() {
    const target = folderHandle.current;
    if (!target) return;
    setDeviceFolderWorking(true);
    setDeviceFolderError("");
    try {
      if ((await target.requestPermission({ mode: "readwrite" })) !== "granted")
        throw new Error(
          "Folder access was not granted. Cached photos remain available.",
        );
      await activateDeviceFolder(target);
    } catch (e) {
      setDeviceFolderError((e as Error).message);
    } finally {
      setDeviceFolderWorking(false);
    }
  }
  async function disconnectDeviceFolder() {
    folderHandle.current = null;
    folderReady.current = false;
    pending.current.clear();
    setDeviceFolderReady(false);
    setDeviceFolderName("");
    setDeviceFolderError("");
    setDeviceFolderStatus(
      "Folder disconnected. Files already saved on the device are kept.",
    );
    await transaction(["settings"], "readwrite", (tx) => {
      tx.objectStore("settings").delete("deviceFolder");
      return () => undefined;
    });
  }
  return {
    deviceFolderName,
    deviceFolderReady,
    deviceFolderError,
    deviceFolderStatus,
    deviceFolderWorking,
    connectDeviceFolder,
    reconnectDeviceFolder,
    disconnectDeviceFolder,
    saveHistoryToDevice,
    readAllHistory,
    importHistory,
    historyEntries,
    historyFolders,
    historyLoading,
    historyError,
    saveHistory,
    renameHistoryFolder,
    deleteHistory,
  };
}
