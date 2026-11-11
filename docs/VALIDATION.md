# Milestone validation

Local Windows workstation, 2026-11-10. No deployment and no reference-project edits. Distinguish implemented behavior from the evidence below.

## Implemented

- Shared responsive one-to-four-photo booth with five copied PhotoTags design assets and matching normalized Android photo regions.
- Built-in camera/webcam, configurable 1-15-second countdown, local image fallback, zoom/mirror, canvas composition, thermal/color preview and PNG download.
- Deli 384-dot ESC * bands and G80 576-dot GS v 0 raster, separate G80 tones and Android-derived error diffusion.
- Bundled QZ secure client, explicit host/queue, attended authorization workflow, raw single-copy submission, saved unresolved-job blocking and no automatic retries.
- PWA manifest/icons, complete runtime asset precache, offline inventory check, persistent-storage request, repair and explicit between-session updates.
- Original-asset printer test artwork can be loaded in Printer connection. Test PNG and ESC/POS artifacts are generated for both widths.

## Browser evidence

Production TypeScript/Vite build passes. Workbox precaches approximately 12.5 MiB, including 176 original stickers, four shot-layout previews, original artwork, icons, locally hosted Manrope font, license notices and bundled printing JS. Tests use actual installed desktop Chrome via Playwright, with 1440×1100, 390×844 and 820×1180 viewports. Mobile dimensions are **Chrome emulation**, not iPhone/iPad Safari.

| Check | Evidence / limit |
| --- | --- |
| Responsive layout | All three widths render without horizontal overflow; artwork loads; screenshots in artifacts/ |
| Capture | Synthetic browser MediaStream completes countdown and capture, then tracks stop; physical webcam not tested |
| Camera failures | Injected NotAllowedError and NotFoundError show specific messages; manual camera retry remains usable |
| PNG export | Actual browser downloads decode to 384×922 and 576×1383 for Super Snap, matching source artwork proportions |
| Offline reopen | Installed production worker; network disabled; reload, local photo, template change and preview/export remain available |
| Missing offline assets | Deliberate cached-template deletion clears readiness; online repair reinstalls the package; unreachable-origin repair preserves existing files even if the browser reports an active network interface |
| Deferred updates | A real changed worker waits; apply is disabled with an active photo; ending session permits apply/reload |
| Encoder | Known bit positions, command headers, lengths, transparency and pure black/white checks pass; printer test images and raw jobs emitted |
| QZ integration | Mock secure WebSocket validates real bundled QZ handshake, queue discovery, raw base64 bytes, copies=1, submission wording, rejection and no retry |
| Job safety | Unresolved marker survives reload and blocks another print until operator review |
| Guest kiosk | Offline welcome ? layout ? photo ? theme ? print flow, disabled-step gates, host setup fallback, image export and next-guest photo clearing pass at all three sizes |
| Kiosk camera/focus | Countdown cancellation stops tracks; capture succeeds after resuming; exit restores launch focus; zoom/mirror feedback is checked separately on the final build |
| Multi-shot decoration | All shot counts across all five themes and both widths; partial uploads gate continuation; original stickers load offline; signature changes composition; exported PNG equals decorated preview |
| Kiosk fullscreen | Desktop Chrome confirms native fullscreen and modal state; screenshot checks dialog paint order; API rejection fallback fills the viewport |
| Design accessibility | Axe WCAG A/AA scan reports zero violations across booth, printer and offline views at all three viewport sizes; keyboard skip link and template selection pass |

