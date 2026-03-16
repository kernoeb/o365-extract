const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const MAX_RETRIES = 5;

export async function graphFetch(url, accessToken, extraHeaders = {}) {
  const fullUrl = url.startsWith("http") ? url : `${GRAPH_BASE}${url}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="text"',
        ...extraHeaders,
      },
    });

    if (res.ok) {
      return res.json();
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "10", 10);
      console.log(`Rate limited. Retrying in ${retryAfter}s...`);
      await Bun.sleep(retryAfter * 1000);
      continue;
    }

    if (res.status >= 500) {
      const backoff = Math.pow(2, attempt) * 1000;
      console.log(`Server error ${res.status}. Retrying in ${backoff / 1000}s...`);
      await Bun.sleep(backoff);
      continue;
    }

    const body = await res.text();
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }

  throw new Error(`Max retries (${MAX_RETRIES}) exceeded for ${fullUrl}`);
}

export async function fetchCount(url, accessToken) {
  const sep = url.includes("?") ? "&" : "?";
  const countUrl = `${url}${sep}$count=true&$top=1`;
  const data = await graphFetch(countUrl, accessToken, { ConsistencyLevel: "eventual" });
  return data["@odata.count"] ?? null;
}

// Returns { items, nextLink }
export async function fetchPage(url, accessToken) {
  const fullUrl = url.startsWith("http") ? url : `${GRAPH_BASE}${url}`;
  const data = await graphFetch(fullUrl, accessToken);
  return {
    items: data.value || [],
    nextLink: data["@odata.nextLink"] || null,
  };
}
