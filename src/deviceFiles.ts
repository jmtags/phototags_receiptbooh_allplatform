import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { HistoryEntry, HistoryRecord } from "./history";

export const archiveRoot = "PhotoTags Receipt Booth";
const limit = 512 * 1024 * 1024;
export type DiskFile = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: Blob): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
};
export type DiskDirectory = {
  kind: "directory";
  name: string;
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DiskDirectory>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DiskFile>;
  values(): AsyncIterableIterator<DiskDirectory | DiskFile>;
};
export const supportsLocalFolder = () =>
  typeof (window as unknown as { showDirectoryPicker?: unknown })
    .showDirectoryPicker === "function";
export function chooseLocalFolder() {
  return (
    window as unknown as {
      showDirectoryPicker(options: object): Promise<DiskDirectory>;
    }
  ).showDirectoryPicker({
    mode: "readwrite",
    id: "phototags-history",
    startIn: "pictures",
  });
}
export function safeName(value: string) {
  const cleaned = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 100);
  return !cleaned ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(cleaned)
    ? `_${cleaned || "PhotoTags"}`
    : cleaned;
}
export const diskDateName = (date: string, name?: string) =>
  !name || name === date ? date : `${date} ${safeName(name)}`;
type Manifest = {
  format: "phototags-history";
  version: 1;
  entry: HistoryEntry;
  folderName: string;
  photos: (string | null)[];
  receipt: string | null;
};
export type ImportedRecord = { record: HistoryRecord; folderName: string };
function bytesFromImage(source: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
    source,
  );
  if (!match) throw new Error("A saved image is not a supported photo format.");
  const binary = atob(match[2]);
  return {
    bytes: Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    extension: match[1] === "jpeg" ? "jpg" : match[1],
  };
}
function imageFromBytes(bytes: Uint8Array, path: string) {
  const type = path.endsWith(".jpg")
    ? "jpeg"
    : path.endsWith(".webp")
      ? "webp"
      : "png";
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return `data:image/${type};base64,${btoa(binary)}`;
}
export function deviceImageFile(source: string, name: string): File {
  const image = bytesFromImage(source);
  return new File(
    [new Uint8Array(image.bytes).buffer],
    `${safeName(name)}.${image.extension}`,
    {
      type:
        image.extension === "jpg" ? "image/jpeg" : `image/${image.extension}`,
    },
  );
}
function recordFiles(record: HistoryRecord, name: string) {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.date)
  )
    throw new Error("This session has an invalid folder identifier.");
  const files: Record<string, Uint8Array> = Object.create(null);
  const photos = record.photos.map((source, i) => {
    if (!source) return null;
    const image = bytesFromImage(source),
      path = `photo-${i + 1}.${image.extension}`;
    files[path] = image.bytes;
    return path;
  });
  if (record.receipt)
    files["receipt.png"] = bytesFromImage(record.receipt).bytes;
  const { photos: _photos, receipt: _receipt, ...entry } = record;
  const manifest: Manifest = {
    format: "phototags-history",
    version: 1,
    entry,
    folderName: name,
    photos,
    receipt: record.receipt ? "receipt.png" : null,
  };
  // Commit the manifest after all image files have been closed successfully.
  files["session.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return files;
}
async function writeFile(
  folder: DiskDirectory,
  name: string,
  bytes: Uint8Array,
) {
  const handle = await folder.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(new Blob([new Uint8Array(bytes).buffer]));
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch {
      /* Preserve the original error. */
    }
    throw error;
  }
}
export async function writeDeviceRecord(
  root: DiskDirectory,
  record: HistoryRecord,
  name: string,
) {
  const app =
    root.name === archiveRoot
      ? root
      : await root.getDirectoryHandle(archiveRoot, { create: true });
  const date = await app.getDirectoryHandle(diskDateName(record.date, name), {
    create: true,
  });
  const session = await date.getDirectoryHandle(record.id, { create: true });
  for (const [file, bytes] of Object.entries(recordFiles(record, name)))
    await writeFile(session, file, bytes);
}
function parseManifest(bytes: Uint8Array): Manifest {
  if (bytes.length > 2 * 1024 * 1024)
    throw new Error("A session manifest is too large.");
  const m = JSON.parse(strFromU8(bytes)) as Manifest,
    e = m?.entry;
  if (
    m?.format !== "phototags-history" ||
    m.version !== 1 ||
    !e ||
    typeof e.id !== "string" ||
    typeof e.date !== "string" ||
    typeof e.createdAt !== "string" ||
    typeof e.updatedAt !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(e.id) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
    !Number.isFinite(Date.parse(e.createdAt)) ||
    !Number.isFinite(Date.parse(e.updatedAt)) ||
    typeof e.theme !== "string" ||
    e.theme.length > 200 ||
    !Number.isInteger(e.shots) ||
    e.shots < 1 ||
    e.shots > 4 ||
    typeof e.thumbnail !== "string" ||
    (e.thumbnail &&
      !/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(
        e.thumbnail,
      )) ||
    typeof m.folderName !== "string" ||
    m.folderName.length > 80 ||
    !Array.isArray(m.photos) ||
    !m.photos.length ||
    m.photos.length > 4 ||
    m.photos.some(
      (p) =>
        p !== null &&
        (typeof p !== "string" || !/^photo-[1-4]\.(jpg|png|webp)$/.test(p)),
    ) ||
    !m.photos.some(Boolean) ||
    (m.receipt !== null && m.receipt !== "receipt.png")
  )
    throw new Error("This is not a valid PhotoTags saved session.");
  return m;
}
async function decodeRecord(
  manifest: Manifest,
  read: (name: string) => Promise<Uint8Array>,
): Promise<ImportedRecord> {
  let size = 0;
  const readImage = async (name: string) => {
    const bytes = await read(name);
    size += bytes.length;
    if (size > limit)
      throw new Error("This session is too large to open in this browser.");
    return imageFromBytes(bytes, name);
  };
  const photos = await Promise.all(
    manifest.photos.map((name) => (name ? readImage(name) : null)),
  );
  const receipt = manifest.receipt ? await readImage(manifest.receipt) : null;
  return {
    folderName: manifest.folderName,
    record: {
      ...manifest.entry,
      photos,
      receipt,
      hasReceipt: !!receipt,
      shots: photos.filter(Boolean).length,
    },
  };
}
export async function readDeviceRecords(
  root: DiskDirectory,
): Promise<ImportedRecord[]> {
  let app: DiskDirectory;
  try {
    app =
      root.name === archiveRoot
        ? root
        : await root.getDirectoryHandle(archiveRoot);
  } catch (e) {
    if ((e as Error).name === "NotFoundError") return [];
    throw e;
  }
  const records = new Map<string, ImportedRecord>();
  for await (const date of app.values()) {
    if (date.kind !== "directory") continue;
    for await (const session of date.values()) {
      if (session.kind !== "directory") continue;
      let file: File;
      try {
        file = await (await session.getFileHandle("session.json")).getFile();
      } catch (e) {
        if ((e as Error).name === "NotFoundError") continue;
        throw e;
      }
      const manifest = parseManifest(new Uint8Array(await file.arrayBuffer()));
      const record = await decodeRecord(manifest, async (name) => {
        const file = await (await session.getFileHandle(name)).getFile();
        if (file.size > limit)
          throw new Error("This saved photo is too large to open.");
        return new Uint8Array(await file.arrayBuffer());
      });
      const previous = records.get(record.record.id);
      if (!previous || previous.record.updatedAt <= record.record.updatedAt)
        records.set(record.record.id, record);
      if (records.size > 5000)
        throw new Error(
          "Open a smaller saved collection (up to 5,000 sessions).",
        );
    }
  }
  return [...records.values()];
}
export function makeDeviceArchive(
  records: HistoryRecord[],
  names: Record<string, string>,
  label: string,
): File {
  const files: Record<string, Uint8Array> = Object.create(null);
  let size = 0;
  for (const record of records) {
    const folderName = names[record.date] || record.date;
    const base = `${archiveRoot}/${diskDateName(record.date, folderName)}/${record.id}/`;
    for (const [path, bytes] of Object.entries(
      recordFiles(record, folderName),
    )) {
      size += bytes.length;
      if (size > limit)
        throw new Error(
          "This folder is too large to package. Save sessions individually or use a connected desktop folder.",
        );
      files[base + path] = bytes;
    }
  }
  const zipped = zipSync(files, { level: 0 });
  return new File(
    [new Uint8Array(zipped).buffer],
    `PhotoTags-${safeName(label)}.zip`,
    { type: "application/zip" },
  );
}
export async function readDeviceArchive(file: File): Promise<ImportedRecord[]> {
  if (file.size > limit)
    throw new Error("Choose a saved archive smaller than 512 MB.");
  let total = 0,
    count = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (file) => {
      total += file.originalSize;
      count++;
      if (total > limit || count > 30000)
        throw new Error("This archive expands beyond the supported size.");
      if (
        file.name.includes("\\") ||
        file.name.split("/").some((p) => p === "..")
      )
        throw new Error("This archive contains an invalid path.");
      return true;
    },
  });
  const records = new Map<string, ImportedRecord>();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(`${archiveRoot}/`) || !path.endsWith("/session.json"))
      continue;
    const manifest = parseManifest(files[path]);
    const base = path.slice(0, -"session.json".length);
    const record = await decodeRecord(manifest, async (name) => {
      const bytes = files[base + name];
      if (!bytes) throw new Error(`A saved image is missing: ${name}`);
      return bytes;
    });
    const previous = records.get(record.record.id);
    if (!previous || previous.record.updatedAt <= record.record.updatedAt)
      records.set(record.record.id, record);
  }
  if (!records.size)
    throw new Error("This ZIP contains no PhotoTags saved sessions.");
  return [...records.values()];
}
