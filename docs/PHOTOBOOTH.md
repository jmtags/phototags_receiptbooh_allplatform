# PhotoBooth mode

The Settings page now has two event sections:

- **Event theme-ReceiptBooth** keeps the existing receipt library, active event, visibility and custom receipt designs.
- **Event Theme-PhotoBooth** manages an independent four-photo collection, active event, default theme, visible themes and custom event photo sheets.

Use the existing **Launch kiosk** button for ReceiptBooth, or **Launch PhotoBooth** for the new photo session. Both require the same valid Light installation license or active trial. Switching modes starts a fresh workspace; captured files already saved to Photo history are retained. Changing modes is blocked while capturing or while an unresolved print needs review.

## Guest flow

The reference is the Android APK's `MainActivity.kt` PhotoBooth path and `PhotoLayoutComposer.kt`, inspected read-only. The web flow follows its four visible stages:

1. **Take four photos:** Start opens the browser camera and runs four automatic captures with the admin-configured countdown. After the fourth capture it moves automatically to decoration; Back returns to the camera for review/retakes. The existing stop/cancel, retake budget and camera controls apply. The ReceiptBooth automatic-Step-2 switch remains specific to the receipt flow; PhotoBooth starts its sequence from Start.
2. **Decorate photo:** choose a photo layout, move/zoom/rotate the pictures, add stickers or a signature, and switch Color on/off. The event's default theme starts selected. Double strips repeat each of the four photos on the second strip; adjusting a photo updates both copies.
3. **Print photo:** review the full-resolution sheet and print using the configured output method. AirPrint uses its existing visible printable page. QZ output remains monochrome and requires a configured supported raw receipt queue. Each print attempt requires the existing explicit review; after review the flow advances to Download QR. Guests can also continue to downloads without requesting a print.
4. **Download QR:** the decorated photo's link is generated here when online, licensed and automatic QR is enabled. Otherwise use Get QR when available, or save the PNG locally. Finish or the configured idle countdown starts a fresh PhotoBooth session. Raw originals stay in local history; the online QR contains only the decorated sheet.

Decoration, print review and download now offer **Full-screen 4 × 6 preview**. It fits the whole 1200 × 1800 sheet inside the viewport without cropping, with visible close/back controls and a Print action at the print-review stage. Escape closes only the preview. The existing final-stage idle countdown still resets an abandoned session and closes its preview. The regular print preview is larger as well. For PhotoBooth output on 4 × 6 AirPrint paper, the app no longer adds its 36-pixel inset: the sheet fills the photo canvas. ReceiptBooth, A4 and Letter fitting retain their existing margins. Hardware borderless support and the system printer settings still determine physical paper margins.

The default PhotoBooth welcome screen has a warm gradient background and three sample four-photo sheets using portraits already bundled with the booth. It works offline and never uses a guest's saved photos as marketing samples. Uploaded branding backgrounds and logos retain priority. ReceiptBooth's welcome artwork is unchanged.

The existing PIN protects exits and printer setup. Trial watermarks remain part of previews, saved sheets, printed pages and online downloads. Device-folder history and reprinting are shared with ReceiptBooth, with the photo theme name identifying the saved session. Printer/camera hardware support is unchanged: this adds the web photo-session flow, not APK-only USB camera drivers, Bluetooth printer SDKs, coin/voucher handling, or APK payments.

## Event themes

Six starting designs use the APK's classic layout names: Double strip, Story rows, Spotlight grid, Candy pop, Sweet hearts and Party burst. These are web-native 4 × 6 portrait layouts; the full APK artwork collection is not bundled. Select an active event, choose which designs are visible, and choose a visible default. At least one theme stays available.

Create a custom theme using an event/name, headline/footer, background/text colors, grid/rows/double-strip layout, and optional PNG/JPEG/WebP background (up to 20 MB). The background fills a 1200 × 1800 canvas; portrait artwork of the same ratio avoids cropping. Adjust each frame's left/top/width/height percentages and inspect the preview before saving. All four shots must have valid frames inside the page. Saved themes can be edited or deleted with confirmation.

PhotoBooth stores its themes in `phototags-photobooth-themes` IndexedDB and uses `photoBoothActiveEvent`, `photoBoothHiddenThemes` and `photoBoothDefaultThemes` preferences. ReceiptBooth retains `phototags-event-themes`, `activeEvent` and its existing visibility settings. No backend migration, new Vercel project, new license plan or APK change is required. Themes remain available offline on the configured browser installation; they are not synchronized automatically to other devices.

## Verification

`tests/photo-booth.spec.ts` exercises event creation/default/visibility, namespace isolation and offline persistence, single-Start four-photo capture, correct matching four-photo order on both strips, shared photo adjustment, full-resolution output, printing/review, download and mode switching. Existing receipt/theme/gesture tests cover the unchanged receipt path. The Light service's `scripts/check-light-integration.cjs` covers the PhotoBooth launch wall, trial and paid four-photo sheets with watermark differences, and real signed upload authorization with a fake storage provider. Tests use synthetic camera/printing adapters, not physical iPad/camera/printer acceptance.
