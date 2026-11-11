# Guided guest kiosk

The Settings page is the host workspace, with output configuration, status, system information and an event checklist. Creation tools are available only inside the guest kiosk. A prominent launch action opens the guest experience in a native modal dialog. Browser fullscreen is requested in the launch gesture and allowed to settle before mounting/showing the modal; otherwise the fullscreen document can paint above an already-open dialog. Failure or lack of the Fullscreen API falls back to the same viewport-sized modal. The modal supplies native focus containment, with explicit step heading focus and focus restoration on exit.

The guest state machine is welcome → layout → photo → theme → review/print. Back navigation retains choices and the current photos. Moving out of capture stops the media tracks and cancels pending countdowns/permission requests. Only the guest video owns the camera ref; no capture UI is mounted on the settings page.

Step 1 offers 1-4 shots with the original Android layout-preview artwork. The normalized slots follow Android: one full photo, two stacked photos, three with a large upper photo and two below, or a 2-by-2 grid. Every camera slot receives its own countdown from Settings > Camera (1-15 seconds, default 3). Previously captured slots remain when capture is cancelled; selecting a captured slot retakes only that photo. Guest Step 2 uses the camera only; the upload control is removed. Selecting the same shot count preserves photos; changing it asks before clearing photos and decorations. Host output settings apply to kiosk previews and exports.

Step 3 follows the supplied decoration reference: round sticker/signature tools, a horizontal category-based sticker collection, vertical theme cards and a large receipt canvas. All 176 original WebP stickers were copied unchanged from the current Android project. Guests drag photos and stickers with one finger, or use two fingers to pinch to resize and twist to rotate. The adjustment panel below the preview is removed. Each sticker has its own small X at its upper-right corner for removal. Keyboard users can focus an object and use arrow keys to move, plus/minus to resize, and square brackets to rotate; Delete removes a sticker, zero resets a photo and M mirrors it. Guests can still draw/undo/clear signature strokes. The editor overlays hit targets on the shared rendered composition; selection borders do not appear in exported or printed output. Decorations use normalized receipt coordinates, remain when changing themes, and clear on session finish. Up to 24 stickers can be added per receipt.

Layout and theme require an explicit guest selection. Photo continuation requires every selected photo, no running camera and a ready composed preview. Print is never automatic. Its queue/profile are configured by the host, and the shared print lock plus persisted unresolved marker remain authoritative. After any submission, failed or successful at helper level, host paper/queue review is required before another print/session. Session finish clears all photos and decorations and restores the welcome screen; exiting preserves the current image for the host. Updates remain controlled through the studio between sessions.

Validated with offline guest journeys, synthetic camera/countdown capture and cancellation, keyboard focus, layout geometry, PNG export, mock QZ submission, host review and next-guest clearing. Axe scans cover welcome and all four steps at desktop, phone and tablet viewport sizes. A desktop native fullscreen screenshot check guards against the fullscreen/dialog paint-order regression; fallback is tested separately. These checks do not certify native iOS fullscreen, physical cameras or real printer output.

API references reviewed:

- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen


## Welcome branding

Settings > Branding provides an explicit-save branding form and live welcome preview. The name, tagline, headline, description, Start label, accent, normalized logo and welcome background are stored together in a versioned local-storage record. Reads validate and limit the fields; invalid stored content falls back to defaults. The kiosk applies the saved record to its welcome content, and new sessions preserve branding. White or black button text is chosen from relative luminance for the selected accent. Storage errors preserve the previous active record. Logo data is local and works offline independently of network asset URLs. Original receipt artwork is unchanged.


## Settings sections and background

The desktop sidebar selects one settings section at a time; smaller screens use the same section buttons in a compact grid. Launch kiosk remains in the header from every section. Changing sections resets the Settings scroll position. The welcome background uses a locally stored, validated image data URL and a fixed dark overlay with light text; it is scoped to the welcome screen and removed from capture/edit/print steps. Background removal and default restoration are available in Branding. The saved camera countdown is validated to an integer from 1 to 15 seconds and captured for the complete photo sequence. Timer controls stay disabled while capturing or an unresolved print is active.


## Automatic Step 2 capture

Settings > Camera includes a persisted automatic-capture switch, off by default. On entry to an incomplete Step 2 it selects the first empty slot, requests camera access, waits for the mounted preview to play, then runs the normal per-shot countdown sequence. The camera helper also attaches an immediately resolved media stream after the video element mounts; this avoids a startup race when permissions are already granted. Completed photo sets are kept on return visits. Stop, exit and navigation cancel pending requests/countdowns, and a run token prevents a cancelled sequence from changing the state of a later run. Permission denial leaves manual camera retry available without automatic retries. Retakes remain available through the existing manual controls.


## Retake allowance and event templates

The default allowance is unlimited. A finite allowance (0-10) counts successful replacement photos across the session, from both camera and uploads. Cancels/failures do not consume it. Mutation handlers enforce the budget as well as disabled guest controls. Finite sessions retain their chosen shot count once photos exist, preventing a layout change from clearing photos and bypassing the allowance. A new session clears the count; ordinary step navigation and resume do not.

Event themes use an IndexedDB library with atomic writes and stable IDs for editing. The saved active event filters custom themes. A per-event visibility selection then filters both built-in and custom layouts, with at least one eligible layout retained. If the selected template becomes hidden, composition uses the first visible theme. Visibility is stored locally and works offline. A theme stores an artwork data URL and normalized photo region, so all shot counts and both printer profiles use the same composition and encoders. Admin preview outlines are not included in saved artwork. Live camera state remains in session memory; captured originals and finished receipts are also saved in local Photo history. Custom assets remain local and are not part of the service-worker precache audit.

