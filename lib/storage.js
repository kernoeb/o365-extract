import { join } from "path";
import { mkdirSync, existsSync, appendFileSync, readFileSync, unlinkSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "data");
const RESUME_PATH = join(DATA_DIR, ".resume.json");

export function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

// NDJSON helpers
function ndjsonPath(entity) {
  return join(DATA_DIR, `${entity}.ndjson`);
}

export function loadExistingItems(entity) {
  const path = ndjsonPath(entity);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf-8").trim().split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

export function appendItems(entity, items) {
  const path = ndjsonPath(entity);
  const lines = items.map((item) => JSON.stringify(item)).join("\n") + "\n";
  appendFileSync(path, lines);
}

// Resume state
export function loadResumeState() {
  if (!existsSync(RESUME_PATH)) return {};
  return JSON.parse(readFileSync(RESUME_PATH, "utf-8"));
}

export function saveResumeState(state) {
  Bun.write(RESUME_PATH, JSON.stringify(state, null, 2));
}

export function clearResume() {
  if (existsSync(RESUME_PATH)) unlinkSync(RESUME_PATH);
  // Clean up ndjson temp files
  for (const entity of ["messages", "events", "contacts"]) {
    const path = ndjsonPath(entity);
    if (existsSync(path)) unlinkSync(path);
  }
}

// Final output
export async function saveFinalResults(messages, events, contacts, emails) {
  ensureDataDir();
  await Promise.all([
    Bun.write(join(DATA_DIR, "messages.json"), JSON.stringify(messages, null, 2)),
    Bun.write(join(DATA_DIR, "events.json"), JSON.stringify(events, null, 2)),
    Bun.write(join(DATA_DIR, "contacts.json"), JSON.stringify(contacts, null, 2)),
    Bun.write(join(DATA_DIR, "emails.txt"), emails.join("\n") + "\n"),
  ]);
  clearResume();
}
