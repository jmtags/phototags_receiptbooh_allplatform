# Receipt Booth milestone architecture

Decision recorded before implementation, 2026-11-10. Scope: independent local project; Android and website references remain read-only. No deployment.

React + TypeScript + Vite, canvas composition and Workbox precaching. No camera frames or uploaded photos leave the device except an explicit print to the configured helper. Photos stay in session memory; preferences use guarded localStorage. Originals are copied with SHA-256 provenance. The Manrope variable font is bundled locally and precached; no external font service is used. The studio interface is separated from the booth state/processing logic in Studio.tsx and useBooth.ts.

Template records separate artwork and normalized photo rectangles from shot layouts. This milestone exposes one photo and existing design artwork. Canvas uses each artwork's source aspect ratio, Android's normalized photo area and 0.006-width inset, cover cropping and a frame. Printer profiles are independent of the QZ connection. Deli is 384 dots (~48mm image); G80 is 576 dots (~72mm image on 80mm stock). Photo bytes are generated locally. Deli follows ThermalEscPosJob (threshold 148, Floyd–Steinberg, ESC * 33 bands). G80 follows G80PhotoRaster (gamma 1/1.5/2, serpentine error diffusion, exact pure ink/paper, full GS v 0 raster). No invented heat commands. Android layout, brightness filters, decorations and arbitrary custom editing are not all ported.

Read references: MainActivity.kt (ReceiptboothDesignTemplate, composeReceiptboothDesignBitmap, receiptboothDesignPhotoSlots, drawReceiptDesignFrame); ThermalEscPosJob.kt; G80PhotoImageJob.kt; G80PhotoRaster.kt; ThermalUsbPhotoIdentity.kt; UsbPrinterManager.kt; BluetoothPrinterManager.kt; VozyG80BluetoothTransfer.kt. Paths are under C:/codes/Android_PHOTOTAGS/app/src/main/java/com/phototags. Android uses device identity to select G80 and preserves a continuous Bluetooth image stream. This app requires explicit profile selection; it does not port Android USB or Bluetooth transports.

## Printing decision and constraints

Use bundled qz-tray JS with locally installed QZ Tray on Windows/macOS and an explicitly selected OS raw printer queue. Sending host-encoded raw base64 avoids driver image rescaling and preserves G80 commands. Operator must configure a raw queue that passes ESC/POS unchanged. A successful QZ promise means submitted to the helper, never physical print confirmation. Persist an unresolved job marker before transmission; block another job until the operator checks paper and resolves it. Never retry automatically, including after a reload or transport failure.

QZ is an external installed helper, not part of the PWA cache. Its JS dependency is bundled. Unsigned attended mode is the initial proof: QZ asks the operator to authorize the site/operations. No private keys in browser storage. Production silent mode requires per-message signing by a trusted local signer or backend and a QZ trusted certificate (purchased certificate/support or managed own root). A cloud-only signer would break fully offline operation. Review QZ's LGPL distribution obligations before redistributing the helper; this project does not redistribute its installer. Retain dependency license notices.

### iPhone/iPad LAN candidate (experimental, unverified)

HTTPS PWA → WSS QZ print server on Windows/macOS → raw OS queue → USB Deli/G80. Safari PWA does not offer Android-style direct USB or Bluetooth SPP. No AirPrint support is asserted for either printer.

Operator supplies a stable hostname (DHCP reservation/local DNS); no browser subnet scanning or discovery. Configure QZ to listen on the LAN per its guide, generate a certificate with that exact DNS name/IP in SAN, and trust the CA on each client. iOS requires installing the certificate profile and enabling full trust in Certificate Trust Settings. Open and verify the secure server endpoint before connecting; permit only the necessary LAN port (normally 8181). Never bypass HTTPS or disable browser security. The app uses only secure WebSockets. Browser local-network permission must be granted where prompted; OS/browser/version behavior requires testing. TLS certificate trust is distinct from QZ's site authorization/message signing. Allow only this booth origin via QZ Site Manager, use attended prompts for this proof, and keep the bridge on a trusted LAN with firewall restrictions. Do not expose it to the internet. No shared password or signing key embedded in the PWA.

Internet is needed for first installation, certificate/helper provisioning and updates. A configured LAN can operate without internet, but offline certificate validation, permission prompts, host resolution and iOS PWA reconnect must be verified on real devices. LAN implementation is a configurable secure QZ client, not a verified turnkey bridge. No physical printing or iOS access has yet been demonstrated.

## Offline and updates

Versioned precache includes all shipped templates, logos, icons, application chunks and QZ JS. Ready status audits every precache entry plus selected artwork, checks the controlling worker, and requests persistent storage (denial is reported). Cache checks run at startup, on focus and manually. Missing files clear readiness; repair requires internet. A waiting worker is applied only by an explicit action between sessions after the photo/camera is cleared and any unresolved print is reviewed. No skip-waiting on active sessions. A first worker may claim its first client without changing an existing version. Browser storage can still be evicted.

## Official research sources (accessed 2026-11-10)

- https://qz.io/docs/getting-started — helper installation and JS connection
- https://qz.io/docs/raw — raw byte/base64 jobs and raw printer setup
- https://qz.io/docs/pixel — driver-mediated images considered; raw chosen for device fidelity
- https://qz.io/docs/print-server — LAN binding and client certificate provisioning, including iOS
- https://qz.io/docs/lna — changing browser local network access requirements
- https://qz.io/docs/signing — per-operation signing for silent mode
- https://qz.io/docs/faq and https://qz.io/ — licensing/support/certificate options

## Future website connection

Keep this Vite app on its own HTTPS origin, e.g. booth.example.com. Existing website can later add an ordinary “Open Receipt Booth” link. No shared backend or source-project filesystem access is required. If hosting under a path, adjust Vite base, manifest scope/start_url and service worker fallback together. No existing website edits or deployment are part of this milestone.

## Guest kiosk mode

Kiosk.tsx provides an isolated guest workflow over the existing useBooth model. Layout (portrait or centered square), design/theme, and printer profile remain separate. Main application owns optional browser fullscreen; the native dialog opens after its request settles. The studio never mounts a competing video while the guest dialog owns camera capture. No extra runtime services or remote dependencies are introduced. See KIOSK.md for session, printing, focus and validation details.
