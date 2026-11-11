import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { Studio } from "./Studio";
import { Kiosk } from "./Kiosk";
import { useBooth } from "./useBooth";
import "./style.css";
function App() {
  const booth = useBooth();
  const [kiosk, setKiosk] = useState(false);
  const ownsFullscreen = useRef(false);
  async function launch() {
    if (!booth.lightLicense.hasAccess()) {
      booth.navigate("license");
      return;
    }
    booth.stopCamera();
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      try {
        await document.documentElement.requestFullscreen();
        ownsFullscreen.current =
          document.fullscreenElement === document.documentElement;
      } catch {
        /* The viewport-sized dialog also works without browser fullscreen. */
      }
    }
    // Open the modal after fullscreen settles so it sits above the fullscreen root.
    setKiosk(true);
  }
  function close(setup = false) {
    booth.stopCamera();
    setKiosk(false);
    if (ownsFullscreen.current && document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    ownsFullscreen.current = false;
    if (setup) booth.navigate("print");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(setup ? "main" : ".launch-kiosk-button")
        ?.focus(),
    );
  }
  useEffect(() => {
    if (kiosk && booth.lightLicense.enabled && !booth.lightLicense.allowed) {
      close();
      booth.navigate("license");
    }
  }, [kiosk, booth.lightLicense.allowed]);
  return (
    <>
      <Studio
        booth={kiosk ? { ...booth, camera: false } : booth}
        onLaunchKiosk={launch}
      />
      {kiosk && (
        <Kiosk
          booth={booth}
          onClose={() => close()}
          onSetup={() => close(true)}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
