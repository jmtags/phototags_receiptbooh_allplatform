# PhotoTags studio redesign

## Direction

PhotoTags is a working camera and receipt tool. The workspace should feel like a small photographic studio, with the original receipt artwork providing its visual personality. Make capture and output the dominant surfaces; setup belongs in its own view.

Reviewed the available Sites skill and the upstream Anthropic frontend-design skill. Used Vercel's Web Interface Guidelines as a review checklist. The references guide the work; they are not a claim of independent expert approval.

## Tokens and composition

- Paper: #ffffff; workspace: #f3f3f7; ink: #222330; secondary text: #646575; PhotoTags blue: #3158e8; PhotoTags pink: #e8347c.
- Type: locally bundled Manrope variable font. Clear 13–15px controls/body, 18–22px section titles and a restrained 36px page title. No marketing hero above the tool.
- Desktop: collection rail / camera workspace / receipt output. Left-aligned labels and fixed control rhythm. Receipt stays upright at a readable size.
- Tablet: horizontal design collection above camera and output. Phone: horizontally scrollable design collection, then camera, then output. Keep all designs reachable by touch and keyboard.
- Use Lucide icons for actual actions and states. Show the original PhotoTags mark. Use the brand's blue for actions, pink for capture details, green only for confirmed preparation.

```text
PhotoTags    Receipt Booth                       Printer   Offline & install
The receipt studio.                             session controls
┌ Collection ┐ ┌ Camera workspace ─────────────┐ ┌ Receipt ───────┐
│ 5 designs  │ │                              │ │               │
│ thumbnail  │ │        camera / photo        │ │ original      │
│ + name    │ │                              │ │ artwork       │
│ + select  │ ├ capture & photo controls ─────┤ │               │
└───────────┘ └──────────────────────────────┘ ├ output options┤
                                               └ save / print ─┘
```

## Critique before implementation

The previous spacious pink page, repeated promotional labels, decorative symbols and small receipt preview made a functional app resemble a landing-page template. Remove the large promotional hero, repeated numbered circles and arbitrary decorations. Avoid adding another generic serif-and-cream theme. Give the camera a clear physical boundary, increase the legibility of output, and reserve borders for grouping controls.

The receipt artwork is the expressive element. The surrounding interface uses a quiet type and spacing system rather than more invented artwork. Existing capture, processing, connection and offline behavior stays in place.

## Sources and licenses

- https://github.com/anthropics/skills/tree/main/skills/frontend-design — frontend design guidance, read from upstream SKILL.md; no skill scripts executed or global installation made.
- https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines and https://github.com/vercel-labs/web-interface-guidelines — accessibility and interface review references.
- https://github.com/lucide-icons/lucide — Lucide React icons, ISC with Feather-derived MIT notices.
- https://github.com/fontsource/fontsource — self-hosted Manrope distribution; font license included in public/licenses.

## Review criteria

Keyboard operation, visible focus, meaningful labels, touch targets, text contrast, reduced motion, long content, responsive layouts, camera/permission feedback, export and print states, offline assets, and safe deferred updates. Validate with screenshots, existing behavior tests and automated accessibility checks. Real-device and independent human UX review remain separate acceptance steps.

## Completed review

Production build passed. All 26 active automated checks passed; four duplicate shared checks were intentionally skipped. Axe reported zero WCAG A/AA violations across all three app views on desktop, phone and tablet viewport sizes. Supporting text contrast was increased after the first scan. Screenshots were reviewed for the camera surface, collection rail, receipt preview and setup flows. Updated screenshots are in artifacts/studio-*.png. Mobile selects use 16px text to avoid automatic Safari input zoom. This is an automated and visual implementation review, not independent human UX certification.

## Guest kiosk extension

The studio now has a prominent kiosk launch action. The guest flow uses a full-viewport native modal, a large Start action and four sequential steps with fixed Back/Continue controls. Host setup stays in the studio. See [kiosk behavior and verification](KIOSK.md). A full 45-case run passed 37 checks, with eight intentional duplicate skips; welcome and each kiosk step were included in the accessibility review.