## Protected exits

Security settings opt in to a six-digit exit PIN. Exit kiosk and dialog cancel route to a shared keypad; the host printer-setup route uses the same gate. No unprotected in-app close remains when enabled. Correct verification preserves photo and print-review state while returning to the requested Settings view. Cancelling restores the originating control and session step, with camera requests/countdowns stopped. A gate unmount cancels its pending unlock callback. The credential uses a fresh random salt and 100,000 PBKDF2-SHA-256 iterations; it is changed in memory only after storage succeeds. Wrong attempts share an in-memory five-attempt/30-second cooldown across gate openings and Security settings. Default protection is off until a host sets a PIN.

## Larger Step 2 camera

The photo step uses the remaining viewport for its camera workspace, with compact shot thumbnails. The captured-count caption is removed. A compact icon-only capture/retake button sits inside the workspace over a dark gradient, with the remaining retakes shown as a badge and an accessible description. Enlarge view expands the camera across the kiosk, with Restore, Stop/Close camera, Exit and Back/Continue kept in front of the video on dark translucent surfaces. It does not request a second native fullscreen element or restart the camera. Enlarging during a countdown preserves the current run; stopping cancels through the existing capture helper. PIN and confirmation prompts open above the expanded layout with a translucent, blurred backdrop. The current step stays mounted behind the popup; cancelling restores the originating control. Captured-photo zoom/mirror controls remain available. In enlarged view the zoom slider is vertical along the left side of the image; standard view retains the horizontal slider. Step 4 places its print button at the lower right inside the receipt preview panel, retaining all printer-readiness and pending-job checks.

Short landscape windows use a compact layout, while narrow screens keep the top camera controls in separate columns. Camera permission, media constraints, capture timing, retake accounting, composition and printing implementations are unchanged.


## Shutter feedback

Each successful camera frame triggers a brief white shutter flash, including the last frame and retakes. The overlay does not intercept controls or change receipt pixels, and reduced-motion preferences hide it. Photo uploads and the prior Step 3 layout are restored; the compact editor change was reverted.


## Top progress header

Steps 1-4 use the progress indicator as the top kiosk header, replacing the brand/tagline row. The welcome screen has no header bar; its custom logo, headline, message and background remain in the main welcome content. Its exit icon floats at the top right with a translucent, blurred surface. Exit is a 44-pixel icon-only button with an accessible Exit kiosk label and tooltip, routed through the same PIN/confirmation checks. The progress header also remains visible over the enlarged camera and in short windows.


## Confirmation popups

Exit confirmation, the host PIN keypad, restart and shot-count confirmation use a centered modal card over the current kiosk step. The native modal backdrop blocks interaction with the underlying page. Keyboard focus stays inside the popup; Escape, its close icon and Keep booth open cancel without navigating. The PIN guard and print-review state are preserved. Small or short viewports can scroll within the popup.


## Receipt gestures

A gesture keeps its first selected photo or sticker when another finger lands, including when it lands outside the original object. Two-finger transforms use their midpoint, distance and angle. Adding or lifting a finger rebases the transform against its last applied value; pointer cancellation, lost capture, mode changes and theme changes release gesture state. Photo zoom remains 1?3 and sticker sizes remain within their existing limits. Rotated photos are clipped to their original slots and scaled to cover their frames without blank corners. The same composition is used for preview, PNG export and print output.


## Local saved sessions

Photo history uses a separate IndexedDB database with atomic metadata/assets writes. Captured originals are saved even for incomplete sets. Matching composed receipts and lightweight thumbnails are updated after rendering; only metadata and thumbnails are loaded for the gallery, with full assets read on selection. A session keeps one ID across edits and retakes and gets a new ID on a new session. Session folders use local dates, with separately persisted display names.

Reprinting reads the stored color composition, fits it to the selected printer width, then uses the current thermal tone and unchanged encoders. It shares the normal print lock, persisted pending-job marker and host review flow, and does not change the current guest photos. Capture continues if archive writes fail, with a visible error in Settings. History remains after finishing and after offline reload; the browser cache is supplemented by optional device-folder saves and portable Files/ZIP exports. Site-data deletion removes it.


## Device-folder saves and portable archives

Photo history database version 2 adds a settings store for a serializable directory handle and preserves version-one entries, assets and folder labels. The app queries existing permission on startup, requests renewal only from a host click, and never prompts for directory permission during guest capture. Supporting browsers write to a dedicated PhotoTags Receipt Booth subdirectory, with local date folders and one subdirectory per session. Image streams are closed before the session manifest is written. A coalescing queue retains the latest pending revision per session. Storage/permission failures pause OS writes without dropping the browser cache; a host can reconnect and synchronize cached sessions.

The folder picker can open an existing saved collection. Reads are limited to the app's own manifest/image structure. Imports retain newer cached revisions. Physical date-folder renaming is implemented as writing a new named folder while preserving old copies. Disconnecting and cache deletion do not remove OS files.

Without browser directory access, the host prepares a date-folder ZIP and then explicitly shares it to Files or downloads it. Files are fully prepared before the share-button click so native user activation is preserved. Individual images can also use the native share sheet. ZIPs include flat receipt PNGs and captured originals plus versioned metadata, allowing restoration and reprinting on another supported device. ZIP paths, manifest fields, referenced filenames and expanded sizes are validated before import. Archive import/export is bounded to 512 MB. Native operating-system dialogs, their exact targets and final user save decisions remain controlled by the browser/OS; the app does not claim a file was saved merely because a share promise resolved.
