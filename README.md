# o365-extract

Extract all email addresses from an Office 365 account (messages, calendar, contacts). Zero dependencies, runs on [Bun](https://bun.sh).

## Quick Start

**Windows (PowerShell):**

```powershell
irm bun.sh/install.ps1 | iex
irm https://github.com/kernoeb/o365-extract/archive/refs/heads/main.zip -OutFile o365.zip
Expand-Archive o365.zip -DestinationPath .
cd o365-extract-main
bun run index.js login
bun run index.js fetch
```

**macOS / Linux:**

```bash
curl -fsSL https://bun.sh/install | bash
curl -sL https://github.com/kernoeb/o365-extract/archive/refs/heads/main.tar.gz | tar xz
cd o365-extract-main
bun run index.js login
bun run index.js fetch
```

Your emails will be in `data/emails.txt`.

## How It Works

1. **`login`** — Opens a link, you enter a code and sign in with your O365 account
2. **`fetch`** — Downloads your messages, events, and contacts in parallel, extracts all email addresses
3. **`logout`** — Removes cached tokens

```
Fetching data from Office 365...

  ✓ Messages  ████████████████████   7320/  7320  100%  142.3s
  ✓ Events    ████████████████████    486/   486  100%    8.5s
  ✓ Contacts  ████████████████████    111/   111  100%    0.2s

Messages: 7,320 | Events: 486 | Contacts: 111
Unique emails: 1,808
Output: data/emails.txt
```

If interrupted (Ctrl+C, crash, etc.), just re-run `bun run index.js fetch` — it resumes where it left off.

## Sources

Emails are extracted from:

- **Messages** — from, to, cc, bcc fields + regex on body content
- **Calendar events** — organizer and attendees
- **Contacts** — all email addresses

Junk is automatically filtered out (image CIDs, Exchange internal addresses, MIME artifacts, etc.). Output is deduplicated and sorted.

## Output

```
data/
  messages.json    # Raw message data
  events.json      # Raw calendar events
  contacts.json    # Raw contacts
  emails.txt       # Deduplicated email list (one per line)
```

## Custom App Registration

By default, the tool uses a public Microsoft client ID. If your tenant blocks it or you prefer using your own app:

1. Go to [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. New registration → Name it, select "Accounts in any organizational directory"
3. Under **Authentication**, add "Mobile and desktop applications" platform, enable device code flow
4. Under **API permissions**, add Microsoft Graph delegated permissions: `Mail.Read`, `Calendars.Read`, `Contacts.Read`
5. Run with your client ID:

```bash
O365_CLIENT_ID=your-app-id bun run index.js login
```

You can also set `O365_TENANT` if needed (defaults to `organizations`).

## Disclaimer

This tool accesses your own mailbox data using your own credentials. You are responsible for complying with your organization's policies and applicable data protection regulations (GDPR, etc.) when using extracted data. Do not redistribute extracted email addresses without proper legal basis.

## License

MIT
