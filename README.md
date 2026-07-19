# Telegram Business AI Auto-Responder

A production-oriented, official Telegram Business connected-bot backend. Customers message your normal Telegram account; the bot processes permitted private business chats and replies on behalf of that account. It does **not** log in as a userbot.

## Safety and behavior

- Verifies Telegram's webhook secret and never places credentials in source code.
- Accepts only connected Business updates and sends through `business_connection_id`.
- Queue-backed processing, update deduplication, retries, per-chat/global rate limits, and structured audit events.
- Numeric Telegram user allowlist and denylist (deny always wins).
- Timezone-aware weekly business hours with hold, closed-message, or AI-reply behavior.
- Treats an outgoing message not previously sent by this service as manual takeover and pauses AI for the configured interval.
- Keeps a bounded transcript in PostgreSQL and purges message bodies after the retention period.
- Hands off when the model cannot safely answer from the supplied business facts.

## 1. Create and connect the bot

1. In Telegram, open the verified **@BotFather** account and run `/newbot`. Copy the token once into `TELEGRAM_BOT_TOKEN`; never paste it into chat or commit it.
2. In BotFather, enable the connected-account capability. Telegram's current UI may call it **Secretary Mode** (formerly **Business Mode**):
   - Classic chat menu: send `/mybots` → choose your bot → **Bot Settings → Secretary Mode** (or **Business Mode**) → **Turn on**.
   - New BotFather panel: tap **Open** beside the message box → choose your bot → **Settings → Mode Settings → Secretary Mode**.
   Telegram's API documentation still uses the terms “Business Mode” and “business bot”; the backend/API flow is unchanged.
3. In your normal Telegram account, open **Settings → Chat Automation**, select the bot, and choose which private chats it may manage. Start narrowly—new non-contact chats or selected test accounts. Do not use the paid **Telegram Business** tab; Telegram moved the free connected-bot flow to **Chat Automation** in May 2026. If that row is missing, update the official Telegram mobile app and fully restart it.
4. Grant only the rights needed to read and reply. This project does not need profile, gift, deletion, or username-management rights.
5. Confirm eligibility by calling `getMe` as shown under Verification. Its result must contain `"can_connect_to_business": true`. Then, after deployment and webhook setup, reconnect or toggle the connection if the backend has not yet received a `business_connection` update.

Telegram currently supports one connected business bot per account. Telegram exposes recipient selection and a per-chat pause/resume control in its clients. Connecting a bot does not require Premium, although the separate Telegram Business feature bundle does. Availability and UI labels may differ on older or third-party clients.

## 2. Configure locally

Requirements: Node.js 22+, Docker, and a public HTTPS URL for webhook testing (for example a secure tunnel).

```sh
cp .env.example .env
openssl rand -hex 32
docker compose up -d postgres redis
npm install
npm run db:migrate
npm run dev
```

Put the generated random value in `TELEGRAM_WEBHOOK_SECRET`. Set a public HTTPS `PUBLIC_BASE_URL`, then in another terminal:

```sh
npm run dev:worker
npm run setup:webhook
```

Do not expose PostgreSQL or Redis publicly. The sample Compose file leaves them unbound to host ports; run the app in Compose for a self-contained local stack, or add loopback-only development ports if you intentionally run Node on the host.

## 3. Configure policy

- `BUSINESS_CONTEXT`: the authoritative FAQs, prices, policies, and links the AI may use. Keep it specific and reviewed.
- `ALLOW_USER_IDS` / `DENY_USER_IDS`: comma-separated numeric IDs, not usernames. An empty allowlist permits everyone not denied. For initial testing, set your test account ID in the allowlist.
- `BUSINESS_HOURS`: Monday through Sunday, seven comma-separated values such as `09:00-17:00,...,closed`.
- `OUT_OF_HOURS_MODE`: `hold` sends nothing, `message` sends the fixed closed message once per inbound message, and `reply` runs the AI normally.
- `MANUAL_TAKEOVER_MINUTES`: AI pause after you manually send a message in that chat. Telegram's own per-chat Pause control is the strongest indefinite takeover option.
- `MEMORY_MESSAGES` and `MEMORY_RETENTION_DAYS`: bound prompt context and stored message-body lifetime.
- `OPENAI_MODEL`: configurable model ID. The default favors latency/cost; pin a snapshot after evaluation if deterministic change control matters.

Restart both web and worker services after environment changes.

## 4. Deploy

Deploy the same image as two processes:

- Web: `node dist/src/server.js`
- Worker: `node dist/src/worker.js`
- Release/migration: `node dist/src/migrate.js`

Provision managed PostgreSQL and Redis with TLS and authentication, inject secrets through the host's secret manager, enable encrypted backups, and place the web process behind HTTPS. Deploy at least one web and one worker instance. Point health checks to `/health/live` and readiness checks to `/health/ready`. Then run `npm run setup:webhook` once with the production environment.

The included Docker Compose file is suitable for a single-host pilot. For production, use managed data stores, image digest pinning, automatic security updates, centralized log collection, alerts on repeated `job_failed`/`rate_limited` events, and a staging bot/account before rollout.

## Operations and privacy

- Logs record events and IDs, but not message bodies or secrets. PostgreSQL contains message text for memory; protect and disclose that retention to users as applicable.
- To stop all automation immediately, disconnect the chatbot in Telegram Business settings. To stop one conversation, use Telegram's pause control or send a manual reply (temporary pause).
- To erase one chat's stored memory:

```sql
DELETE FROM messages WHERE connection_id = '...' AND chat_id = 123;
```

- Rotate a leaked bot token in BotFather, rotate the webhook secret, update the secret manager, restart services, and run webhook setup again.
- Test prompt-injection, incorrect-price, privacy, escalation, bursts, duplicate webhooks, worker restarts, and human-takeover cases before enabling broad recipient access.

## Verification

```sh
npm run check
npm test
npm run build
```

Useful Telegram checks:

```sh
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

In the `getMe` response, verify `result.can_connect_to_business` is `true`. If it is missing or false, update Telegram and BotFather, fully restart Telegram, reopen BotFather's **Open** management panel, and enable **Secretary Mode** for the correct bot.

Never paste the resulting URLs or output into tickets: the URL contains the bot token.
