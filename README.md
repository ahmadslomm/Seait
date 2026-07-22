# Seait

Modern voice-social app — a protocol-identical clone of **ZaffaLive / com.waig.nalo**, rebuilt from reverse-engineering the original APK.

- **`backend/`** — NestJS backend exposing the **exact `api.php` protocol** (same cipher `base64(XOR(json, md5(pkg)))`, same `{response_status,response_data}` envelope, same 303 action names). Real handlers + fallback logger for unknown APIs. Prisma/PostgreSQL, seeded with the real analyzed account **1278472**.
- **`mobile/`** — Flutter app (dark-purple + gold VIP theme) connected to the backend via the real protocol. Me/Profile wired to `user.getUserinfo`, Home to `room.getRecommendRoomV2`.
- **`docs/`** — API_INVENTORY (303 endpoints), MODELS, DATABASE_SCHEMA, STATUS_REPORT.
- **`screenshots/`** — 38 real reference screenshots.
- **`assets/`** — extracted svga / pag / images / vip / frames.

See `docs/STATUS_REPORT.md` for what's linked / remaining and run instructions.
