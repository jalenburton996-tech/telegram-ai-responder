# Simple online setup

You do not need Docker, Terminal, or a public URL. Render creates the app, database, message queue, and public address from `render.yaml`. The app then connects its Telegram webhook automatically.

## What you enter

Render will ask for only four private/configuration values:

- `TELEGRAM_BOT_TOKEN`: the token BotFather gave you.
- `OPENAI_API_KEY`: your key from the OpenAI API dashboard.
- `BUSINESS_NAME`: the name customers should see.
- `BUSINESS_CONTEXT`: the facts the AI may use—services, prices, policies, and links.

Enter the two keys only in Render's secret fields. Never put them in source code, GitHub, or chat.

## What happens automatically

Render generates the webhook secret and public address, provisions PostgreSQL and Redis-compatible storage, builds the app, creates its tables, starts message processing, and tells Telegram where to deliver messages.

After Render reports **Live**, send a message to your Telegram account from the test account allowed under **Settings → Chat Automation**. The first reply can take a moment immediately after deployment.

## Stop button

To stop responses immediately, open Telegram **Settings → Chat Automation** and disconnect or pause the bot. You can also suspend the web service in Render.
