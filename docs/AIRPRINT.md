# AirPrint and photo-sheet printing

In **Settings → Printer connection**, select **AirPrint / system print dialog**. Choose **4 × 6 inch photo sheet** for Xiaomi Instant Photo Printer 1S (ZPDYJ03HT), or A4/US Letter for another compatible printer. This setting is saved on the installation. QZ Tray remains the default for existing users.

Configure Xiaomi 1S in Xiaomi Home and put it and the iPad on the same Wi-Fi. First test an ordinary image from iPad Photos → Share → Print. AirPrint discovers compatible printers in the system print dialog, not in the app's QZ queue list. This feature does not add AirPrint or direct iOS Bluetooth/USB support to the Poseidon PSD-200I.

Load the printer test artwork, or finish a guest receipt and choose **Print my receipt** in Step 4. A sheet preview opens. Tap **Print / AirPrint**, choose the Xiaomi in the iPadOS dialog, select matching paper and one copy, and inspect the output. The receipt is centered and scaled to fit a white sheet without cropping; a long receipt consequently becomes smaller. Printer firmware may impose additional margins. The system controls printer selection, paper choices, copy count and actual output.

**Print / AirPrint** opens a visible printable page for Safari and Home Screen apps. Its button stays disabled until the PNG is decoded and painted; tap **Print / AirPrint** there to open the system dialog. This replaces hidden-frame printing, which can produce an empty preview on iPad. Allow pop-ups if necessary. Safari **Share ? Print** is also available. Return to the original app to review the attempt. No automatic retry is performed, and the page disables its Print button after the first request.

Closing a preview before requesting printing leaves no pending job. Opening the printable page stores an unresolved print marker. Cancellation, `afterprint` and a returning print call do not prove that paper printed. Close the preview and review the existing attempt before clearing it or trying again. Reloading preserves the unresolved marker. The session reset timer pauses during sheet preparation, preview and unresolved printing.

Photo history uses the same AirPrint preview for saved receipts and raw photos. Newly saved receipts retain the 1200-pixel composition for photo reprints; older receipts keep their existing stored resolution. Sheet printing uses the original tones, not ESC/POS dithering or thermal-lightness settings. The current trial watermark is applied to live output and historical reprints, including raw photos. Licensing checks apply before preparation and before requesting a system print.

The printable document contains only a flattened PNG and local layout/instructions. It needs no upload, remote font, QZ helper or new website/backend project. A prepared app can produce sheets without internet while the local printer network is available. The browser does not expose the AirPrint-selected printer name to the app, so the tracker cannot report that printer's actual model or queue. Switching to AirPrint stops reporting a previously selected QZ queue/profile.

Automated checks cover the app's print-dialog call, offline kiosk flow, photo history, popup blocking, persistent duplicate prevention, sheet geometry/PDF pagination and accessibility. They use simulated print calls and Chromium mobile/tablet emulation; they do not certify physical iPadOS/Xiaomi output. Test on the actual iPad in Safari and the Home Screen app before an event.

References:

- [Apple: AirPrint from iPhone or iPad](https://support.apple.com/109349)
- [Xiaomi 1S printing instructions, including AirPrint](https://cdn.cnbj1.fds.api.mi-img.com/ics-resources/articles/6130a8c305853004a7ddfe75.html)
- [MDN: window.print](https://developer.mozilla.org/en-US/docs/Web/API/Window/print)
- [MDN: afterprint](https://developer.mozilla.org/en-US/docs/Web/API/Window/afterprint_event)

## Color receipt control

Step 3 has a Color switch beside the decoration heading. On keeps the original colors in photos, stickers and artwork; Off converts the complete flattened receipt to continuous-tone grayscale at both native thermal and 1200-pixel output sizes. Existing black-and-white artwork remains black-and-white. The choice reaches the editor, AirPrint page, decorated QR image, image export and saved history receipt. QZ thermal printers still output monochrome. New guest sessions reset Color to On; original raw photos are unchanged.

Safari-engine readiness and popup checks: install the test browser with `npx playwright install webkit`, then run `npx playwright test --config=playwright.webkit.config.ts`. These use a tablet viewport and WebKit, not an actual iPad printer connection.
