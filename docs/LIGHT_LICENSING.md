# PhotoTags Light license client

The website repository contains the separate Light service, admin screens, migration, signing-key helper and deployment instructions in `docs/LIGHT_LICENSING.md`. It uses new `light_` database objects and an independently deployed API; Android licensing/payment code is unchanged.

This booth's `.env.example` lists its three public configuration values. Licensing defaults to disabled during setup. Enable `VITE_LIGHT_LICENSING_ENABLED=true` only after setting the separate Light API HTTPS origin and matching public signing JWK. Missing/invalid server configuration then fails closed. Never bundle server private keys or payment/database secrets.

Settings > Light license lets the host name the installation, activate a Light key, buy/renew a plan, check payment and refresh offline permits. The client persists a non-extractable installation key and signed permit in a dedicated IndexedDB database, outside photo-history exports. Clearing it requires host-assisted recovery/transfer. On iPhone/iPad activate in the installed Home Screen app; return to that app after Safari checkout and tap Check license / payment.

Kiosk launch and new print submissions require a valid, installation-bound permit when enforcement is enabled. Settings, saved photos, exports and unresolved-job review remain available so a host can recover without losing sessions. A clock heartbeat closes a kiosk when its permit expires; action handlers independently check the time before printing. Network outages preserve an unexpired signed permit, while explicit blocked/unlicensed responses clear it. Cached files and license validity are separate requirements for offline use.

The default offline window is seven days, capped by the plan expiry. A lifetime plan still requires periodic checks. Revocations/transfers cannot immediately invalidate permits on disconnected devices; administrators can see the most recently issued permit expiry. This is installation licensing with client-side protection, not hardware identification or tamper-proof offline DRM.

Source rollout does not enable licensing or run production migrations. Complete the website/service test-mode flow and real-device acceptance before enabling enforcement in a production booth.

## Activate an installation

1. Open the booth on the device and browser that will run the event. On iPhone/iPad, install it on the Home Screen first and open that installed app.
2. For a host-issued key, sign in to the website's `/admin`, open PhotoTags Light > Licenses, choose a plan and customer email, then select Create Light license. This issues a key; it does not collect payment or mark a payment paid.
3. In the booth, open Settings > Light license. Enter a recognizable installation name, paste the `PTL-...` key and select Activate Light license. Wait for License active and check the expiry dates.
4. Alternatively, select Activate license (or Renew license). In the dialog, accept the terms, choose a plan and receipt email, then select Show payment QR. Scan the QR with a supported bank or e-wallet. Keep this app open: it checks payment automatically and updates the license plan only after the service verifies payment and returns a valid signed permit. Check payment is available if you need to retry the check.
5. Open Offline & installation, select Prepare / check offline files and wait for Ready for offline use. Close and reopen the installed app without internet, then test Launch kiosk. Offline files and an unexpired license permit are both required.
6. In the website's PhotoTags Light > Installations, verify the installation is linked to the expected license. For a purchase, also check Payments shows paid. A successful checkout redirect alone does not confirm fulfillment.

Each installation uses a saved browser identity. A different browser, the installed Home Screen app, or cleared site data may create a different installation. For a transfer, use Installations > Release for transfer, then activate the same key on the new installation. The old offline permit may remain valid until the expiry shown in admin.

New purchases show the QR inside the activation dialog. Closing it does not cancel a purchase: use Resume license payment to reopen it, including after reloading. On a phone, save the QR and import it in a banking app if supported, or scan it from another device. An expired QR can be replaced only after server-side cancellation of the old intent is confirmed. Historical hosted purchases remain recoverable using their original checkout.

If Resume license payment shows a PayMongo link instead of a QR, it is an earlier hosted checkout. Enter the receipt email and select Switch to in-app QR. The server replaces it only after PayMongo confirms that unpaid checkout has expired; paid or processing purchases are preserved. New QR requests do not silently fall back to hosted checkout when setup is incomplete. Refresh or apply the app update without clearing site data.

The Light service requires migration `202611120001_light_inline_qr.sql` and the `payment.paid` event on its separate webhook for this flow. Its website repository documents the rollout in `docs/LIGHT_INLINE_QR.md`. Retain `checkout_session.payment.paid` for existing purchases and leave the APK webhook unchanged. New PayMongo payment descriptions include PhotoTags Light license, plan and reference.

## Settings organization

Printer connection contains the printer profile, photo lightness, thermal preview/export option, QZ host, queue and printer test. About the system is an expandable section in Overview. Branding, camera, themes, history, security and offline installation retain their own sections.
