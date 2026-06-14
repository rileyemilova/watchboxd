import asyncio
import re
import requests
from fastapi import FastAPI, Query, HTTPException
from playwright.async_api import async_playwright, Browser

app = FastAPI()


def get_total_pages(username: str) -> int:
    html = requests.get(
        f"https://letterboxd.com/{username}/watchlist/",
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=15,
    ).text
    matches = re.findall(r"/watchlist/page/(\d+)/", html)
    return max((int(m) for m in matches), default=1)


async def scrape_page(browser: Browser, url: str) -> list[dict]:
    page = await browser.new_page()
    try:
        await page.set_viewport_size({"width": 1280, "height": 30000})

        # Block font requests
        await page.route("**/*", lambda route: (
            route.abort() if route.request.resource_type == "font" else route.continue_()
        ))

        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)

        await page.wait_for_selector(".griditem .film-poster", timeout=30_000)

        try:
            await page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            pass

        items = await page.eval_on_selector_all(
            ".griditem .film-poster",
            """els => els.map(el => ({
                title: (el.querySelector("img")?.getAttribute("alt") ?? "").replace(/^Poster for\s+/i, ""),
                image: el.querySelector("img")?.getAttribute("src") ?? "",
            }))""",
        )
        return items
    finally:
        await page.close()


@app.get("/watchlist")
async def watchlist(username: str = Query(...)):
    try:
        total_pages = get_total_pages(username)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pages: {e}")

    urls = [
        f"https://letterboxd.com/{username}/watchlist/"
        if i == 0
        else f"https://letterboxd.com/{username}/watchlist/page/{i + 1}/"
        for i in range(total_pages)
    ]

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        try:
            results = await asyncio.gather(*[scrape_page(browser, url) for url in urls])
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            await browser.close()

    return [item for page in results for item in page]
