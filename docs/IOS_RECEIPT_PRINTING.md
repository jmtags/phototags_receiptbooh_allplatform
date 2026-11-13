# iPad/iPhone receipt printing without a computer

## Direct Bluetooth Low Energy

PhotoTags LRB now has an independent **Bluetooth receipt printer (BLE)** output method. On iPad/iPhone it requires a browser exposing Web Bluetooth, such as the free [Bluefy browser from PNN Soft](https://bluefy.app/). Open the booth inside Bluefy; opening its Safari Home Screen shortcut still uses Safari and does not provide Bluetooth access.

This is an ESC/POS BLE implementation, not a guarantee that every Bluetooth receipt printer supports iOS. Poseidon PSD-200I hardware has not been tested. Its self-test/specification must confirm BLE and ESC/POS support. A printer which only has Bluetooth Classic/SPP will not appear in a BLE scan; a USB cable does not add BLE or AirPrint.

1. Install [Bluefy from the App Store](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) and allow Bluetooth.
2. Open `https://boothphototags.vercel.app/` in Bluefy. Browser storage, installation identity and offline caches are separate from Safari. Configure the event and activate/transfer your existing installation license there; do not purchase another license merely to switch browsers. Prepare offline use in that browser while online.
3. Turn on the printer; disconnect other phones or printing apps. In **Settings → Printer connection**, select **Bluetooth receipt printer (BLE)**.
4. Select the printable width shown by the printer self-test: 384 dots for typical 58 mm paper, or 576 dots for typical 80 mm paper. Paper width alone does not guarantee the printable dot count. BLE lightness is saved separately from existing QZ profiles.
5. Tap **Find Bluetooth printer**, select your printer, and wait for Connected. Discovery is explicit; pairing in iOS Settings alone is insufficient. The picker may show other BLE devices; select only your receipt printer. Unsupported endpoints are rejected without writing data.
6. **Load printer test artwork → Send one receipt**. Keep Bluefy visible and the device awake until transfer finishes. A photo receipt can take a minute or more because writes use conservative 20-byte packets. Inspect width, tones, feed and the complete image before using the kiosk.
7. Review the print attempt before another copy. Interrupted transfers are marked uncertain and never replay automatically. Check/remove partial paper before clearing the attempt. Reconnect explicitly after a reload, browser sleep or printer power cycle.

Both ReceiptBooth and PhotoBooth use this transport; Photo history reprints use it too. Output is a monochrome raster, even when decoration is in color. Online QR downloads remain separate and preserve their existing color/watermark rules. Trial watermarks are flattened before Bluetooth rasterization; license checks and pending-job persistence apply before output.

## Compatibility boundary

The implementation checks these ESC/POS GATT endpoints: `18F0/2AF1`, `FF00/FF02`, `FFE0/FFE1`, Microchip ISSC, and the common `E7810A71…/BEF8D6C9…` print channel. It never writes to an arbitrary discovered characteristic. No proprietary label/cat-printer initialization or unsupported cutter commands are sent. Raster rows are sent in short bands, with acknowledged writes where available and legacy `writeValue` support for older Web Bluetooth implementations. A failed packet is not retried because delivery may already have occurred.

Safari does not expose the Web Bluetooth API. Bluefy provides a native BLE bridge; it does not enable generic USB or Bluetooth Classic printing. If the printer has only Classic Bluetooth/USB, this iPad-only web configuration cannot drive it. A manufacturer-supported native iOS SDK/app, supported AirPrint hardware, or another device acting as a bridge is needed. Do not advertise verified Poseidon compatibility until a real printer test succeeds. No App Store release or paid native wrapper is introduced by this change.

## Open-source research

- [WebBluetoothReceiptPrinter](https://github.com/at-point-of-sale/WebBluetoothReceiptPrinter) (MIT): ESC/POS service/characteristic protocol reference; includes generic `18F0/2AF1` and ISSC profiles. The booth's isolated adapter uses these public protocol identifiers and its existing renderer, rather than bundling this library or changing existing drivers.
- [PrintPal](https://github.com/vbhavDev/PrintPal): Web Bluetooth receipt-printer transport and browser support research.
- [Supvan/Katasymbol web UI](https://github.com/khromov/supvan-katasymbol-printer-web-ui): documents Bluefy as an iOS Bluetooth route. Its label protocols are not used for ESC/POS printers.
- [QZ print-server instructions](https://github.com/qzind/tray/wiki/Print-Server): alternative for setups allowing a computer. Existing QZ support is unchanged.
- [Bluefy developer documentation](https://bluefy.app/) and [Apple AirPrint requirements](https://support.apple.com/109349).

## Validation

Automated browser tests use a synthetic BLE adapter and validate capability guidance, explicit discovery, supported/unsupported endpoints, exact raster bytes, 20-byte writes, legacy iOS write API, one-copy locks, partial failures without retry, disconnects, offline kiosk printing and separate settings. They do not establish physical iPadOS/Bluefy/Poseidon compatibility. Hardware acceptance must include a complete test receipt, actual four-photo sheet, history reprint, interrupted transfer, sleep/reconnect, and correct trial watermark. Desktop QZ and AirPrint regression tests protect the other output methods.
