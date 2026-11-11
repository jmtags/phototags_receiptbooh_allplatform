# PhotoTags Receipt Booth

Independent, local-first React / TypeScript / Vite PWA. One-to-four-photo booth with five original Android receipt designs and 176 original stickers; Deli ES423 (384 dots) and VOZY G80 (576 dots) rendering. No deployment, Android edits or existing website edits.

The Settings page has a sidebar for Overview, Branding, Camera, Event themes, Photo history, Security, Receipt output, Printer connection, Offline & installation, and About the system. Capture, themes, stickers and receipt previews live in the guest kiosk. The interface uses locally bundled Manrope typography and Lucide icons. [Design decisions and open-source references](docs/DESIGN.md).

## Run

Node.js 22.12+ recommended; npm lockfile included.

```powershell
cd C:\codes\PhotoTagsReceipt_Booth_ALL
npm ci
npm run build
npm run preview -- --port 4173
```

Open **http://localhost:4173** on this computer. Development: `npm run dev`. Preview serves the production PWA; development mode does not install its offline worker. For another device, serve `dist/` using a trusted HTTPS origin with an SPA fallback to index.html. Plain HTTP over LAN does not provide camera/PWA permissions. Do not use file://. Nothing is published by these commands.

## Use

1. In **Settings > Receipt output**, choose the Deli or G80 profile and thermal/color preview preference. Under **Printer connection > Photo lightness**, choose Natural, Lighter photos or Lightest photos; each printer profile saves its own choice. Deli defaults to Natural, while G80 retains Lighter photos as its default. Lightness applies to thermal previews, thermal PNGs and print data; color PNGs keep their original tones. Output settings persist on this device when browser storage is available.
2. Open **Printer connection** to configure QZ Tray and explicitly select the queue. Review the offline package and the event checklist before launching.
3. Choose **Launch kiosk** for the complete photo, decoration, preview and PNG/print workflow. Super Snap exports at 384 by 922 or 576 by 1383 pixels; other themes retain their artwork proportions.
4. In Offline & installation, check **Ready for offline use** and request persistent storage. Reopen and verify on the intended device before an event. All five shipped templates, 176 stickers, shot-layout previews and printing JS are cached. Initial setup and updates need internet. If files are missing, end the session and repair the package while online.
5. Install using Chrome/Edge's install command; macOS Safari Add to Dock where available; iPhone/iPad Safari Share → Add to Home Screen. Ending a session clears the kiosk workspace. Captured photos and finished receipts remain in local Photo history until deleted or this site?s browser data is cleared.

## Kiosk branding

In **Settings > Branding**, open **Kiosk branding** to upload your logo and welcome background and edit the brand/event name, tagline, welcome headline, message, Start button text and accent color. The live preview shows your draft. Choose **Save branding** to apply it; **Restore default branding** returns to PhotoTags styling. The saved logo, background and text remain available offline in this browser. Branding applies to the kiosk welcome content; original receipt designs retain their printed artwork.

Logo and background uploads accept PNG, JPEG and WebP up to 10 MB each. Logos are resized locally to at most 640 pixels; backgrounds to 1600 pixels and shown with a dark overlay for readable welcome text. Images are stored locally, without a server upload. A save failure keeps the previous saved branding and reports the error. Clearing this site's browser storage also clears its branding.

## Camera timer

Open **Settings > Camera** and select **Capture countdown**, from 1 to 15 seconds (default 3). The value saves on this device and applies separately to every shot and retake. Enable **Automatic capture in Step 2** to open the camera and start capturing all empty slots as soon as the preview is ready. This switch is off by default and also saves locally. Guests can stop automatic capture and use the manual camera or image upload. Returning to a completed photo step keeps existing photos; camera permission denial does not automatically retry. Starting or finishing a guest session preserves the admin timer. Exit or navigation cancels the active countdown and stops the camera.

## Retakes

In **Settings > Camera**, set **Retakes per guest session** to 0-10 or Unlimited (the default). Every successfully replaced photo uses one retake, including replacement uploads. First captures, failed uploads and cancelled countdowns are free. The budget is shared across the selected photos and stays intact when navigating back or resuming the receipt. A new session resets it. With a finite limit, the shot count stays fixed after capture; start a new session to choose a different count.

## Event themes

Open **Settings > Event themes**. Enter an event and theme name, then build a receipt with custom headline, subtitle, footer and border style, or upload portrait receipt artwork. Drag the photo area or adjust its left, top, width and height controls. Preview 1-4 shots before choosing **Save theme for event**.