`npm test` has 114 scheduled checks: 86 functional/design/kiosk/branding/settings/event-theme/retake/security/camera-layout/compact-editor checks and 28 intentional skips (shared encoder, worker-update, square geometry, multi-shot geometry/camera branding storage failure and native fullscreen checks only run once). A successful run produces `playwright-report/index.html`. `npm audit --omit=dev` reports zero runtime dependency vulnerabilities at validation time. Full audit reports six transitive build-tool findings (two low, four moderate, through Workbox's glob/minimatch/deepmerge dependencies); compatible `npm audit fix` did not resolve them. No forced dependency downgrade or breaking change was applied.

## Not verified on physical hardware

No physical printer output, native QZ authorization, OS raw queue, physical camera, Windows installed PWA, macOS browser/PWA, or iPhone/iPad Safari/PWA has been verified. No AirPrint capability is claimed. LAN bridge support remains experimental.

Required acceptance tests:

1. **Deli ES423 over USB on Windows and macOS:** install QZ and raw queue, authorize this origin; load printer test artwork; print one copy. Measure 48mm printable width, edge clipping, band boundaries, full receipt length, feed and cutter behavior. Verify the full job is consumed exactly once.
2. **VOZY G80 over USB on Windows and macOS:** select 576-dot profile, print the same test, measure approximately 72mm image width on 80mm paper; compare Natural/Lighter/Lightest tones, black text, white areas and grayscale ramp. Check for missing rows, unintended heat commands, spooler transformations and stalled/segmented transfer. Native Android Bluetooth transport equivalence is not claimed.
3. **Failure safety:** disconnect USB or stop the helper during submission; inspect actual queue/paper before resolving the marker. Reload with a pending marker, reconnect and confirm nothing automatically reprints. Test QZ permission denial and printer offline/paper-out behavior.
4. **Real desktop cameras and installed apps:** grant/deny permission, unplug/reconnect camera, test landscape/portrait, retina screens, front-camera mirroring, download paths and offline cold launch. Confirm camera indicator turns off on close/navigation/end session.
5. **iPhone and iPad Safari and installed PWA:** trusted HTTPS installation, permission prompts, front-camera orientation, image-picker EXIF orientation, memory use, PNG download/share behavior, no-internet cold launch, persistent-storage availability/eviction and deferred updates.
6. **iOS LAN bridge:** configure QZ LAN bind, stable hostname and matching SAN certificate; install/trust root on each iOS device; authorize only the booth origin; restrict firewall to LAN. Verify WSS connection and network permission prompts in both Safari and installed PWA. Remove WAN access while retaining Wi-Fi and verify DNS, certificate validation, authorization, reconnect and one physical print for each printer. Repeat with untrusted certificate/denied permission and confirm connection fails without insecure fallback.

Do not promote queued/submitted jobs to “printed” in acceptance reports without inspecting physical output. First installation, helper provisioning and updates require connectivity; an already configured LAN may operate without internet, subject to the acceptance tests above.


## Multi-shot and decoration verification

The expanded regression run passed 41 checks with 12 intentional skips; the remaining camera-fixture uniqueness assertion repeated a generated frame when reopening the synthetic camera. The fixture now marks camera generations separately. Its corrected capture/cancel/resume check passed on the final production build. Focused responsive export and accessibility checks were also repeated after the final studio shot-count labels changed. Together these runs cover all 42 active checks. All 176 sticker files were independently confirmed present in dist and listed in the generated worker precache.


## Host settings landing page verification

The landing page now contains status, receipt output settings, system information and an event checklist. The duplicate collection, camera and receipt editor were removed; camera denial/missing-device tests now exercise the kiosk, and the former duplicate studio capture check is covered by the kiosk capture/cancel/resume tests. The full adjusted regression run passed 39 checks with 12 intentional skips. Axe scans passed on all three host views and all guest steps at desktop, phone and tablet dimensions. Output tone and preview preference persistence and the host color preference carrying into the kiosk are checked on the final build.


## Kiosk branding verification

The production build includes a branding form with local logo normalization, explicit save, live preview and default restoration. Browser checks verify custom logo/text/accent after reload, no-network kiosk launch, custom Start navigation, branding retained across a new session, restoration, rejected logo format and storage failure preserving the previous saved brand. Axe scans cover both the branding form and a customized welcome screen at all three viewport sizes. The light-yellow accent uses black button text. A separate 390-pixel-width check verified maximum-length brand/heading/message text can scroll to the top without horizontal overflow.


## Settings sidebar, welcome backgrounds and timer verification

Settings now uses seven sidebar sections, with a compact section grid on smaller screens. Automated accessibility scans cover all seven sections at desktop, phone and tablet sizes. Branding checks include normalized background upload, offline image decoding, welcome-only styling, background removal and default restoration. Camera checks verify that 15 seconds persists after reload, then a one-second setting controls every shot of a two-photo sequence and a single-photo retake without replacing the other photo. The full run passed 45 checks with 14 intentional skips; one desktop camera test was interrupted at initial page navigation by workstation sleep (Chrome ERR_NETWORK_IO_SUSPENDED) and was rerun separately on the same build.

The interrupted desktop timer check passed on rerun (7.8 seconds), giving passing evidence for all 46 active checks on the final build. The Settings screenshots were reviewed at desktop, phone and tablet widths.


## Optional automatic capture verification

The camera settings switch defaults to off and persists locally. A focused regression run of automatic capture, camera settings, kiosk flows and settings accessibility passed 27 checks, with six intentional shared-check skips. New checks cover four automatic shots without another capture tap, no recapture on returning to completed photos, disabling the saved switch, immediate camera readiness, delayed permission cancellation, denied permission without retries, local-upload fallback and keeping completed slots when stopping/re-entering during a countdown. Manual capture, raw-print host review, fullscreen/focus and all settings accessibility scans also passed at desktop, phone and tablet widths. A final layout check places Stop automatic capture directly over the preview and checks that it is in the viewport on each screen size.

The final automatic-capture layout run passed all 10 active checks at desktop, phone and tablet sizes, with two intentional shared-check skips. Stop automatic capture was confirmed inside the viewport and screenshots were reviewed.
## Retake allowance and event themes

Camera now persists an Unlimited, zero, or 1-10 retake allowance. Browser checks cover successful uploaded and captured replacements, failed uploads and cancelled countdowns costing nothing, multiple initial slots being free, disabled replacement actions at zero, a finite allowance preventing shot-layout changes from clearing captured photos, and the new-session reset.

Event themes use local IndexedDB storage, including normalized uploaded artwork and editable design metadata. Checks create two event collections, save text-designed and uploaded layouts, edit without creating another entry, filter the kiosk by active event while retaining built-in themes, reopen offline, decorate and export a custom receipt, export ESC/POS data, and delete only the intended custom theme. A storage-failure check confirms no false saved state. Pixel checks cover both custom layouts with one to four distinct photos at both printer widths. The composition readiness gate disables output immediately when receipt inputs change, until that revision finishes rendering.


Final production-build regression: 67 passed, 20 intentional shared-check skips (8.6 minutes). The run covered desktop, phone and tablet viewports, all eight settings sections, offline event themes, retake enforcement and existing capture/decoration/print safety. Event theme editor screenshots were visually reviewed at all three widths. Physical hardware limits above still apply.

## Printer lightness and launch-theme visibility verification

Targeted checks provide passing evidence for 33 active cases across desktop, phone and tablet, with six intentional shared-check skips. Existing host settings, offline repair/reopen, event-theme editing/export, encoder vectors and QZ print safety passed. New lightness persistence and visibility journeys passed after correcting test-only label lookup and omitted guest selection actions. Accessibility scans passed for all eight settings sections at all three sizes. The final visibility run passed all three viewport cases on the final build.

Frozen pre-change grayscale-ramp SHA-256 values confirm unchanged default raster output for both Deli ES423 (Natural) and VOZY G80 (Lighter photos). Each profile produces strictly less ink as Natural changes to Lighter and Lightest. The monochrome adjustment and profile-specific preference are the only printer-renderer changes; transport, command encoders and QZ implementation are unchanged, including a matching before/after hash for printing.ts. Physical printer output remains unverified. Additional browser checks verified that rejected preference writes preserve the prior lightness/visibility and that an event named constructor works without inheriting object keys. Theme selection screenshots were reviewed at desktop and phone widths.

## Six-digit kiosk exit PIN verification

The focused security, kiosk, automatic-capture and settings-accessibility run passed 29 checks with 10 intentional shared-check skips at desktop, phone and tablet sizes. All nine settings sections passed accessibility scans. PIN checks cover exactly six digits and leading zeros, salted-hash storage, offline reload, masked keypad entry, Clear/backspace, incorrect PIN rejection, cancellation/focus restoration, Escape, old-PIN validation for changes/removal, disabling protection, protected printer setup with retained photos, retry cooldown across prompt reopen, and failed storage writes preserving the previous credential.

The final touch-keypad refinement was checked in a second security run: all five active checks passed, with four intentional skips. Physical keyboard entry also passed with the custom keypad inputmode set to none. The PIN prompt was visually reviewed at desktop and phone sizes. Browser/device controls and full site-data deletion remain outside the in-app guard; device kiosk mode and actual mobile virtual-keyboard behavior have not been physically tested.

A final browser race check passed: if a PIN finishes saving while an exit confirmation is already open, its Exit to Settings action switches to PIN verification rather than bypassing the newly enabled guard. The final production build passes.

## Larger camera and enlarged-view controls

The targeted camera-layout, automatic-capture, kiosk and retake checks provide passing evidence for all 32 active cases, with 10 intentional shared-check skips. The first broad run passed 31 checks and exposed a narrow-layout overlap; after correcting top-control widths and the disabled-upload hit-test assertion, the layout run passed all four active checks at desktop, phone, tablet, 320-by-640 and 844-by-390 sizes. A final landscape/narrow check also passed after testing permission-denial messages in the expanded view.

Checks verify the normal camera exceeds 40 percent of viewport height at the three main sizes, enlarged video occupies the kiosk viewport, buttons fit without scrolling and receive pointer hits, interactive controls do not overlap on narrow/short screens, and readable overlays pass accessibility scans over a white synthetic camera feed. They also cover restore during a countdown, manual close stopping tracks, uploads and photo adjustments, PIN-protected exits and preserved photo slots. Screenshots were reviewed at phone portrait and short landscape sizes. Camera constraints, capture/retake logic, composition and printer files match their pre-change SHA-256 baselines; the change is confined to kiosk markup/state and CSS. Actual camera hardware and physical mobile-browser safe areas still require device acceptance testing.

## Camera-only capture, shutter flash and compact Step 3

Guest Step 2 no longer renders a photo-upload button or file input. Camera permission messages and Settings help now describe camera retry. Existing journeys were updated to capture from real synthetic browser MediaStreams instead of bypassing capture with image uploads. Non-timing fixtures accelerate countdown waits; partial-set checks retain real spacing for a reliable Stop action and allow time for two three-second countdowns. Dedicated timer and cancellation cases retain their original clocks.

The capture event counter is updated only after a frame is drawn. A separate DOM overlay acknowledges captures without altering the canvas used for receipt output. New browser checks observed exactly four shutter flashes for four captures, verified full receipt aspect ratio, and kept editor controls inside the viewport while resizing between desktop, 320-by-640, 844-by-390 landscape and 1280-by-720. Phone/tablet flows, sticker placement, signature strokes and exported PNG equivalence are also checked. Reduced-motion CSS hides the flash. Receipt composition and print-transport files retain their pre-change SHA-256 values.

Validation result: the broad run passed 82 checks with 28 intentional skips and four fixture-timing failures. After fixing partial-capture timing and its wait allowance, the final compact/retake rerun passed six checks and the final decoration/export rerun passed all three viewport checks. Together these runs provide passing evidence for all 86 active checks. The final production build passes; screenshots were reviewed at narrow portrait and short landscape sizes. Physical camera/device acceptance limits above still apply.

## Revert of camera-only and compact-editor changes

The photo-upload option, original Step 2 control spacing, previous receipt editor and its styles are restored from the saved pre-change files. Only successful-capture shutter feedback is retained. A normalized comparison confirms ReceiptEditor.tsx matches its pre-change version; useBooth.ts differs only by the capture-event counter, its two success updates and exported field. The retained-effect check verifies uploads are available and cause no flash, while three subsequent camera captures produce exactly three flashes.

The revert production build passes. All six focused shutter/upload and restored-decoration/export checks passed at desktop, phone and tablet sizes (1.4 minutes).

## Top progress header and icon exit

The progress steps replace the brand bar on all four guest steps. The welcome screen retains its branding. The icon-only exit retains its accessible name, 44-pixel touch target and PIN protection. Progress remains visible in the enlarged camera view.

The production build passes. All seven active header and camera-layout checks passed at desktop, phone and tablet sizes, including narrow and short viewport checks, with two intentional shared-check skips. The header accessibility scan found no violations. Desktop and phone screenshots were visually reviewed.

## Kiosk confirmation popups

Confirmation and PIN prompts now use a centered native modal over the mounted guest step with a translucent, blurred backdrop. Checks cover unchanged page geometry, blocked background interaction, keyboard focus containment, Escape and close-button cancellation, restored exit-button focus, preserved shot selection, confirmed exits and accessibility. Desktop and phone screenshots were visually reviewed.

The production build passes. The final popup run passed all three viewport checks. Combined with the kiosk, header and security runs, there is passing evidence for all 22 active cases (eight intentional shared-check skips). The earlier combined run caught the confirmation focus-restoration issue, now fixed; its phone offline check also timed out waiting for service-worker readiness while the build was being replaced. That offline journey passed on a separate run against the completed build. PIN verification, cooldown, printer-setup protection, photo retention, camera cancellation, export and print-review flows pass.

## Smaller Step 3 themes and receipt

Theme cards use smaller thumbnails in an independently scrolling list. The complete receipt scales with viewport height and its actual output aspect ratio; print and export dimensions are unchanged. Short landscape windows use a smaller sticker strip, retaining sticker names as accessible button labels and tooltips.

The production build passes. All three final viewport-fit checks pass, including the reported 1363-by-766 window, 1440-by-900, 320-by-640, 844-by-390, phone and tablet sizes. Checks verify the full receipt and theme list fit above the footer, preserve receipt proportions and allow selection of the last theme. All five active decoration, signature, export and capture checks also passed, with four intentional shared-check skips. The initial fit checks caught a footer overlap; the final sizing corrects it. The reported desktop size was visually reviewed.

## Header-free welcome and glass exit icon

The welcome screen omits the brand header and uses a floating 44-pixel exit icon with a translucent surface, backdrop blur, rounded corners and a subtle shadow. Custom welcome content/backgrounds remain available. The progress header remains on Steps 1–4, and the expanded camera uses a dark translucent exit surface for contrast.

The production build and all nine focused branding, progress-header and security checks pass across desktop, phone and tablet. Checks include offline custom branding/backgrounds, default restoration, header absence on welcome, visible glass exit, all four progress steps, enlarged camera, PIN cancellation/focus restoration and correct/incorrect PIN handling. Default phone and custom-background desktop screenshots were visually reviewed.

## Direct photo and sticker gestures

Step 3 supports one-finger dragging and two-finger pinch/rotation for both photos and stickers. The lower adjustment panel is removed; an on-receipt trash button removes the selected sticker, and keyboard alternatives remain. Photo rotation is included in the shared composition with clipping and rotated-cover sizing, leaving printer encoders unchanged.

The production build passes. All three native browser touch-input checks pass across desktop, phone and tablet, covering resize/rotation, lifting one finger without a jump, continued dragging, sticker deletion, pointer cancellation, keyboard reset/adjustment and PNG equivalence with the preview. The initial gesture fixture identified the wrong released touch ID; correcting the browser-input fixture produced the passing final run. The rotation renderer check verifies orientation and covered frame corners at both printer widths. Together with the decoration/signature/export and viewport-fit checks, all 12 active cases have passing evidence, with six intentional shared-check skips. The phone gesture screenshot was visually reviewed. Browser touch input is emulated; physical touchscreen acceptance has not been performed.

## Per-sticker X and local photo history

Every placed sticker has its own 26-pixel X at its upper-right corner, with a descriptive accessible name. The X follows the sticker while its glyph stays upright; deletion does not retarget another selected sticker. Overlay controls remain outside the composed image.

Captured photos and finished color receipts are saved to local IndexedDB, grouped by local-date folders with persistent editable names. Settings can preview/download individual photos and receipts, delete sessions with confirmation, and reprint using the current printer width/tone. Full images are loaded only for the selected session. Reprints share the existing single-job lock and persisted pending-print review state. Deleting a working session suppresses subsequent automatic saves for that ID, so profile changes cannot silently recreate it.

The production build passes. The final history run passed all six active checks across desktop, phone and tablet, with six intentional shared-check skips. It verifies independent X buttons, preserved selection, date defaults, folder rename, raw JPEG downloads, offline reload, session finish retention, accessible gallery screens, printer-required gating, native-width reprints, persisted unresolved-job protection, storage errors without capture loss, deletion suppression and separate guest records. Desktop/phone history and phone X screenshots were visually reviewed. The initial broader run had four fixture failures (overlapping test stickers and an exact label lookup); corrected fixtures pass. Together with its passing decoration/export, two-finger gesture, renderer and print submission/failure checks, there is passing evidence for all 21 active cases, with 12 intentional shared-check skips in the updated set. Physical printer output has not been tested.

## Device folders and Files/ZIP portability

Supporting browsers can connect a user-selected device directory, remember its handle where supported, automatically save date/session folders, and reopen that collection for browsing and reprinting. The browser cache remains a recovery copy. Other browsers use a prepared ZIP download or native file-sharing action; sharing is invoked directly from a separate user click after preparation. Individual images can use the same native share path. The interface explains that iOS saving requires an explicit Files/Downloads action. Folder rename writes a new folder and retains existing disk copies; cache deletion and disconnect never delete device files.

The production build passes with 206 precache entries, including bundled fflate and its MIT license. The combined device/history run passed all 12 active checks, with 12 intentional shared-check skips. After making newer-version protection atomic, the final device run passed all six active cases with six shared-check skips. Checks cover actual browser file-handle writes, manifest-last output, saved-handle reload, date rename, reimport after clearing the IndexedDB cache, picker cancellation, permission renewal, disk-full recovery, one-copy reprinting, ZIP structure and exact PNG bytes, file-share user activation, offline ZIP restoration, older archive rejection, malformed/traversal archive rejection, sharing-unavailable download fallback, accessibility, and migration of existing version-one history. Phone Files controls were visually reviewed.

Native file API tests use real Chrome handles in isolated origin-private test storage as a stand-in for the selected OS directory, with the picker adapter mocked. Sharing targets are also mocked; no files were sent to another app. Physical Windows/macOS folder picker dialogs and iOS Files destinations have not been acceptance-tested on those devices. Platform behavior is documented from Chrome File System Access, W3C Web Share and Apple Files guidance in README.md.


## Compact camera controls and preview print action

Guest Step 2 no longer offers image upload or the captured-count caption. The capture/retake action is a 54-pixel icon button with remaining retakes on its badge and an accessible description. Enlarged captured-photo zoom is vertical on the left. Step 4 places its print action at the lower right of the receipt preview panel and preserves readiness checks and the pending-job lock.

The production build passes. The updated camera, automatic-capture, retake and kiosk suites provide passing evidence for 32 active cases across desktop, phone and tablet, with 10 intentional shared-check skips. An initial run exposed an obsolete assertion that expected opening the PIN popup to remove the expanded-camera class; the popup intentionally preserves that layout. After correcting the assertion, the final camera suite passed all four active checks, with two shared-check skips. Coverage includes compact button geometry, upload removal, vertical slider location and keyboard operation, visible controls at narrow/short sizes, accessible guest screens, countdown cancellation, finite/zero retake budgets, offline journeys, lower-right print placement, single-copy submission and host review. Desktop print and desktop/phone enlarged-photo screenshots were visually reviewed. Physical camera/printer and native iOS checks remain separate acceptance work.

The project-specific automatic-push skill is installed locally and included under skills/phototags-receipt-push, with AGENTS.md routing completed updates to it. Both skill copies pass quick_validate.py.
