"""Capture real App Store screenshots of Pairstorm at exact Apple resolutions."""
import os
import sys
from playwright.sync_api import sync_playwright

OUT = "/home/user/connect-clash-ios/appstore/screenshots"
URL = "http://localhost:8010/game.html"
os.makedirs(OUT, exist_ok=True)

# (name, css_w, css_h, device_scale_factor) -> physical px = Apple's required sizes
PHONE_SIZES = [("6-7in", 430, 932, 3),   # -> 1290x2796
               ("6-5in", 428, 926, 3)]   # -> 1284x2778
IPAD_SIZE = ("ipad-12-9in", 1024, 1366, 2)  # -> 2048x2732

UA_IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
             "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")
UA_IPAD = ("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
           "(KHTML, like Gecko) Mobile/15E148")


def shoot(browser, name, w, h, ua, dsf=3, with_duel=True):
    ctx = browser.new_context(viewport={"width": w, "height": h},
                              device_scale_factor=dsf, is_mobile=True,
                              has_touch=True, user_agent=ua)
    pg = ctx.new_page()
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_selector("h1.title", timeout=15000)
    pg.wait_for_timeout(900)  # fonts/theme settle
    pg.screenshot(path=f"{OUT}/{name}_menu.png")
    print("shot", name, "menu")

    if with_duel:
        pg.click('[data-mode="net"]')
        pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/{name}_duel.png")
        print("shot", name, "duel")
        pg.click('[data-mode="solo"]')
        pg.wait_for_timeout(400)

    pg.click("#btnPlay")
    pg.wait_for_selector("#grid button[data-w]", timeout=15000)
    # wait out the 3-2-1 countdown overlay
    pg.wait_for_function("document.getElementById('overlays').innerText.trim()===''",
                         timeout=15000)
    pg.wait_for_timeout(700)  # board fully revealed
    pg.screenshot(path=f"{OUT}/{name}_board.png")
    print("shot", name, "board")

    cells = pg.query_selector_all("#grid button[data-w]")
    if len(cells) > 4:
        cells[0].click(); pg.wait_for_timeout(350)
        cells[5].click(); pg.wait_for_timeout(500)
        pg.screenshot(path=f"{OUT}/{name}_picks.png")
        print("shot", name, "picks")
    ctx.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, w, h, dsf in PHONE_SIZES:
            shoot(browser, name, w, h, UA_IPHONE, dsf)
        n, w, h, dsf = IPAD_SIZE
        shoot(browser, n, w, h, UA_IPAD, dsf, with_duel=False)
        browser.close()
    print("ALL SCREENSHOTS DONE")


if __name__ == "__main__":
    main()
