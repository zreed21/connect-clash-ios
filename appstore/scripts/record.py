"""Record the Pairstorm App Preview video (~20s) with Playwright, 1290x2796."""
import sys, glob
from playwright.sync_api import sync_playwright

UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
OUT_DIR = "/home/user/connect-clash-ios/appstore"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 430, "height": 932},
        device_scale_factor=3, is_mobile=True, has_touch=True,
        user_agent=UA,
        record_video_dir="/tmp/preview_video",
        record_video_size={"width": 1290, "height": 2796})
    pg = ctx.new_page()
    pg.goto("http://127.0.0.1:8010/game.html")
    pg.wait_for_selector("#btnPlay", timeout=20000)
    pg.wait_for_timeout(3500)                       # menu beauty shot

    pg.click('[data-mode="net"]')                   # show online duel tab
    pg.wait_for_timeout(2600)
    pg.click('[data-mode="solo"]')                  # back to solo
    pg.wait_for_timeout(900)
    pg.click("#btnPlay")                            # start match
    pg.wait_for_selector("#grid button[data-w]", timeout=15000)
    pg.wait_for_timeout(4200)                       # countdown drama

    cells = pg.query_selector_all("#grid button[data-w]")
    pg.click("#grid button[data-w]:nth-child(1)")   # tap a couple of words
    pg.wait_for_timeout(900)
    pg.click("#grid button[data-w]:nth-child(3)")
    pg.wait_for_timeout(2600)                       # hold on live board

    ctx.close()
    browser.close()

vid = glob.glob("/tmp/preview_video/*.webm")[0]
print("RECORDED:", vid)
