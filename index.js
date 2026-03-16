import { login, logout, getAccessToken } from "./lib/auth.js";
import { graphFetch } from "./lib/graph.js";
import { fetchAll } from "./lib/fetchers.js";
import { extractEmails } from "./lib/extract.js";
import { saveFinalResults } from "./lib/storage.js";

const command = process.argv[2];

function fmt(n) {
  return n.toLocaleString("en-US");
}

async function handleLogin() {
  await login();
  const token = await getAccessToken();
  const me = await graphFetch("/me", token);
  console.log(`\nLogged in as ${me.displayName} (${me.mail || me.userPrincipalName})`);
}

async function handleFetch() {
  console.log("Fetching data from Office 365...\n");

  const { messages, events, contacts } = await fetchAll(getAccessToken);
  const emails = extractEmails(messages, events, contacts);

  await saveFinalResults(messages, events, contacts, emails);

  console.log(
    `\nMessages: ${fmt(messages.length)} | Events: ${fmt(events.length)} | Contacts: ${fmt(contacts.length)}`,
  );
  console.log(`Unique emails: ${fmt(emails.length)}`);
  console.log("Output: data/emails.txt");
}

async function handleLogout() {
  await logout();
}

try {
  switch (command) {
    case "login":
      await handleLogin();
      break;
    case "fetch":
      await handleFetch();
      break;
    case "logout":
      await handleLogout();
      break;
    default:
      console.log("Usage: bun run index.js <login|fetch|logout>");
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
