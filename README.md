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

## Requirements

- [Bun](https://bun.sh) runtime
- An Office 365 account (work or school)
