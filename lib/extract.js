const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const JUNK_PATTERNS = [
  /^image\d+\.\w+@/i, // Embedded image CIDs
  /\.prod\.outlook\.com$/i, // Outlook internal routing
  /^[0-9a-f]{20,}@/i, // Hex local parts (SMTP IDs, etc.)
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@/i, // GUIDs
  /\.[a-f0-9]{1,3}$/i, // Bad TLD (hex CID artifacts)
  /%[0-9a-f]{2}/i, // URL-encoded
  /@resource\.calendar\.google\.com$/i, // Google Calendar resources
  /@thread\.(tacv|v2)$/i, // Teams thread IDs
  /^microsoftexchange[0-9a-f]+@/i, // Exchange system addresses
  /^part\d+\.[a-z0-9]+\.[a-z0-9]+@/i, // MIME boundary references
  /^\/o=exchangelabs\//i, // Exchange X500 addresses
  /^[a-z0-9_.-]+@.*\.onmicrosoft\.com$/i, // Internal Exchange Online tenants (captured from body)
];

function isJunk(email) {
  return JUNK_PATTERNS.some((p) => p.test(email));
}

// Also filter X500/Exchange paths that aren't real emails
function looksLikeEmail(s) {
  return s.includes("@") && !s.startsWith("/");
}

function addEmail(set, email) {
  if (!email) return;
  // Strip surrounding quotes
  let cleaned = email.replace(/^['"""''`]+|['"""''`]+$/g, "");
  cleaned = cleaned.toLowerCase().trim();
  if (cleaned && looksLikeEmail(cleaned) && !isJunk(cleaned)) {
    set.add(cleaned);
  }
}

function extractFromRecipients(set, recipients) {
  if (!Array.isArray(recipients)) return;
  for (const r of recipients) {
    addEmail(set, r.emailAddress?.address);
  }
}

function extractFromMessages(set, messages) {
  for (const msg of messages) {
    addEmail(set, msg.from?.emailAddress?.address);
    extractFromRecipients(set, msg.toRecipients);
    extractFromRecipients(set, msg.ccRecipients);
    extractFromRecipients(set, msg.bccRecipients);

    // Extract emails from body content via regex
    const body = msg.body?.content;
    if (body) {
      const matches = body.match(EMAIL_REGEX);
      if (matches) {
        for (const m of matches) {
          addEmail(set, m);
        }
      }
    }
  }
}

function extractFromEvents(set, events) {
  for (const evt of events) {
    addEmail(set, evt.organizer?.emailAddress?.address);
    if (Array.isArray(evt.attendees)) {
      for (const a of evt.attendees) {
        addEmail(set, a.emailAddress?.address);
      }
    }
  }
}

function extractFromContacts(set, contacts) {
  for (const c of contacts) {
    if (Array.isArray(c.emailAddresses)) {
      for (const e of c.emailAddresses) {
        addEmail(set, e.address);
      }
    }
  }
}

export function extractEmails(messages, events, contacts) {
  const set = new Set();
  extractFromMessages(set, messages);
  extractFromEvents(set, events);
  extractFromContacts(set, contacts);
  return [...set].sort();
}
