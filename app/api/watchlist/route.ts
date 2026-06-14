import { NextRequest } from "next/server";

export const maxDuration = 60;

const SCRAPER_URL = process.env.SCRAPER_URL ?? "http://localhost:8001";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  if (!username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${SCRAPER_URL}/watchlist?username=${encodeURIComponent(username)}`,
      { signal: AbortSignal.timeout(55_000) },
    );
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "scrape failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
