// =====================================================================
// FACEBOOK-FEED — returns the latest posts of the school's Facebook Page
// so the public homepage can show them (landing/FacebookSection.tsx).
//
// RESERVED / OFF BY DEFAULT: until the two secrets below exist, this
// function answers { configured: false } and the homepage shows nothing.
// To switch it on, add the secrets — no code change, no redeploy of the site:
//
//   FB_PAGE_ID            the numeric Page ID (Page -> About -> Page transparency)
//   FB_PAGE_ACCESS_TOKEN  a Page access token (ideally a long-lived / never-
//                         expiring one) with pages_read_engagement
//   FB_PAGE_URL           optional, e.g. https://www.facebook.com/AsianCollegeDumaguete
//                         (used for the "Visit our page" button; defaults to
//                         https://www.facebook.com/<FB_PAGE_ID>)
//
// Set them in Supabase Dashboard -> Edge Functions -> Secrets (see
// supabase/functions/.env.example). The token lives ONLY here — it is never
// sent to the browser. Responses are cached for 10 minutes so the Graph API
// is not hit on every page view.
//
// Deploy with JWT verification OFF (the homepage is public):
//   supabase functions deploy facebook-feed --no-verify-jwt
// =====================================================================

const FB_PAGE_ID = Deno.env.get("FB_PAGE_ID") || "";
const FB_PAGE_ACCESS_TOKEN = Deno.env.get("FB_PAGE_ACCESS_TOKEN") || "";
const FB_PAGE_URL = Deno.env.get("FB_PAGE_URL") || (FB_PAGE_ID ? `https://www.facebook.com/${FB_PAGE_ID}` : "");

const GRAPH_VERSION = "v21.0";
const POST_LIMIT = 6;
const CACHE_MS = 10 * 60 * 1000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface FeedPost {
  id: string;
  message: string;
  createdTime: string;
  url: string;
  image: string | null;
}

let cache: { at: number; body: unknown } | null = null;

async function loadPosts(): Promise<FeedPost[]> {
  const params = new URLSearchParams({
    fields: "id,message,created_time,permalink_url,full_picture",
    limit: String(POST_LIMIT),
    access_token: FB_PAGE_ACCESS_TOKEN,
  });
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(FB_PAGE_ID)}/posts?${params}`);
  if (!res.ok) {
    // Log Facebook's explanation (e.g. expired token) but never echo it, or the token, to visitors.
    console.error("[facebook-feed] graph api failed", res.status, await res.text());
    throw new Error("graph-failed");
  }
  const data = await res.json();
  return (data?.data || [])
    .filter((p: Record<string, unknown>) => p.permalink_url)
    .map((p: Record<string, unknown>): FeedPost => ({
      id: String(p.id),
      message: String(p.message || "").slice(0, 600),
      createdTime: String(p.created_time || ""),
      url: String(p.permalink_url),
      image: p.full_picture ? String(p.full_picture) : null,
    }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
    return json({ configured: false, posts: [] });
  }

  if (cache && Date.now() - cache.at < CACHE_MS) return json(cache.body);

  try {
    const posts = await loadPosts();
    const body = { configured: true, pageUrl: FB_PAGE_URL, posts };
    cache = { at: Date.now(), body };
    return json(body);
  } catch {
    // Token expired / wrong Page ID / Facebook down: serve the last good copy if
    // there is one, otherwise an empty feed — the homepage just hides the section.
    if (cache) return json(cache.body);
    return json({ configured: true, pageUrl: FB_PAGE_URL, posts: [] });
  }
});
