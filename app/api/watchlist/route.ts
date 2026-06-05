import { NextRequest } from "next/server";
import puppeteer, { Browser } from "puppeteer";

export const runtime = "nodejs";
export const maxDuration = 60;

type WatchlistItem = { title: string; image: string };

async function getTotalPages(username: string): Promise<number> {
  const html = await fetch(
    `https://letterboxd.com/${username}/watchlist/`,
  ).then((r) => r.text());
  const matches = [...html.matchAll(/\/watchlist\/page\/(\d+)\//g)];
  return matches.length > 0
    ? Math.max(...matches.map((m) => parseInt(m[1])))
    : 1;
}

async function scrapePage(
  browser: Browser,
  url: string,
): Promise<WatchlistItem[]> {
  const page = await browser.newPage();
  try {
    // Tall viewport so all grid items are in view on load, triggering all lazy loaders at once
    await page.setViewport({ width: 1280, height: 30000 });

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["font"].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });

    await page.waitForFunction(
      () => {
        const imgs = document.querySelectorAll(".griditem .film-poster img");
        return (
          imgs.length > 0 &&
          Array.from(imgs).every((img) => !(img as HTMLImageElement).src.includes("empty-poster"))
        );
      },
      { timeout: 30_000 },
    );

    return page.evaluate(() =>
      Array.from(document.querySelectorAll(".griditem .film-poster")).map(
        (el) => ({
          title: el.querySelector(".frame-title")?.textContent?.trim() ?? "",
          image:
            el.querySelector("img")?.getAttribute("src") ??
            el.querySelector("img")?.getAttribute("srcset") ??
            "",
        }),
      ),
    );
  } finally {
    await page.close();
  }
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  if (!username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }

  const totalPages = await getTotalPages(username);

  const urls = Array.from({ length: totalPages }, (_, i) =>
    i === 0
      ? `https://letterboxd.com/${username}/watchlist/`
      : `https://letterboxd.com/${username}/watchlist/page/${i + 1}/`,
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const results = await Promise.all(
      urls.map((url) => scrapePage(browser, url)),
    );
    return Response.json(results.flat());
  } catch (err) {
    const message = err instanceof Error ? err.message : "scrape failed";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    await browser.close();
  }
}