Saving activates that event. The kiosk collection initially includes its saved themes alongside all five built-in themes. Under **Themes shown in launch mode**, check which built-in and custom themes guests can choose. Keep at least one selected. Selections save automatically for each active event, including a separate All events selection. New themes are shown by default. Select another **Active event**, or **All events**, to switch collections. Saved designs can be edited in place or deleted with confirmation.

Event artwork, layout coordinates and design settings are stored in this browser's IndexedDB and work offline. They are separate from the bundled offline package; repairing the package keeps saved themes. Clearing this site's full browser data removes them. Uploads accept PNG/JPEG/WebP up to 10 MB, with height between one and five times the width. Artwork is normalized locally and shared by the native-width PNG and thermal print composition.

## Guest kiosk

Choose **Launch kiosk** from Settings. The app requests browser fullscreen where available, then opens a viewport-sized native dialog with a large **Start** button. If fullscreen is unavailable or denied, the dialog still fills the browser window.

Guests follow four steps:

1. **Choose layout:** choose 1, 2, 3 or 4 shots.
2. **Take photos:** a large live camera fills the available workspace. Use **Enlarge view** for video across the kiosk and **Restore view** to return. Dark translucent capture, upload, stop and navigation controls stay over the preview. Capture every empty slot with a separate admin-configured countdown and a brief shutter flash after each shot, or choose multiple local images. Select any slot to replace or retake it. All slots must be filled to continue.
3. **Decorate:** choose from the vertical theme collection beside the large receipt preview. Add original APK stickers from the horizontal category strip; drag, resize or rotate them. Move, pinch to zoom or mirror each photo, and draw a signature. Arrow controls provide alternatives to dragging. Decorations appear in both PNG and printer output.
4. **Print & keep:** save the PNG or send one copy to the host's configured printer queue.

Configure the printer before launching the kiosk before opening the kiosk. If no queue is selected, printing stays disabled and the host can return to setup with the guest's photo intact. Submission does not confirm physical output: every print remains unresolved until the host checks the paper/queue. A pending job blocks another print and the next session. No print is triggered by entering a step.

**Finish session** clears the guest photo and returns to the Start screen. **Exit kiosk** returns to the studio, retaining the photo and any unresolved job for review. Start-over and shot-count-change confirmations protect captured photos; camera tracks stop on exit, cancellation and step changes. Browser Escape/fullscreen behavior remains available; this is a guided web kiosk, not OS-level device lockdown. Native fullscreen and mobile safe-area behavior still need real-device acceptance tests.

## Printing proof

