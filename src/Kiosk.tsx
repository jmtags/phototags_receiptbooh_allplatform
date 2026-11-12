import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Download,
  LoaderCircle,
  LockKeyhole,
  Maximize,
  Minimize,
  Printer,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import { artwork, profiles, templates, type ShotCount } from "./receipt";
import type { BoothModel } from "./useBooth";
import { ReceiptEditor } from "./ReceiptEditor";
import { brandStyle, welcomeBackground } from "./branding";
import { PinGate } from "./PinGate";
import { PhotoDownloadQr } from "./PhotoDownloadQr";
import { useKioskCountdown } from "./useKioskCountdown";

const steps = ["Choose layout", "Take a photo", "Choose theme", "Print & keep"];

export function Kiosk({
  booth: b,
  onClose,
  onSetup,
}: {
  booth: BoothModel;
  onClose: () => void;
  onSetup: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    startButton = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(0),
    [chosenShots, setChosenShots] = useState<ShotCount | null>(null),
    [chosenTheme, setChosenTheme] = useState(false);
  const [confirm, setConfirm] = useState<"exit" | "restart" | "shots" | null>(
      null,
    ),
    [hostReview, setHostReview] = useState(false);
  const [pendingShots, setPendingShots] = useState<ShotCount>(1);
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const [flash, setFlash] = useState(0);
  const previousCapture = useRef(b.captureEvent);
  useEffect(() => {
    if (b.captureEvent === previousCapture.current) return;
    previousCapture.current = b.captureEvent;
    setFlash(b.captureEvent);
    const timeout = setTimeout(() => setFlash(0), 420);
    return () => clearTimeout(timeout);
  }, [b.captureEvent]);
  const [exitTarget, setExitTarget] = useState<"settings" | "printer" | null>(
    null,
  );
  const exitFocus = useRef<HTMLElement | null>(null);
  function cancelUnlock() {
    setExitTarget(null);
    requestAnimationFrame(() => exitFocus.current?.focus());
  }
  function cancelConfirm() {
    setConfirm(null);
    requestAnimationFrame(() => exitFocus.current?.focus());
  }
  function requestSetup() {
    stopAutoCapture();
    if (b.hasPin) {
      exitFocus.current = document.activeElement as HTMLElement;
      setExitTarget("printer");
    } else onSetup();
  }
  const [autoPhase, setAutoPhase] = useState<
    "idle" | "waiting" | "running" | "done"
  >("idle");
  const autoRun = useRef(0);
  function stopAutoCapture() {
    autoRun.current++;
    setAutoPhase("done");
    b.stopCamera();
  }
  useEffect(() => {
    autoRun.current++;
    if (step !== 2) {
      setAutoPhase("idle");
      return;
    }
    if (!b.autoCapture || b.complete || b.job) return;
    const missing = b.photos.findIndex((photo) => !photo);
    if (missing < 0) return;
    b.selectPhoto(missing);
    setAutoPhase("waiting");
    void b.openCamera();
  }, [step, b.autoCapture]);
  useEffect(() => {
    if (step !== 2 || confirm || exitTarget || autoPhase !== "waiting") return;
    if (b.error && !b.camera) {
      setAutoPhase("done");
      return;
    }
    if (!b.camera || !b.cameraReady || b.busy) return;
    const run = autoRun.current;
    setAutoPhase("running");
    void b.captureSequence().finally(() => {
      if (autoRun.current === run) setAutoPhase("done");
    });
  }, [
    step,
    confirm,
    exitTarget,
    autoPhase,
    b.camera,
    b.cameraReady,
    b.busy,
    b.error,
  ]);
  useEffect(() => {
    const modal = dialog.current!;
    modal.showModal();
    startButton.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      autoRun.current++;
      if (modal.open) modal.close();
      b.stopCamera();
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    if (step > 0) heading.current?.focus();
    else startButton.current?.focus();
  }, [step]);
  function go(next: number) {
    if (b.busy || b.job) return;
    stopAutoCapture();
    b.setError("");
    if(next===3 && !chosenTheme && b.availableThemes[0]){b.setTemplateId(b.availableThemes[0].id);setChosenTheme(true);}
    setStep(next);
  }
  function start() {
    if (b.job || b.busy) return;
    b.newSession();
    setChosenShots(null);
    setChosenTheme(false);
    setHostReview(false);
    setStep(1);
  }
  function requestExit() {
    stopAutoCapture();
    if (b.hasPin) {
      if (!exitTarget) {
        exitFocus.current = document.activeElement as HTMLElement;
        setExitTarget("settings");
      }
      return;
    }
    if (step > 0 || b.hasPhotos || b.job) {
      exitFocus.current = document.activeElement as HTMLElement;
      setConfirm("exit");
    } else onClose();
  }
  function restart() {
    if (b.busy || b.job) return;
    b.stopCamera();
    if (b.hasPhotos) {
      exitFocus.current = document.activeElement as HTMLElement;
      setConfirm("restart");
    } else finish();
  }
  function finish() {
    if (b.busy || b.job) return;
    b.newSession();
    setChosenShots(null);
    setChosenTheme(false);
    setHostReview(false);
    setConfirm(null);
    setExitTarget(null);
    setStep(0);
  }
  const resetRemaining=useKioskCountdown(step===4&&!b.busy&&!b.job,b.kioskResetSeconds,finish);
  const titles = [
    "Good times start here.",
    "How many shots?",
    "Find your good side.",
    "Make it yours.",
    "Your little keepsake is ready.",
  ];
  const subtitles = [
    "A photo, a little personality, and a receipt to keep.",
    "One moment or a whole little story. Choose 1, 2, 3 or 4 shots.",
    `A ${b.countdownSeconds}-second countdown before every shot. You bring the smile.`,
    "Choose a theme. Drag, pinch & twist to adjust.",
    "One last look, then make it a memory you can hold.",
  ];
  const canContinue =
    step === 1
      ? !!chosenShots
      : step === 2
        ? b.complete && !b.camera && !b.busy && !!b.preview && !b.rendering
        : step === 3
          ? chosenTheme && !!b.preview && !b.busy && !b.rendering
          : false;
  const exitControl = (
    <button
      className={`button kiosk-exit ${step === 0 ? "kiosk-exit-floating" : ""}`}
      onClick={requestExit}
      aria-label="Exit kiosk"
      title="Exit kiosk"
    >
      <X aria-hidden="true" size={20} />
    </button>
  );
  return (
    <dialog
      ref={dialog}
      className={`kiosk-dialog ${step === 3 ? "is-theme-step" : ""} ${step === 2 ? `is-camera-step ${cameraExpanded ? "is-camera-expanded" : ""}` : ""}`}
      style={brandStyle(b.branding)}
      aria-label="PhotoTags LRB guest kiosk"
      onCancel={(e) => {
        e.preventDefault();
        if (exitTarget) cancelUnlock();
        else requestExit();
      }}
    >
      {step > 0 ? (
        <header className="kiosk-header has-step-progress">
          <nav className="kiosk-progress" aria-label="Booth progress">
            <ol>
              {steps.map((label, i) => (
                <li
                  key={label}
                  aria-current={step === i + 1 ? "step" : undefined}
                  className={step > i + 1 ? "complete" : ""}
                >
                  <span aria-hidden="true">
                    {step > i + 1 ? <Check size={15} /> : i + 1}
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
          </nav>
          {exitControl}
        </header>
      ) : (
        exitControl
      )}
      <div
        className={`kiosk-body ${step === 0 ? "kiosk-welcome" : ""} ${step === 0 && b.branding.background ? "has-brand-background" : ""}`}
        style={step === 0 ? welcomeBackground(b.branding) : undefined}
      >
        {step === 0 ? (
          <section className="kiosk-welcome-content">
            {b.branding.logo ? (
              <div className="kiosk-welcome-logo">
                <img src={b.branding.logo} alt="" />
              </div>
            ) : (
              <div className="kiosk-receipt-fan" aria-hidden="true">
                {[templates[3], templates[0], templates[4]].map((t) => (
                  <img
                    key={t.id}
                    src={artwork(t)}
                    alt=""
                    width="120"
                    height="288"
                  />
                ))}
              </div>
            )}
            <span className="kiosk-welcome-label">Step in. Be yourself.</span>
            <h1>{b.branding.headline}</h1>
            <p>{b.branding.message}</p>
            <button
              ref={startButton}
              className="button kiosk-start"
              onClick={start}
              disabled={b.busy || !!b.job}
            >
              <Camera aria-hidden="true" size={28} />
              {b.hasPhotos ? "Start a new session" : b.branding.startLabel}
              <ArrowRight aria-hidden="true" size={25} />
            </button>
            {b.hasPhotos && (
              <>
                <button
                  className="button kiosk-resume"
                  onClick={() => {
                    setChosenShots(b.shotCount);
                    setChosenTheme(true);
                    setStep(b.complete ? 3 : 2);
                  }}
                >
                  Continue my current receipt
                </button>
                <p className="kiosk-small">
                  Starting a new session clears your photos and decorations.
                </p>
              </>
            )}
            <div className="kiosk-welcome-steps">
              {steps.map((label, i) => (
                <span key={label}>
                  <b>{i + 1}</b>
                  {label}
                </span>
              ))}
            </div>
            <div className="kiosk-private">
              <LockKeyhole aria-hidden="true" size={14} />
              {b.autoDownloadQr ? "Your decorated receipt download is prepared automatically in the final step." : "Your photos stay here unless you choose online download."}
            </div>
          </section>
        ) : (
          <>
            <div className="kiosk-step-heading">
              <span>Step {step} of 4</span>
              <h1 ref={heading} tabIndex={-1}>
                {titles[step]}
              </h1>
              <p>{subtitles[step]}</p>
            </div>
            {b.error && (
              <div className="alert kiosk-error" role="alert">
                <div>{b.error}</div>
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => b.setError("")}
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
            )}
            {step === 1 && (
              <div
                className="kiosk-layouts shot-count-layouts"
                role="group"
                aria-label="Choose shot count"
              >
                {([1, 2, 3, 4] as const).map((count) => (
                  <button
                    key={count}
                    className={`kiosk-layout-card ${chosenShots === count ? "selected" : ""}`}
                    aria-pressed={chosenShots === count}
                    aria-label={`${count} ${count === 1 ? "shot" : "shots"}`}
                    disabled={
                      b.hasPhotos && b.retakeLimit >= 0 && count !== b.shotCount
                    }
                    onClick={() => {
                      if (count !== b.shotCount && b.hasPhotos) {
                        exitFocus.current =
                          document.activeElement as HTMLElement;
                        setPendingShots(count);
                        setConfirm("shots");
                      } else {
                        setChosenShots(count);
                        b.setShotCount(count);
                      }
                      b.setLayout("portrait");
                    }}
                  >
                    <span className="kiosk-choice-check" aria-hidden="true">
                      {chosenShots === count && <Check size={18} />}
                    </span>
                    <img
                      className="shot-layout-art"
                      src={`/assets/receipt_58mm_${count}_${count === 1 ? "shot" : "shots"}.png`}
                      alt=""
                      width="112"
                      height="306"
                    />
                    <strong>
                      {count} {count === 1 ? "shot" : "shots"}
                    </strong>
                    <span>
                      {
                        [
                          "One perfect moment",
                          "Two moments to keep",
                          "A little photo story",
                          "Four-frame memories",
                        ][count - 1]
                      }
                    </span>
                  </button>
                ))}
                {b.hasPhotos && b.retakeLimit >= 0 && (
                  <p className="shot-limit-note">
                    This session keeps its shot count after photos are taken.
                    Start over to choose a different layout.
                  </p>
                )}
              </div>
            )}
            {step === 2 && (
              <section
                className="kiosk-photo-step"
                aria-label="Take your photo"
              >
                <div
                  className="shot-gallery"
                  role="group"
                  aria-label="Your photos"
                >
                  {b.photos.map((src, index) => (
                    <button
                      key={index}
                      aria-label={`Select photo ${index + 1}`}
                      aria-pressed={b.activePhoto === index}
                      disabled={b.busy}
                      onClick={() => {
                        stopAutoCapture();
                        b.selectPhoto(index);
                      }}
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={`Photo ${index + 1} captured`}
                          width="70"
                          height="70"
                        />
                      ) : (
                        <Camera aria-hidden="true" size={24} />
                      )}
                      <span>Photo {index + 1}</span>
                      <small>
                        {src
                          ? "Captured"
                          : b.activePhoto === index
                            ? "Ready"
                            : "Waiting"}
                      </small>
                    </button>
                  ))}
                </div>
                <div className="camera-workspace">
                  <div
                    className={`kiosk-camera ${b.photo && !b.camera ? "has-photo" : ""}`}
                  >
                    {flash > 0 && (
                      <div
                        key={flash}
                        className="shutter-flash"
                        aria-hidden="true"
                      />
                    )}
                    <span className="sr-only" role="status">
                      {flash > 0 ? "Photo captured" : ""}
                    </span>
                    {b.camera ? (
                      <>
                        <video
                          ref={b.video}
                          autoPlay
                          muted
                          playsInline
                          aria-label="Live camera preview"
                          onLoadedData={() => b.setCameraReady(true)}
                        />
                        <div
                          className={`kiosk-crop-guide ${b.layout}`}
                          aria-hidden="true"
                        />
                        {b.count > 0 && (
                          <div
                            className="countdown"
                            role="status"
                            aria-label={`Capturing in ${b.count} seconds`}
                          >
                            {b.count}
                          </div>
                        )}
                      </>
                    ) : b.photo ? (
                      <img
                        src={b.photo}
                        alt="Your captured photo"
                        style={{
                          transform: `scale(${b.mirror ? -b.zoom : b.zoom}, ${b.zoom})`,
                        }}
                        width="1600"
                        height="1200"
                      />
                    ) : (
                      <div className="kiosk-camera-empty">
                        <Camera
                          aria-hidden="true"
                          size={56}
                          strokeWidth={1.3}
                        />
                        <h2>Your camera is off.</h2>
                        <p>Tap Open camera when you’re ready.</p>
                      </div>
                    )}
                    <button
                      className="button camera-size-button camera-overlay-control"
                      aria-label={
                        cameraExpanded
                          ? "Restore camera view"
                          : "Enlarge camera view"
                      }
                      aria-pressed={cameraExpanded}
                      onClick={() => setCameraExpanded((value) => !value)}
                    >
                      {cameraExpanded ? (
                        <Minimize size={19} aria-hidden="true" />
                      ) : (
                        <Maximize size={19} aria-hidden="true" />
                      )}
                      {cameraExpanded ? "Restore view" : "Enlarge view"}
                    </button>
                    {b.camera &&
                      autoPhase !== "waiting" &&
                      autoPhase !== "running" && (
                        <button
                          className="button camera-stop-button camera-overlay-control"
                          onClick={stopAutoCapture}
                        >
                          <X size={18} aria-hidden="true" /> Close camera
                        </button>
                      )}
                    {(autoPhase === "waiting" || autoPhase === "running") && (
                      <div className="auto-capture-progress">
                        <p role="status" className="sr-only">
                          {autoPhase === "waiting"
                            ? "Automatic capture: waiting for camera permission and preview…"
                            : "Automatic capture is running. Get ready for each countdown."}
                        </p>
                        <button
                          className="button button-secondary"
                          onClick={stopAutoCapture}
                        >
                          Stop automatic capture
                        </button>
                      </div>
                    )}
                    <div className="kiosk-camera-status">
                      <span>
                        {b.camera
                          ? autoPhase === "waiting"
                            ? "Allow camera access to begin"
                            : "Find your frame"
                          : b.photo
                            ? "Looking good."
                            : "Only you and your camera."}
                      </span>
                      <span>
                        <Timer aria-hidden="true" size={15} />
                        {b.countdownSeconds}-second countdown
                      </span>
                    </div>
                  </div>
                  <div className="kiosk-photo-actions">
                    <button
                      className="button button-primary kiosk-camera-button"
                      aria-label={
                        b.count
                          ? `Capturing… ${b.count}`
                          : b.camera
                            ? b.shotCount > 1 && !b.photo
                              ? `Take ${b.photos.filter((p) => !p).length} photos`
                              : "Take my photo"
                            : b.photo
                              ? "Retake photo"
                              : "Open camera"
                      }
                      aria-describedby="kiosk-retakes"
                      disabled={
                        b.busy ||
                        (!!b.photo && !b.canRetake) ||
                        autoPhase === "waiting" ||
                        autoPhase === "running" ||
                        (b.camera && !b.cameraReady)
                      }
                      onClick={b.camera ? b.captureSequence : b.openCamera}
                    >
                      {b.count ? (
                        <LoaderCircle
                          className="spinner"
                          aria-hidden="true"
                          size={24}
                        />
                      ) : b.photo && !b.camera ? (
                        <RotateCcw aria-hidden="true" size={24} />
                      ) : (
                        <Camera aria-hidden="true" size={24} />
                      )}

                      <span
                        id="kiosk-retakes"
                        className="retake-progress sr-only"
                        role="status"
                      >
                        {b.retakeLimit < 0
                          ? "Unlimited retakes"
                          : `${b.retakesRemaining} ${b.retakesRemaining === 1 ? "retake" : "retakes"} remaining this session`}
                      </span>
                      {b.hasPhotos && (
                        <span className="camera-retake-badge" aria-hidden="true">
                          {b.retakeLimit < 0 ? "\u221e" : b.retakesRemaining}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                {b.photo && !b.camera && (
                  <div className="kiosk-photo-adjust">
                    <label>
                      <span>Photo zoom</span>
                      <input
                        aria-orientation={cameraExpanded ? "vertical" : "horizontal"}
                        type="range"
                        name="kiosk-zoom"
                        min="1"
                        max="2"
                        step=".05"
                        value={b.zoom}
                        onChange={(e) => b.setZoom(+e.target.value)}
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        name="kiosk-mirror"
                        checked={b.mirror}
                        onChange={(e) => b.setMirror(e.target.checked)}
                      />
                      Mirror photo
                    </label>
                  </div>
                )}
              </section>
            )}
            {step === 3 && (
              <ReceiptEditor
                booth={b}
                chosen={chosenTheme}
                onChoose={() => setChosenTheme(true)}
              />
            )}
            {step === 4 && (
              <div className="kiosk-print-step">
                <div className="kiosk-final-preview">
                  {b.preview ? (
                    <img
                      src={b.preview}
                      alt="Your final receipt"
                      width="230"
                      height="552"
                    />
                  ) : (
                    <div className="kiosk-loading" role="status">
                      Preparing receipt…
                    </div>
                  )}

                  {!b.job && (
                    <button
                      className="button button-primary kiosk-print-button"
                      disabled={
                        !b.printer ||
                        b.busy ||
                        !b.preview ||
                        !b.complete ||
                        b.rendering
                      }
                      onClick={b.print}
                    >
                      <Printer aria-hidden="true" size={25} />
                      Print my receipt
                    </button>
                  )}
                </div>
                <section
                  className="kiosk-print-actions"
                  aria-label="Print your receipt"
                >
                  <div className="kiosk-receipt-summary">
                    <CheckCircle2 aria-hidden="true" size={24} />
                    <div>
                      <h2>{b.template.name}</h2>
                      <p>
                        {b.layout === "square"
                          ? "Square frame"
                          : "Portrait frame"}{" "}
                        / {b.shotCount} {b.shotCount === 1 ? "photo" : "photos"}
                      </p>
                    </div>
                  </div>
                  <PhotoDownloadQr booth={b} />
                  {b.job ? (
                    <div className="kiosk-job" role="status">
                      <Printer aria-hidden="true" size={27} />
                      <h2>
                        {b.working
                          ? "Sending your receipt…"
                          : b.printMessage.startsWith("Submitted")
                            ? "Sent to the print helper."
                            : "Your host can help with this."}
                      </h2>
                      <p>{b.printMessage}</p>
                      <p>
                        Please ask your host to check the receipt before
                        continuing.
                      </p>
                      {!hostReview ? (
                        <button
                          className="button button-secondary"
                          disabled={b.working}
                          onClick={() => setHostReview(true)}
                        >
                          Host: review this print
                        </button>
                      ) : (
                        <div className="kiosk-host-review">
                          <strong>Inspect the paper and printer queue.</strong>
                          <p>
                            Only clear this job after checking whether it
                            printed. Clearing does not send another copy.
                          </p>
                          <button
                            className="button button-secondary"
                            disabled={b.working}
                            onClick={() => {
                              b.resolvePrint();
                              setHostReview(false);
                            }}
                          >
                            I checked the printer
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {b.printer ? (
                        <p className="kiosk-printer-ready">
                          <Printer aria-hidden="true" size={16} />
                          Queue selected: {b.printer}
                          <span>{profiles[b.profile].name}</span>
                        </p>
                      ) : (
                        <div className="kiosk-setup-needed">
                          <Printer aria-hidden="true" size={23} />
                          <h3>Your host needs to connect a printer.</h3>
                          <p>
                            You can save your receipt now. Your photo will stay
                            available when the host opens setup.
                          </p>
                          <button
                            className="button button-secondary"
                            onClick={requestSetup}
                          >
                            Host: open printer setup
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <button
                    className="button button-secondary kiosk-save"
                    disabled={
                      !b.preview || b.busy || !b.complete || b.rendering
                    }
                    onClick={b.exportImage}
                  >
                    <Download aria-hidden="true" size={19} />
                    Save receipt PNG
                  </button>
                  <button
                    className="button button-quiet kiosk-finish"
                    disabled={!!b.job || b.busy}
                    onClick={finish}
                  >
                    Finish session
                    <ArrowRight aria-hidden="true" size={18} />
                  </button>
                </section>
              </div>
            )}
          </>
        )}
      </div>
      {step > 0 && (
        <footer className="kiosk-footer">
          <button
            className="button kiosk-back"
            disabled={b.busy || !!b.job}
            onClick={() => (step === 1 ? restart() : go(step - 1))}
          >
            <ArrowLeft aria-hidden="true" size={20} />
            {step === 1 ? "Start over" : "Back"}
          </button>
          {step<4 && <span className="kiosk-footer-note">
            <LockKeyhole aria-hidden="true" size={14} />
            {b.autoDownloadQr ? "Download links prepared in Step 4." : "Saved here. Shared only when you choose."}
          </span>}
          {step < 4 ? (
            <button
              className="button button-primary kiosk-next"
              disabled={!canContinue || b.busy || !!b.job}
              onClick={() => go(step + 1)}
            >
              {step === 1
                ? "Continue to camera"
                : step === 2
                  ? "Continue to themes"
                  : "Review receipt"}
              <ArrowRight aria-hidden="true" size={21} />
            </button>
          ) : (
            <div className="kiosk-footer-end">
              {b.kioskResetSeconds>0 && <div className="kiosk-reset-counter" role="timer" aria-label="Session reset countdown">{b.job||b.busy ? <span>Timer paused</span> : <><span>Starting over in</span><strong>{Math.floor((resetRemaining??b.kioskResetSeconds)/60)}:{String((resetRemaining??b.kioskResetSeconds)%60).padStart(2,"0")}</strong></>}</div>}
            <button
              className="button kiosk-back"
              disabled={b.busy || !!b.job}
              onClick={restart}
            >
              <RotateCcw aria-hidden="true" size={18} />
              Start over
            </button>
            </div>
          )}
        </footer>
      )}
      {(exitTarget || confirm) && (
        <KioskPrompt
          labelId={exitTarget ? "pin-heading" : "kiosk-confirm-heading"}
          onCancel={exitTarget ? cancelUnlock : cancelConfirm}
        >
          {exitTarget ? (
            <PinGate
              booth={b}
              onCancel={cancelUnlock}
              onUnlock={() => {
                if (exitTarget === "printer") onSetup();
                else onClose();
              }}
            />
          ) : confirm ? (
            <section className="kiosk-confirm">
              <div className="kiosk-confirm-icon">
                <RotateCcw aria-hidden="true" size={32} />
              </div>
              <h1 id="kiosk-confirm-heading">
                {confirm === "exit"
                  ? "Return to Settings?"
                  : confirm === "shots"
                    ? "Change your shot count?"
                    : "Start this memory again?"}
              </h1>
              <p>
                {confirm === "exit"
                  ? "Your photo and any unresolved print stay available for the host to review."
                  : confirm === "shots"
                    ? "Changing the layout clears your photos, stickers and signature so you can capture a new set."
                    : "This clears your photos and takes you back to the Start screen."}
              </p>
              {b.job && (
                <p className="kiosk-print-note">
                  The last print needs review. Leaving will not send it again.
                </p>
              )}
              <div className="kiosk-confirm-actions">
                <button
                  className="button button-primary"
                  onClick={cancelConfirm}
                >
                  Keep booth open
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    if (confirm === "exit") {
                      if (b.hasPin) requestExit();
                      else onClose();
                    } else if (confirm === "shots") {
                      b.setShotCount(pendingShots);
                      setChosenShots(pendingShots);
                      cancelConfirm();
                    } else finish();
                  }}
                >
                  {confirm === "exit"
                    ? "Exit to Settings"
                    : confirm === "shots"
                      ? "Clear photos & change layout"
                      : "Clear photos & start over"}
                </button>
              </div>
            </section>
          ) : null}
        </KioskPrompt>
      )}
    </dialog>
  );
}

function KioskPrompt({
  children,
  labelId,
  onCancel,
}: {
  children: ReactNode;
  labelId: string;
  onCancel: () => void;
}) {
  const prompt = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = prompt.current!;
    modal.showModal();
    modal
      .querySelector<HTMLElement>(
        "input:not(:disabled), .kiosk-confirm-actions button",
      )
      ?.focus();
    return () => {
      if (modal.open) modal.close();
    };
  }, []);
  return (
    <dialog
      ref={prompt}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className="kiosk-prompt"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), [href], [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <button
        className="icon-button kiosk-prompt-close"
        aria-label="Close dialog"
        onClick={onCancel}
      >
        <X size={20} aria-hidden="true" />
      </button>
      {children}
    </dialog>
  );
}
