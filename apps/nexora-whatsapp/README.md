# NEXORA WhatsApp Intelligence

A separate Cloudflare Worker application that receives WhatsApp Cloud API webhooks, keeps a short per-contact conversation history in D1, and uses the existing NEXORA AI gateway for reply generation.

## Safety defaults
- Automatic sending is OFF by default. Set the encrypted Worker variable `AUTO_REPLY_ENABLED` to `true` only after testing and explicitly deciding to enable it.
- Optional `ALLOWED_PHONE_NUMBERS` is a comma-separated allowlist of WhatsApp sender numbers in international digits-only format. Configure it during testing.
- The app processes text messages only. It ignores media, status notifications, and unsupported message types.
- Webhook POST requests are authenticated with Meta's `X-Hub-Signature-256` HMAC signature.
- The NEXORA gateway token, WhatsApp access token, app secret, and verify token must be stored as encrypted Worker secrets.
- This service is not an official WhatsApp client and does not automate a personal WhatsApp account. It uses the official WhatsApp Business Platform and is subject to Meta's policies, user consent, templates, and messaging-window rules.

## Required encrypted secrets
Set these with Wrangler secrets (never commit values):
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN` (choose a long random value)
- `NEXORA_GATEWAY_TOKEN` (same secret as the existing NEXORA gateway's `ATLAS_GATEWAY_TOKEN`)
- `NEXORA_GATEWAY_URL` (the existing gateway base URL)

Optional encrypted secret:
- `ALLOWED_PHONE_NUMBERS`

## Setup
1. Create a Cloudflare D1 database named `nexora-whatsapp` and replace the placeholder database ID in `wrangler.toml`.
2. Apply the schema: `npx wrangler d1 execute nexora-whatsapp --remote --file=apps/nexora-whatsapp/schema.sql` (run from repository root; adjust the path if running inside this folder).
3. From this directory, run `npx wrangler secret put SECRET_NAME` for each required secret and enter the value privately in the terminal.
4. Set the NEXORA gateway URL to `https://atlas-model-gateway.dannywise093.workers.dev` and the NEXORA gateway token to the matching existing gateway secret. Do not paste the token into GitHub or chat.
5. Deploy with `npx wrangler deploy`.
6. In Meta's WhatsApp Cloud API configuration, set the callback URL to `https://YOUR-WORKER.workers.dev/webhook`, use the same verify token, and subscribe to the `messages` webhook field.
7. Test with `AUTO_REPLY_ENABLED=false` first. Confirm webhook verification, health status, sender allowlist, and NEXORA connectivity before enabling replies.
8. Only then set `AUTO_REPLY_ENABLED=true` if automatic sending is wanted.

## Endpoints
- `GET /health`: configuration status; never returns secret values.
- `GET /webhook`: Meta webhook challenge verification.
- `POST /webhook`: signed inbound WhatsApp webhook.

## Current scope
Text-only inbound messages, deduplication, recent conversation context, and NEXORA-generated text replies. A dashboard, media/voice handling, human approval inbox, and production monitoring are not included yet.