## Multi-shot decoration extension

The supplied Android screenshot guides the Step 3 composition: round green decoration tools, a horizontal strip of original sticker assets, a vertical theme collection and a large editable receipt. The surrounding kiosk keeps its existing typography, progress navigation and fixed actions. Step 1 uses the original Android 1?4-shot preview artwork. Original sticker labels and source hashes are recorded in the generated catalog and asset provenance manifest; no new raster artwork was generated.

The extension was visually reviewed at desktop and phone widths. Axe scans passed for the decoration and signature screens, and the exported bitmap was compared to the decorated preview. See VALIDATION.md for the regression record.


## Host settings landing page

The duplicate collection, camera and receipt preview were removed from the landing page. The home view now provides printer/offline/session status, output configuration, an explanation of the four-step system and a pre-event checklist. A prominent launch action opens the guest kiosk. Output tone and thermal preview preferences persist locally, and entering a new kiosk session respects the host preview choice. Session status remains available after returning from the kiosk without exposing a second editor.


## Kiosk branding controls

A full-width branding panel pairs the form with a compact live welcome preview. On phones, the preview sits below the controls. Explicit Save separates draft changes from active kiosk branding. The logo retains its aspect ratio and transparency, long brand text wraps, and the Start button selects white or black text for contrast with the chosen accent. Restore defaults and file/storage error states are available in the same section.


## Settings sidebar, backgrounds and camera timing

The main interface is now named Settings. A seven-section desktop sidebar replaces the top navigation and long combined page. It becomes a compact navigation grid on smaller screens. Branding includes a welcome-only background upload and matching preview. A dark overlay and light copy maintain text readability over bright photos. Camera has a saved 1-15-second countdown control and numeric preview. The timer is shown in capture instructions and applies to each shot and retake.
## Event themes and retake controls

Settings now has an Event themes section. An event selector controls which saved layouts appear beside the five built-in themes. The editor pairs event details, text and border controls, optional uploaded receipt artwork, and photo-area controls with a live receipt preview. The photo area supports dragging and arrow keys, and previews support all four shot counts. Saved cards provide edit and delete actions, with an explicit deletion confirmation.

Camera settings includes an optional per-session retake allowance. The guest camera step shows the remaining count and disables replacement actions when it is exhausted. Initial shots and cancelled countdowns do not use the allowance. A finite allowance locks the session's shot count after capture; starting a new guest session restores the allowance.


## Launch collection and printer lightness

Event themes includes thumbnail checkboxes for both built-in and saved layouts. Selections apply to the active event and persist automatically; the final selected layout cannot be unchecked. Printer connection exposes Natural, Lighter photos and Lightest photos, saved separately for the Deli ES423 and VOZY G80 profiles. Color previews and color PNGs retain their original tones.

## Kiosk exit security

A dedicated Security section lets hosts set, change or remove a six-digit exit PIN. The kiosk replaces its guest content with a centered, masked PIN entry screen and large 3-by-4 numeric keypad for protected exits. The gate includes Clear, backspace, an explicit unlock action, and Keep booth open. Guest step navigation is hidden while unlocking. Keyboard entry remains available, while inputmode none avoids a second mobile keyboard covering the touch keypad. The PIN prompt uses the same local colors and type as Settings and does not use the welcome background.

## Camera workspace and overlay controls

Step 2 now gives the video most of the remaining viewport instead of placing a small preview between large headings and separate capture buttons. Compact shot selection sits above the normal view. Enlarge view puts the video behind the kiosk controls; dark translucent surfaces, white labels and subtle borders keep actions legible over bright or dark camera imagery. Restore view returns to the normal layout without replacing the stream. Exit and step navigation remain visible in both layouts.

## Shutter feedback

A brief shutter flash acknowledges successful camera captures. The photo-upload option, camera spacing and previous decoration layout are restored after reverting the compact-layout change.