Install [QZ Tray](https://qz.io/docs/getting-started) separately on the computer connected to the USB printer. Configure a [raw printer queue](https://qz.io/docs/raw) so the driver passes bytes unchanged. In Printer connection, use `localhost`, connect, approve QZ's permission prompts and explicitly select the queue. Print sends one raw image with the selected profile, without driver scaling. G80 has its own gamma, serpentine dithering and full-height raster commands; Deli has 24-row image bands. The receipt includes feed/cut commands matching Android; verify your hardware's support.

For a hardware check without a camera, choose **Load printer test artwork** in Printer connection, select your profile and queue, then send one receipt. This composes original Super Snap artwork, the PhotoTags logo and a grayscale ramp. It replaces the current session photo. Export the raw ESC/POS job there if you need to inspect its bytes.

Successful submission is **not** a claim that paper printed. Every attempt leaves a saved unresolved marker. Check printer output and queue before clearing it. A failed/closed connection never automatically retries. Do not resend an uncertain job until paper/queue inspection rules out duplicates. The attended proof uses unsigned QZ prompts; production silent use needs trusted certificates and a secure offline-capable signer. No private signing keys are shipped.

On iPhone/iPad, a manually configured QZ LAN host is an **experimental bridge candidate**. A trusted certificate for that host, client trust setup, QZ origin authorization, LAN firewall/permissions and actual Safari/PWA tests are still required. No direct Safari USB/Bluetooth or AirPrint support is claimed. See [architecture and official research](docs/ARCHITECTURE.md) before configuring it.

## Validation and artifacts

```powershell
npm test
```

Tests use installed Google Chrome headlessly through Playwright. Configure `channel` in playwright.config.ts if Chrome is elsewhere. Tests cover three viewport sizes, camera denial/missing device, synthetic media-stream countdown capture, image export dimensions, real service-worker offline reopening, cache deletion/repair, encoder vectors and a mocked QZ secure WebSocket exchange. The design checks also cover keyboard selection, the skip link, responsive overflow and axe WCAG A/AA rules across all three views. They do not test physical cameras, native Safari, real QZ installation, OS spooler or physical printers.

- [384-dot test receipt](artifacts/printer-test-384.png) and [raw job](artifacts/printer-test-384.bin)
- [576-dot test receipt](artifacts/printer-test-576.png) and [raw job](artifacts/printer-test-576.bin)

These are generated from the actual Super Snap artwork and PhotoTags logo with a grayscale test ramp. They are test images, not evidence of printed output. The encoder test regenerates them. Layout screenshots are generated in `artifacts/`; the test report is `playwright-report/index.html`.

See [validation record](docs/VALIDATION.md) for completed checks and required device acceptance tests. See [asset provenance](public/asset-provenance.json) for source paths, SHA-256 and icon transformations. All runtime assets are copied here. `node scripts/prepare-assets.mjs` regenerates icons from the local copied original; builds do not require either reference project.

## Next work

Pending real-world acceptance: camera orientation and PNG downloads in installed iOS/macOS PWAs; offline installation/storage eviction/update behavior on each platform; QZ prompts/queue setup and physical Deli/G80 output; secure iOS LAN bridge operation without internet. No other PhotoTags modes are included.

## Kiosk security

In **Settings > Security**, enter and confirm a six-digit PIN, then choose **Set exit PIN**. Leading zeros are supported. Exit kiosk, the app's Escape exit and Host: open printer setup require this PIN on a masked numeric keypad. Clear, backspace, keyboard entry and Keep booth open are supported. Cancelling keeps the current photos and step, while stopping any active camera countdown. Five incorrect attempts pause entry for 30 seconds, including after closing and reopening the prompt within the current app session.

Changing or removing protection requires the current PIN. The salted PBKDF2-SHA-256 hash is saved locally and works offline; the PIN itself is not saved. Failed writes keep the previous credential. Browser/device controls and clearing site data remain outside this in-app exit guard; it is not an operating-system kiosk lock.


## Local photo history

Open **Settings > Photo history** to browse saved guest sessions. Captured photos are saved automatically in this browser?s IndexedDB, including incomplete sets; the finished receipt updates after composition. Sessions are grouped into local-date folders named `YYYY-MM-DD` by default. **Rename folder** changes its display name while retaining the capture date. Select a session to view/download its receipt or individual photos. These date folders can also be saved to the device using the controls below.

**Reprint receipt** sends one copy through the connected printer using its current profile and photo lightness. It uses the saved receipt artwork without loading it into a new guest session. The normal unresolved-job marker and host review lock still apply. Finished sessions remain available after offline reload; clearing site data removes the history, so download copies you want to retain independently. A reported storage failure leaves the guest capture workflow available. Delete a saved session through its explicit confirmation.

Every placed sticker has a small X at its upper-right corner in the editor. The X follows its placement, and neither it nor selection borders appear in prints or saved images.


## Device folders on Windows, macOS and iOS

In **Settings > Photo history > Device folder**, choose **Choose local folder** when available (supporting desktop Chrome/Edge browsers). The browser asks for access. Photos and finished receipts then save automatically under `PhotoTags Receipt Booth/YYYY-MM-DD/session-id/` inside your chosen location. A session folder contains individual JPEG/PNG photos, `receipt.png` when ready, and `session.json`. **Save cached sessions to folder** writes existing browser history too. Choosing an existing PhotoTags folder opens its saved sessions, allowing reprints even after the browser cache was cleared.

A remembered folder may require **Reconnect folder** after reopening. Permission denial, disconnection or disk-full errors pause device writes, report the problem and retain the browser copy. Reconnect and save again to recover. Renaming a date folder creates a new named folder on disk and retains earlier copies. Deleting cached sessions or disconnecting never deletes existing device files.

On **iPhone/iPad and browsers without directory access**, choose a date folder, then **Prepare folder for Files**. If file sharing is supported, tap **Save folder to Files** and choose **Save to Files > On My iPhone/iPad** in the system sheet. Otherwise use **Download folder ZIP** and save/move the ZIP from Safari Downloads into Files. Extract the ZIP to browse its date/session folders. Individual photos and receipts also have **Save image to Files** where supported. Saving on these browsers requires a user action; a website cannot silently keep writing into an iOS Files folder.

Use **Open saved ZIP** to restore a saved archive on Windows, macOS or iOS for browsing and reprinting. Existing newer session versions are retained. ZIP files keep the same date folders, images and session metadata as desktop folder saves. Archive preparation/import supports up to 512 MB; direct desktop folder saves avoid packaging the event into one ZIP. Everything runs locally and remains available offline after the app has been prepared.

Browser behavior references: [File System Access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), [Web Share](https://w3c.github.io/web-share/), [Apple Files downloads](https://support.apple.com/en-au/102440). Physical iOS/macOS save dialogs require acceptance testing on those devices.
