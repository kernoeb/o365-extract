import { join } from "path";

const TOKEN_CACHE_PATH = join(import.meta.dir, "..", ".token-cache.json");

const DEFAULT_CLIENT_ID = "1fec8e78-bce4-4aaf-ab1b-5451cc387264"; // Microsoft Teams
const CLIENT_ID = process.env.O365_CLIENT_ID || DEFAULT_CLIENT_ID;
const TENANT = process.env.O365_TENANT || "organizations";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

// v1.0 endpoints for device code flow (same as squads-cli)
const DEVICE_CODE_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/devicecode`;
const TOKEN_V1_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/token`;
// v2.0 endpoint for refresh token → Graph token exchange
const TOKEN_V2_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

const HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Origin: "https://teams.microsoft.com",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
};

async function requestDeviceCode() {
  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: HEADERS,
    body: `client_id=${CLIENT_ID}&resource=https://api.spaces.skype.com`,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Device code request failed: ${body}`);
  }
  return res.json();
}

async function pollForRefreshToken(deviceCode, interval) {
  let pollInterval = Math.min(interval, 2) * 1000;

  while (true) {
    await Bun.sleep(pollInterval);

    const res = await fetch(TOKEN_V1_URL, {
      method: "POST",
      headers: HEADERS,
      body: `client_id=${CLIENT_ID}&code=${deviceCode}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
    });

    const data = await res.json();

    if (data.refresh_token) {
      return data.refresh_token;
    }

    if (data.error === "authorization_pending") {
      continue;
    }

    if (data.error === "slow_down") {
      pollInterval += 5000;
      continue;
    }

    throw new Error(`Device code auth failed: ${data.error_description || data.error}`);
  }
}

// Exchange refresh token for a Graph API access token using .default scope (same as squads-cli)
async function exchangeForGraphToken(refreshToken) {
  const body = `client_id=${CLIENT_ID}&scope=${encodeURIComponent(GRAPH_SCOPE + " openid profile offline_access")}&grant_type=refresh_token&client_info=1&x-client-SKU=msal.js.browser&x-client-VER=3.7.1&refresh_token=${refreshToken}&claims=${encodeURIComponent('{"access_token":{"xms_cc":{"values":["CP1"]}}}')}`;

  const res = await fetch(TOKEN_V2_URL, {
    method: "POST",
    headers: HEADERS,
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph token exchange failed: ${err}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

export async function login() {
  const deviceCodeResponse = await requestDeviceCode();
  const { device_code, user_code, verification_url, interval = 5 } = deviceCodeResponse;

  const loginUrl = "https://login.microsoftonline.com/common/oauth2/deviceauth";

  // Copy code to clipboard (cross-platform, best-effort)
  try {
    const cmds = { darwin: ["pbcopy"], win32: ["cmd", "/c", "clip"], linux: ["xclip", "-selection", "clipboard"] };
    const cmd = cmds[process.platform] || cmds.linux;
    const proc = Bun.spawn(cmd, { stdin: "pipe" });
    proc.stdin.write(user_code);
    proc.stdin.end();
    await proc.exited;
  } catch {}

  // Open browser (cross-platform, best-effort)
  try {
    const open = { darwin: ["open"], win32: ["cmd", "/c", "start"], linux: ["xdg-open"] };
    const cmd = open[process.platform] || open.linux;
    Bun.spawn([...cmd, loginUrl]);
  } catch {}

  console.log(`\nCode: ${user_code} (copied to clipboard, just paste it)`);
  console.log(`Opening browser...\n`);
  console.log("Waiting for authentication...");

  const refreshToken = await pollForRefreshToken(device_code, interval);
  const graphToken = await exchangeForGraphToken(refreshToken);

  const cache = {
    access_token: graphToken.access_token,
    refresh_token: graphToken.refresh_token,
    expires_in: graphToken.expires_in,
    obtained_at: Date.now(),
  };

  await Bun.write(TOKEN_CACHE_PATH, JSON.stringify(cache, null, 2));
  return cache;
}

export async function logout() {
  const file = Bun.file(TOKEN_CACHE_PATH);
  if (await file.exists()) {
    const { unlinkSync } = await import("fs");
    unlinkSync(TOKEN_CACHE_PATH);
    console.log("Token cache removed. Logged out.");
  } else {
    console.log("No token cache found. Already logged out.");
  }
}

async function loadCache() {
  const file = Bun.file(TOKEN_CACHE_PATH);
  if (!(await file.exists())) return null;
  return file.json();
}

async function saveCache(cache) {
  await Bun.write(TOKEN_CACHE_PATH, JSON.stringify(cache, null, 2));
}

export async function refreshAccessToken(cache) {
  const graphToken = await exchangeForGraphToken(cache.refresh_token);

  const updated = {
    access_token: graphToken.access_token,
    refresh_token: graphToken.refresh_token || cache.refresh_token,
    expires_in: graphToken.expires_in,
    obtained_at: Date.now(),
  };

  await saveCache(updated);
  return updated;
}

export async function getAccessToken() {
  let cache = await loadCache();
  if (!cache) {
    throw new Error("Not logged in. Run: bun run index.js login");
  }

  const expiresAt = cache.obtained_at + cache.expires_in * 1000;
  const margin = 60 * 1000;

  if (Date.now() >= expiresAt - margin) {
    console.log("Token expired, refreshing...");
    cache = await refreshAccessToken(cache);
  }

  return cache.access_token;
}
