import { useEffect, useMemo, useRef, useState } from "react";
import { useBranding } from "./branding";
import { useEventThemes } from "./eventThemes";
import { useSecurity } from "./security";
import { useLightLicense } from "./lightLicense";
import { applyTrialWatermark } from "./trialWatermark";
import { useKioskSettings } from "./kioskSettings";
import { localDate, readHistoryAssets, usePhotoHistory } from "./history";
import {
  compose,
  download,
  printerTestPhoto,
  profiles,
  templates,
  thermal,
  type Profile,
  type PhotoLayout,
  type ShotCount,
  type PhotoPlacement,
  type ReceiptSticker,
  type SignatureStroke,
  type Template,
  defaultPlacement,
  image,
  photoSlots,
} from "./receipt";
import * as printing from "./printing";
import {
  checkOffline,
  offlineEvents,
  repairOffline,
  updateSW,
} from "./offline";
function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
export function useBooth() {
  const lightLicense = useLightLicense();
  const { branding, saveBranding } = useBranding();
  const themeLibrary = useEventThemes();
  const security = useSecurity();
  const photoHistory = usePhotoHistory();
  const historySession = useRef<{
    id: string;
    date: string;
    createdAt: string;
  } | null>(null);
  const [hiddenThemes, setHiddenThemes] = useState<Record<string, string[]>>(
    () => {
      try {
        const value = JSON.parse(stored("hiddenLaunchThemes", "{}"));
        return value && typeof value === "object" && !Array.isArray(value)
          ? (Object.fromEntries(
              Object.entries(value).filter(
                ([, ids]) =>
                  Array.isArray(ids) &&
                  ids.every((id) => typeof id === "string"),
              ),
            ) as Record<string, string[]>)
          : {};
      } catch {
        return {};
      }
    },
  );
  const launchThemes = useMemo<Template[]>(
    () => [
      ...templates,
      ...themeLibrary.eventThemes.filter(
        (t) =>
          !themeLibrary.activeEvent || t.event === themeLibrary.activeEvent,
      ),
    ],
    [themeLibrary.eventThemes, themeLibrary.activeEvent],
  );
  const availableThemes = useMemo(() => {
    const hidden = Object.hasOwn(hiddenThemes, themeLibrary.activeEvent)
      ? hiddenThemes[themeLibrary.activeEvent]
      : [];
    const selected = launchThemes.filter((t) => !hidden.includes(t.id));
    return selected.length ? selected : launchThemes.slice(0, 1);
  }, [launchThemes, hiddenThemes, themeLibrary.activeEvent]);
  function setThemeVisible(id: string, visible: boolean) {
    if (busy || job || themeLibrary.themesLoading) return;
    if (
      !visible &&
      availableThemes.length === 1 &&
      availableThemes[0].id === id
    )
      return;
    const next = {
      ...hiddenThemes,
      [themeLibrary.activeEvent]: launchThemes
        .filter((t) =>
          t.id === id
            ? !visible
            : !availableThemes.some((shown) => shown.id === t.id),
        )
        .map((t) => t.id),
    };
    if (!save("hiddenLaunchThemes", JSON.stringify(next))) {
      setError(
        "Theme visibility could not be saved on this device. Your previous selection was kept.",
      );
      return;
    }
    setHiddenThemes(next);
  }
  const [retakeLimit, setRetakeLimitState] = useState(() => {
    const n = Number(stored("retakeLimit", "-1"));
    return Number.isInteger(n) && n >= -1 && n <= 10 ? n : -1;
  });
  const [retakesUsed, setRetakesUsed] = useState(0);
  const retakesRemaining =
    retakeLimit < 0 ? Infinity : Math.max(0, retakeLimit - retakesUsed);
  const canRetake = retakesRemaining > 0;
  function setRetakeLimit(value: number) {
    if (busy || job || !Number.isInteger(value) || value < -1 || value > 10)
      return;
    if (!save("retakeLimit", String(value))) {
      setError(
        "The retake limit could not be saved. Allow browser storage and try again.",
      );
      return;
    }
    setRetakeLimitState(value);
  }
  function allowReplacement() {
    if (canRetake) return true;
    setError(
      "This session has no retakes remaining. You can keep your photos and continue.",
    );
    return false;
  }
  const [autoCapture, setAutoCaptureState] = useState(
    stored("autoCapture", "false") === "true",
  );
  function setAutoCapture(value: boolean) {
    if (busy || job) return;
    if (!save("autoCapture", String(value))) {
      setError(
        "Automatic capture could not be saved on this device. Allow browser storage and try again.",
      );
      return;
    }
    setAutoCaptureState(value);
  }
  const [countdownSeconds, setCountdownSecondsState] = useState(() => {
    const value = Number(stored("countdownSeconds", "3"));
    return Number.isInteger(value) && value >= 1 && value <= 15 ? value : 3;
  });
  function setCountdownSeconds(value: number) {
    if (busy || job || !Number.isInteger(value) || value < 1 || value > 15)
      return;
    if (!save("countdownSeconds", String(value))) {
      setError(
        "The camera timer could not be saved on this device. Allow browser storage and try again.",
      );
      return;
    }
    setCountdownSecondsState(value);
  }
  const [templateId, setTemplateId] = useState(
    stored("template", "super_snap"),
  );
  const template =
    availableThemes.find((t) => t.id === templateId) ?? availableThemes[0];
  const [profile, setProfile] = useState<Profile>(
    stored("profile", "deli") === "g80" ? "g80" : "deli",
  );
  const [g80Gamma, setG80Gamma] = useState(() => {
    const value = Number(stored("gamma", "1.5"));
    return [1, 1.5, 2].includes(value) ? value : 1.5;
  });
  const [deliGamma, setDeliGamma] = useState(() => {
    const value = Number(stored("deliGamma", "1"));
    return [1, 1.5, 2].includes(value) ? value : 1;
  });
  const gamma = profile === "g80" ? g80Gamma : deliGamma;
  function setGamma(value: number) {
    if (busy || job || ![1, 1.5, 2].includes(value)) return;
    if (!save(profile === "g80" ? "gamma" : "deliGamma", String(value))) {
      setError(
        "Photo lightness could not be saved on this device. Your previous setting was kept.",
      );
      return;
    }
    if (profile === "g80") setG80Gamma(value);
    else setDeliGamma(value);
  }
  const [layout, setLayout] = useState<PhotoLayout>("portrait");
  const [shotCount, setShotCountState] = useState<ShotCount>(1);
  const [photos, setPhotos] = useState<(string | null)[]>([null]);
  const [captureEvent, setCaptureEvent] = useState(0);
  const [placements, setPlacements] = useState<PhotoPlacement[]>([
    defaultPlacement(),
  ]);
  const [activePhoto, setActivePhotoState] = useState(0);
  const [stickers, setStickers] = useState<ReceiptSticker[]>([]);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [renderedComposition, setRenderedComposition] = useState<object | null>(
    null,
  );
  const [receiptSize, setReceiptSize] = useState({ width: 384, height: 922 });
  const [preview, setPreview] = useState("");
  const [editorPreview,setEditorPreview]=useState("");
  const [dimensions, setDimensions] = useState("");
  const photo = photos[activePhoto] ?? null;
  const zoom = placements[activePhoto]?.zoom ?? 1,
    mirror = placements[activePhoto]?.mirror ?? false;
  const complete = photos.length === shotCount && photos.every(Boolean),
    hasPhotos = photos.some(Boolean);
  const [thermalView, setThermalView] = useState(
      stored("thermalView", "true") !== "false",
    ),
    [camera, setCamera] = useState(false),
    [cameraReady, setCameraReady] = useState(false);
  const [count, setCount] = useState(0),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [tab, setTab] = useState("booth");
  const [offline, setOffline] = useState("Preparing offline files…"),
    [persistent, setPersistent] = useState(""),
    [update, setUpdate] = useState(false);
  const [online, setOnline] = useState(navigator.onLine),
    [host, setHost] = useState(stored("host", "localhost")),
    [printers, setPrinters] = useState<string[]>([]),
    [printer, setPrinter] = useState("");
  const [job, setJob] = useState(stored("pendingPrint", "")),
    [printMessage, setPrintMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    captureToken = useRef(0),
    requestToken = useRef(0),
    mounted = useRef(true);
  const canvas = useRef<HTMLCanvasElement | null>(null),
    bytes = useRef<Uint8Array | null>(null),
    printLock = useRef(false);
  const busy = count > 0 || working;
  const kioskSettings=useKioskSettings(busy||!!job);
  const photoDownloadCache=useRef(new Map<string,{qr:string;url:string;expiresAt:string}>());
  // Gate output immediately when inputs change, until this exact revision is rendered.
  const composition = useMemo(
    () => ({}),
    [
      template,
      photos,
      placements,
      shotCount,
      stickers,
      strokes,
      profile,
      gamma,
      thermalView,
      lightLicense.isTrial,
      layout,
    ],
  );
  const rendering = renderedComposition !== composition;
  function historyIdentity() {
    if (!historySession.current)
      historySession.current = {
        id: crypto.randomUUID(),
        date: localDate(),
        createdAt: new Date().toISOString(),
      };
    return historySession.current;
  }
  // Keep captured originals even for an incomplete session. A changed photo set
  // invalidates the old receipt until the matching composition is ready.
  useEffect(() => {
    if (!hasPhotos) return;
    void photoHistory.saveHistory({
      ...historyIdentity(),
      updatedAt: new Date().toISOString(),
      theme: template.name,
      shots: photos.filter(Boolean).length,
      photos: [...photos],
      receipt: null,
      thumbnail: "",
      hasReceipt: false,
    });
  }, [photos]);
  useEffect(() => {
    if (!hasPhotos || rendering || !canvas.current || !preview) return;
    const thumbnail = document.createElement("canvas");
    thumbnail.width = 120;
    thumbnail.height = Math.round(
      (120 * canvas.current.height) / canvas.current.width,
    );
    thumbnail
      .getContext("2d")!
      .drawImage(canvas.current, 0, 0, thumbnail.width, thumbnail.height);
    void photoHistory.saveHistory({
      ...historyIdentity(),
      updatedAt: new Date().toISOString(),
      theme: template.name,
      shots: photos.filter(Boolean).length,
      photos: [...photos],
      receipt: complete ? canvas.current.toDataURL("image/png") : null,
      thumbnail: thumbnail.toDataURL("image/jpeg", 0.72),
      hasReceipt: complete,
    });
  }, [renderedComposition, composition]);
  function updatePlacement(index: number, patch: Partial<PhotoPlacement>) {
    setPlacements((current) =>
      current.map((value, i) => (i === index ? { ...value, ...patch } : value)),
    );
  }
  function setZoom(value: number) {
    updatePlacement(activePhoto, { zoom: value });
  }
  function setMirror(value: boolean) {
    updatePlacement(activePhoto, { mirror: value });
  }
  function selectPhoto(index: number) {
    if (busy || job) return;
    stopCamera();
    setActivePhotoState(Math.max(0, Math.min(shotCount - 1, index)));
    setError("");
  }
  function setShotCount(value: ShotCount) {
    if (job || busy || value === shotCount) return;
    if (hasPhotos && retakeLimit >= 0) {
      setError(
        "This session keeps its selected shot count once photos are taken. Start a new session to change the layout.",
      );
      return;
    }
    stopCamera();
    setShotCountState(value);
    setPhotos(Array(value).fill(null));
    setPlacements(Array.from({ length: value }, defaultPlacement));
    setActivePhotoState(0);
    setStickers([]);
    setStrokes([]);
    setError("");
  }
  function addSticker(assetId: string) {
    if (stickers.length >= 24) {
      setError("You can add up to 24 stickers to one receipt.");
      return;
    }
    const id = crypto.randomUUID(),
      slot = photoSlots(
        template,
        receiptSize.width,
        receiptSize.height,
        shotCount,
        layout,
      )[activePhoto];
    setStickers((current) => [
      ...current,
      {
        id,
        assetId,
        x: (slot.x + slot.w / 2) / receiptSize.width,
        y: (slot.y + slot.h * 0.22) / receiptSize.height,
        size: 0.24,
        rotation: 0,
      },
    ]);
    return id;
  }
  function updateSticker(id: string, patch: Partial<ReceiptSticker>) {
    setStickers((current) =>
      current.map((s) =>
        s.id === id ? { ...s, ...patch, id: s.id, assetId: s.assetId } : s,
      ),
    );
  }
  function removeSticker(id: string) {
    setStickers((current) => current.filter((s) => s.id !== id));
  }
  function addStroke(points: { x: number; y: number }[]) {
    if (points.length > 1)
      setStrokes((current) => [
        ...current,
        { id: crypto.randomUUID(), points, width: 0.008 },
      ]);
  }
  function undoStroke() {
    setStrokes((current) => current.slice(0, -1));
  }
  function clearStrokes() {
    setStrokes([]);
  }
  async function refreshOffline() {
    try {
      setOffline(await checkOffline());
    } catch {
      setOffline("Offline check failed. Connect to the internet and reload.");
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refreshOffline();
    const ready = () => void refreshOffline(),
      needUpdate = () => setUpdate(true),
      network = () => {
        setOnline(navigator.onLine);
        void refreshOffline();
      };
    offlineEvents.addEventListener("ready", ready);
    offlineEvents.addEventListener("update", needUpdate);
    offlineEvents.addEventListener("failure", () =>
      setOffline("Offline setup failed. Reconnect and reload."),
    );
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("focus", ready);
    navigator.serviceWorker?.addEventListener("controllerchange", ready);
    const install = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", install);
    navigator.serviceWorker?.getRegistration().then((r) => {
      if (r?.waiting) setUpdate(true);
    });
    return () => {
      mounted.current = false;
      captureToken.current++;
      requestToken.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      offlineEvents.removeEventListener("ready", ready);
      offlineEvents.removeEventListener("update", needUpdate);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("focus", ready);
      navigator.serviceWorker?.removeEventListener("controllerchange", ready);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);
  useEffect(() => {
    save("template", template.id);
    save("profile", profile);
    save("thermalView", String(thermalView));
    let active = true;
    canvas.current = null;
    bytes.current = null;
    const content={photos,placements,shotCount,stickers,strokes};
    Promise.all([
      compose(template,photos[0]??null,profile,1,false,layout,content),
      compose(template,photos[0]??null,profile,1,false,layout,content,1200),
    ]).then(([c,editor])=>{
        if(!active)return;
        if(lightLicense.isTrial){applyTrialWatermark(c);applyTrialWatermark(editor);}
        setEditorPreview(editor.toDataURL("image/png"));
        const result = thermal(c, profile, gamma);
        canvas.current = c;
        bytes.current = result.bytes;
        setPreview((thermalView ? result.preview : c).toDataURL("image/png"));
        setDimensions(`${c.width} × ${c.height} px`);
        setReceiptSize({ width: c.width, height: c.height });
        setRenderedComposition(composition);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setRenderedComposition(composition);
          setPreview("");setEditorPreview("");
        }
      });
    return () => {
      active = false;
    };
  }, [
    template,
    photos,
    placements,
    shotCount,
    stickers,
    strokes,
    profile,
    gamma,
    thermalView,
    lightLicense.isTrial,
    layout,
  ]);
  function stopCamera() {
    captureToken.current++;
    requestToken.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
    setCameraReady(false);
    setCount(0);
  }
  useEffect(() => {
    const media = stream.current,
      element = video.current;
    if (!camera || !media || !element || element.srcObject === media) return;
    const token = requestToken.current;
    element.srcObject = media;
    void element
      .play()
      .then(() => {
        if (
          token === requestToken.current &&
          stream.current === media &&
          mounted.current
        )
          setCameraReady(element.readyState >= 2);
      })
      .catch(() => {
        if (token !== requestToken.current) return;
        stopCamera();
        setError(
          "The camera preview could not start. Please try again or choose a local photo.",
        );
      });
  }, [camera]);
  async function openCamera() {
    setError("");
    stopCamera();
    const token = ++requestToken.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera access needs HTTPS or localhost and a compatible browser. You can choose a local photo instead.",
      );
      return;
    }
    setCamera(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
      });
      if (token !== requestToken.current || !mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
        if (
          token === requestToken.current &&
          stream.current === media &&
          mounted.current
        )
          setCameraReady(
            video.current?.readyState !== undefined &&
              video.current.readyState >= 2,
          );
      }
    } catch (e) {
      if (token !== requestToken.current) return;
      stopCamera();
      const name = (e as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow the camera in your browser settings, or choose a local photo."
          : name === "NotFoundError"
            ? "No camera was found. Connect a webcam or choose a local photo."
            : "The camera could not start. Close other camera apps and try again, or choose a local photo.",
      );
    }
  }
  async function capture() {
    if (!cameraReady || count) return;
    if (photo && !allowReplacement()) return;
    const token = ++captureToken.current;
    for (let i = countdownSeconds; i > 0; i--) {
      setCount(i);
      await new Promise((r) => setTimeout(r, 1000));
      if (token !== captureToken.current || !mounted.current) return;
    }
    const v = video.current;
    if (!v?.videoWidth) {
      setCount(0);
      setError("The camera is not ready. Please try again.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setCaptureEvent((value) => value + 1);
    setPhotos((current) =>
      current.map((src, i) =>
        i === activePhoto ? c.toDataURL("image/jpeg", 0.94) : src,
      ),
    );
    if (photo) setRetakesUsed((n) => n + 1);
    setZoom(1);
    stopCamera();
  }
  async function upload(file?: File) {
    if (!file) return;
    if (photo && !allowReplacement()) return;
    setError("");
    if (file.size > 25 * 1024 * 1024) {
      setError("Choose an image smaller than 25 MB.");
      return;
    }
    stopCamera();
    setWorking(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas"),
        scale = Math.min(
          1,
          2400 / Math.max(img.naturalWidth, img.naturalHeight),
        );
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      setPhotos((current) =>
        current.map((src, i) =>
          i === activePhoto ? c.toDataURL("image/jpeg", 0.94) : src,
        ),
      );
      if (photo) setRetakesUsed((n) => n + 1);
      setZoom(1);
    } catch {
      setError(
        "This image could not be opened. Try a JPEG, PNG or WebP photo.",
      );
    } finally {
      URL.revokeObjectURL(url);
      setWorking(false);
    }
  }
  async function captureSequence() {
    if (!cameraReady || count) return;
    if (photo && !allowReplacement()) return;
    const token = ++captureToken.current;
    const indices = photos[activePhoto]
      ? [activePhoto]
      : photos.map((src, i) => (src ? -1 : i)).filter((i) => i >= 0);
    for (const index of indices) {
      setActivePhotoState(index);
      for (let i = countdownSeconds; i > 0; i--) {
        setCount(i);
        await new Promise((r) => setTimeout(r, 1000));
        if (token !== captureToken.current || !mounted.current) return;
      }
      const v = video.current;
      if (!v?.videoWidth) {
        setError("The camera is not ready. Please try again.");
        stopCamera();
        return;
      }
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const data = c.toDataURL("image/jpeg", 0.94);
      setCaptureEvent((value) => value + 1);
      if (photos[index]) setRetakesUsed((n) => n + 1);
      setPhotos((current) =>
        current.map((src, i) => (i === index ? data : src)),
      );
      updatePlacement(index, defaultPlacement());
    }
    stopCamera();
  }
  async function uploadMany(files: File[]) {
    if (!files.length) return;
    if (photo && !allowReplacement()) return;
    stopCamera();
    setError("");
    setWorking(true);
    const indices = [
      activePhoto,
      ...photos
        .map((src, i) => (!src && i !== activePhoto ? i : -1))
        .filter((i) => i >= 0),
    ];
    try {
      const results: { index: number; src: string }[] = [];
      for (let i = 0; i < Math.min(files.length, indices.length); i++) {
        const file = files[i];
        if (file.size > 25 * 1024 * 1024)
          throw new Error("Choose images smaller than 25 MB.");
        const url = URL.createObjectURL(file);
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const c = document.createElement("canvas"),
            scale = Math.min(
              1,
              2400 / Math.max(img.naturalWidth, img.naturalHeight),
            );
          c.width = Math.round(img.naturalWidth * scale);
          c.height = Math.round(img.naturalHeight * scale);
          c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
          results.push({
            index: indices[i],
            src: c.toDataURL("image/jpeg", 0.94),
          });
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const next = [...photos];
      const replacements = results.filter(
        (result) => !!photos[result.index],
      ).length;
      for (const result of results) {
        next[result.index] = result.src;
        updatePlacement(result.index, defaultPlacement());
      }
      setPhotos(next);
      if (replacements) setRetakesUsed((n) => n + replacements);
      const missing = next.findIndex((src) => !src);
      setActivePhotoState(missing >= 0 ? missing : activePhoto);
    } catch (e) {
      setError(
        `The images could not be opened. ${(e as Error).message} Try JPEG, PNG or WebP.`,
      );
    } finally {
      setWorking(false);
    }
  }
  async function connect() {
    setWorking(true);
    setError("");
    setPrinters([]);
    setPrinter("");
    try {
      const found = await printing.connect(host);
      setPrinters(found);
      save("host", host.trim());
      if (!found.length)
        setError(
          "The helper has no printer queues. Install and configure a raw queue, then reconnect.",
        );
    } catch (e) {
      setError(
        `Could not connect to QZ Tray. Check installation, secure certificate, site authorization and network permissions. ${(e as Error).message ?? ""}`,
      );
    } finally {
      setWorking(false);
    }
  }
  async function print() {
    if (
      printLock.current ||
      job ||
      !bytes.current ||
      !complete ||
      rendering ||
      !printer
    )
      return;
    await submitPrint(async () => new Uint8Array(bytes.current!));
  }
  async function printHistoryReceipt(id: string, photoIndex = -1) {
    if (busy || job || !printer || printLock.current) return;
    await submitPrint(async () => {
      const saved = await readHistoryAssets(id);
      const source=photoIndex===-1?saved.receipt:saved.photos[photoIndex];
      if (!source)
        throw new Error("This saved image is no longer available to reprint.");
      const img = await image(source);
      const output = document.createElement("canvas");
      output.width = profiles[profile].width;
      output.height = Math.round(
        (output.width * img.naturalHeight) / img.naturalWidth,
      );
      if (output.height < 1 || output.height > 65535)
        throw new Error("This receipt size cannot be printed.");
      output
        .getContext("2d")!
        .drawImage(img, 0, 0, output.width, output.height);
      if(lightLicense.isTrial)applyTrialWatermark(output);
      return thermal(output, profile, gamma).bytes;
    });
  }
  async function submitPrint(prepareBytes: () => Promise<Uint8Array>) {
    if (!lightLicense.hasAccess()) {
      setError("A valid PhotoTags LRB license is required to print. Open Light license in Settings.");
      return;
    }
    if (printLock.current || job || !printer || busy) return;
    printLock.current = true;
    setWorking(true);
    setError("");
    let output: Uint8Array;
    try {
      output = await prepareBytes();
    } catch (e) {
      setError(`Could not prepare receipt: ${(e as Error).message}`);
      printLock.current = false;
      setWorking(false);
      return;
    }
    const id = crypto.randomUUID();
    if (!save("pendingPrint", id)) {
      setError(
        "Browser storage is unavailable. Printing is blocked because job safety state cannot be saved.",
      );
      printLock.current = false;
      setWorking(false);
      return;
    }
    setJob(id);
    setPrintMessage("Submitting one copy…");
    try {
      await printing.submit(host, printer, output);
      setPrintMessage(
        "Submitted to the helper. Physical output is unconfirmed. Check the printer before continuing.",
      );
    } catch (e) {
      setPrintMessage(
        `Output uncertain: ${(e as Error).message ?? "connection interrupted"}. Check the printer before sending anything else.`,
      );
    } finally {
      printLock.current = false;
      setWorking(false);
    }
  }
  function newSession() {
    photoDownloadCache.current.clear();
    historySession.current = null;
    setRetakesUsed(0);
    stopCamera();
    setShotCountState(1);
    setPhotos([null]);
    setPlacements([defaultPlacement()]);
    setActivePhotoState(0);
    setStickers([]);
    setStrokes([]);
    setError("");
    setLayout("portrait");
  }
  function exportImage() {
    if (complete && preview && !rendering)
      download(
        preview,
        `PhotoTags-LRB-${template.id}-${profiles[profile].width}.png`,
      );
  }
  async function prepare() {
    await refreshOffline();
    try {
      const ok = await navigator.storage?.persist?.();
      setPersistent(
        ok
          ? "Persistent storage granted."
          : "Persistent storage was not granted. The browser may clear offline files.",
      );
    } catch {
      setPersistent(
        "Persistent storage is unavailable. Recheck offline files before an event.",
      );
    }
  }

  function navigate(next: string) {
    if (next !== "booth") stopCamera();
    setTab(next);
  }
  async function loadTestArtwork() {
    setWorking(true);
    setError("");
    try {
      const testPhoto = await printerTestPhoto();
      setRetakesUsed(0);
      stopCamera();
      setShotCountState(1);
      setPhotos([testPhoto]);
      setPlacements([defaultPlacement()]);
      setActivePhotoState(0);
      setStickers([]);
      setStrokes([]);
      setTemplateId("super_snap");
      setLayout("portrait");
      setThermalView(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function resolvePrint() {
    if (save("pendingPrint", "")) {
      setJob("");
      setPrintMessage("");
    } else setError("Could not save print review state.");
  }
  function exportRaw() {
    if (bytes.current)
      download(
        new Blob([new Uint8Array(bytes.current).buffer]),
        `PhotoTags-LRB-${profile}.bin`,
      );
  }
  function repair() {
    void repairOffline().catch((e) => setError(e.message));
  }
  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
    }
  }
  return {
    lightLicense,
    ...photoHistory,
    printHistoryReceipt,
    captureEvent,
    ...kioskSettings,
    photoDownloadCache:photoDownloadCache.current,
    ...security,
    ...themeLibrary,
    availableThemes,
    launchThemes,
    setThemeVisible,
    branding,
    saveBranding,
    countdownSeconds,
    setCountdownSeconds,
    autoCapture,
    setAutoCapture,
    retakeLimit,
    setRetakeLimit,
    retakesUsed,
    retakesRemaining,
    canRetake,
    template,
    shotCount,
    setShotCount,
    photos,
    complete,
    hasPhotos,
    activePhoto,
    selectPhoto,
    placements,
    updatePlacement,
    stickers,
    addSticker,
    updateSticker,
    removeSticker,
    strokes,
    addStroke,
    undoStroke,
    clearStrokes,
    rendering,
    receiptSize,
    layout,
    setLayout,
    setTemplateId,
    profile,
    setProfile,
    gamma,
    setGamma,
    zoom,
    setZoom,
    mirror,
    setMirror,
    photo,
    preview,
    editorPreview,
    dimensions,
    thermalView,
    setThermalView,
    camera,
    cameraReady,
    setCameraReady,
    count,
    error,
    setError,
    working,
    tab,
    navigate,
    offline,
    persistent,
    update,
    online,
    host,
    setHost,
    printers,
    setPrinters,
    printer,
    setPrinter,
    job,
    printMessage,
    installPrompt,
    video,
    busy,
    stopCamera,
    openCamera,
    capture,
    captureSequence,
    upload,
    uploadMany,
    connect,
    print,
    newSession,
    exportImage,
    prepare,
    loadTestArtwork,
    resolvePrint,
    exportRaw,
    repair,
    install,
    updateSW,
  };
}
export type BoothModel = ReturnType<typeof useBooth>;
