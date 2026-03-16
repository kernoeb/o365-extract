import { fetchPage, fetchCount } from "./graph.js";
import {
  loadExistingItems,
  appendItems,
  loadResumeState,
  saveResumeState,
  ensureDataDir,
} from "./storage.js";

const BAR_WIDTH = 20;

function bar(fraction) {
  const filled = Math.round(fraction * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

const ENTITIES = {
  messages: {
    label: "Messages",
    url: "/me/messages?$select=from,toRecipients,ccRecipients,bccRecipients,subject,body,receivedDateTime&$top=100",
  },
  events: {
    label: "Events",
    url: "/me/events?$select=subject,attendees,organizer,start,end&$top=100",
  },
  contacts: { label: "Contacts", url: "/me/contacts?$select=displayName,emailAddresses&$top=100" },
};

async function fetchEntity(entity, getToken, state, resumeState) {
  const { label, url } = ENTITIES[entity];
  const existing = loadExistingItems(entity);
  const allItems = [...existing];

  // Resume: use saved nextLink, or start fresh
  let nextUrl = resumeState[entity]?.nextLink || url;

  // If already completed in a previous run
  if (resumeState[entity]?.done) {
    state[label].count = allItems.length;
    state[label].done = Date.now();
    return allItems;
  }

  // If we have existing items, we're resuming
  if (existing.length > 0) {
    state[label].count = existing.length;
  }

  while (nextUrl) {
    const token = await getToken();
    const { items, nextLink } = await fetchPage(nextUrl, token);
    allItems.push(...items);
    state[label].count = allItems.length;

    // Append to NDJSON immediately
    if (items.length > 0) {
      appendItems(entity, items);
    }

    // Save resume state after each page
    resumeState[entity] = { nextLink: nextLink, done: !nextLink };
    saveResumeState(resumeState);

    nextUrl = nextLink;
  }

  state[label].done = Date.now();
  return allItems;
}

export async function fetchAll(getToken) {
  ensureDataDir();

  const resumeState = loadResumeState();
  const isResuming = Object.keys(resumeState).length > 0;

  // Fetch counts for progress
  const token = await getToken();
  const [msgTotal, evtTotal, ctcTotal] = await Promise.all([
    fetchCount("/me/messages", token).catch(() => null),
    fetchCount("/me/events", token).catch(() => null),
    fetchCount("/me/contacts", token).catch(() => null),
  ]);

  if (isResuming) {
    const already = Object.entries(resumeState)
      .filter(([, v]) => !v.done)
      .map(([k]) => ENTITIES[k].label);
    if (already.length > 0) {
      console.log(`  Resuming: ${already.join(", ")}\n`);
    }
  }

  const state = {
    Messages: { count: 0, total: msgTotal, done: false, start: Date.now() },
    Events: { count: 0, total: evtTotal, done: false, start: Date.now() },
    Contacts: { count: 0, total: ctcTotal, done: false, start: Date.now() },
  };

  let renderInterval;

  function render() {
    if (render.started) {
      process.stdout.write("\x1b[3A");
    }
    render.started = true;

    for (const [label, s] of Object.entries(state)) {
      const elapsed = (s.done || Date.now()) - s.start;
      const secs = (elapsed / 1000).toFixed(1);

      if (s.done) {
        process.stdout.write(
          `\x1b[2K  ✓ ${label.padEnd(9)} ${bar(1)} ${String(s.count).padStart(6)}/${String(s.count).padStart(6)}  100%  ${secs}s\n`,
        );
      } else if (s.total) {
        const pct = Math.min(s.count / s.total, 1);
        const pctStr = String(Math.round(pct * 100)).padStart(3) + "%";
        process.stdout.write(
          `\x1b[2K  … ${label.padEnd(9)} ${bar(pct)} ${String(s.count).padStart(6)}/${String(s.total).padStart(6)}  ${pctStr}  ${secs}s\n`,
        );
      } else {
        const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        const frame = spinner[Math.floor(elapsed / 200) % spinner.length];
        process.stdout.write(
          `\x1b[2K  ${frame} ${label.padEnd(9)} ${String(s.count).padStart(6)} items  ${secs}s\n`,
        );
      }
    }
  }

  renderInterval = setInterval(render, 150);
  render();

  const [messages, events, contacts] = await Promise.all([
    fetchEntity("messages", getToken, state, resumeState),
    fetchEntity("events", getToken, state, resumeState),
    fetchEntity("contacts", getToken, state, resumeState),
  ]);

  clearInterval(renderInterval);
  render();

  return { messages, events, contacts };
}
