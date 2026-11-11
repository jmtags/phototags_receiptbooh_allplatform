# PhotoTags Light license client

The website repository contains the separate Light service, admin screens, migration, signing-key helper and deployment instructions in `docs/LIGHT_LICENSING.md`. It uses new `light_` database objects and an independently deployed API; Android licensing/payment code is unchanged.

This booth's `.env.example` lists its three public configuration values. Licensing defaults to disabled during setup. Enable `VITE_LIGHT_LICENSING_ENABLED=true` only after setting the separate Light API HTTPS origin and matching public signing JWK. Missing/invalid server configuration then fails closed. Never bundle server private keys or payment/database secrets.

Settings > Light license lets the host name the installation, activate a Light key, buy/renew a plan, check payment and refresh offline permits. The client persists a non-extractable installation key and signed permit in a dedicated IndexedDB database, outside photo-history exports. Clearing it requires host-assisted recovery/transfer. On iPhone/iPad activate in the installed Home Screen app; return to that app after Safari checkout and tap Check license / payment.

Kiosk launch and new print submissions require a valid, installation-bound permit when enforcement is enabled. Settings, saved photos, exports and unresolved-job review remain available so a host can recover without losing sessions. A clock heartbeat closes a kiosk when its permit expires; action handlers independently check the time before printing. Network outages preserve an unexpired signed permit, while explicit blocked/unlicensed responses clear it. Cached files and license validity are separate requirements for offline use.

The default offline window is seven days, capped by the plan expiry. A lifetime plan still requires periodic checks. Revocations/transfers cannot immediately invalidate permits on disconnected devices; administrators can see the most recently issued permit expiry. This is installation licensing with client-side protection, not hardware identification or tamper-proof offline DRM.

Source rollout does not enable licensing or run production migrations. Complete the website/service test-mode flow and real-device acceptance before enabling enforcement in a production booth.
