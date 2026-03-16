# o365-extract

CLI tool to extract all email addresses from an Office 365 account. Zero npm dependencies, runs on [Bun](https://bun.sh).

## Sources

Extracts emails from three Microsoft Graph API sources:

- **Messages** — from, to, cc, bcc fields + email regex on body content
- **Calendar events** — organizer and attendees
- **Contacts** — all email addresses

## Features

- Device Code authentication flow (no app registration needed)
- Parallel fetching with live progress bar
- Automatic token refresh for large mailboxes
- Resume support — crash-safe, restarts where it left off
- Junk filtering — removes image CIDs, Exchange internal addresses, MIME artifacts, etc.
- Deduplicated, sorted output

## Usage

```bash
bun run index.js login     # Authenticate via device code
bun run index.js fetch     # Fetch all data + extract emails
bun run index.js logout    # Remove cached tokens
```

### Login

Opens a device code flow. Follow the link, enter the code, and authenticate with your O365 account.

```
To sign in, open: https://login.microsoft.com/device
Enter the code:  L49NYPGMQ

Waiting for authentication...
Logged in as John Doe (john.doe@example.com)
```

### Fetch

Fetches messages, events, and contacts in parallel with a live progress bar:

```
Fetching data from Office 365...

  ✓ Messages  ████████████████████   7320/  7320  100%  142.3s
  ✓ Events    ████████████████████    486/   486  100%    8.5s
  ✓ Contacts  ████████████████████    111/   111  100%    0.2s

Messages: 7,320 | Events: 486 | Contacts: 111
Unique emails: 1,808
Output: data/emails.txt
```

If interrupted, re-run the same command — it resumes from the last fetched page.

## Output

```
data/
  messages.json    # Raw message data
  events.json      # Raw calendar events
  contacts.json    # Raw contacts
  emails.txt       # Deduplicated email list (one per line)
```

## Custom App Registration

By default, the tool uses a public Microsoft client ID. If your tenant blocks it or you prefer using your own app, create an Azure AD app registration:

1. Go to [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. New registration → Name it, select "Accounts in any organizational directory"
3. Under **Authentication**, add "Mobile and desktop applications" platform, enable device code flow
4. Under **API permissions**, add Microsoft Graph delegated permissions: `Mail.Read`, `Calendars.Read`, `Contacts.Read`
5. Run with your client ID:

```bash
O365_CLIENT_ID=your-app-id bun run index.js login
```

You can also set `O365_TENANT` if needed (defaults to `organizations`).

## Requirements

- [Bun](https://bun.sh) runtime
- An Office 365 account (work or school)

## Disclaimer

This tool accesses your own mailbox data using your own credentials. You are responsible for complying with your organization's policies and applicable data protection regulations (GDPR, etc.) when using extracted data. Do not redistribute extracted email addresses without proper legal basis.

## License

MIT
