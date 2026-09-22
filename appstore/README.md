# App Store Assets (Pairstorm)

Generated from the live web build (headless Chromium against `www/game.html`).

## Screenshots (`screenshots/`)
Raw device shots at exact Apple sizes:
- `6-7in_*.png`  1290x2796  (iPhone 15/16 Pro Max class)
- `6-5in_*.png`  1284x2778  (iPhone 11 Pro Max / XS Max class)
- `ipad-12-9in_*.png` 2048x2732 (iPad Pro 12.9")

Framed marketing variants with captions in `screenshots/framed/`
(6.7" native, 6.5" derived). Upload the framed set for phones, raw iPad shots for iPad.

## App Preview video
`app_preview_6-7in.mp4` — H.264, 1290x2796, ~17s (Apple requires 15–30s).
Shows: menu -> online duel tab -> solo match countdown -> live board with taps.

## Regenerate
    cd .. && python3 -m http.server 8010 --directory www   # serve web build
    python3 appstore/scripts/shoot.py    # raw screenshots
    python3 appstore/scripts/frame.py    # framed variants (+6.5 resize loop by hand)
    python3 appstore/scripts/record.py   # webm, then ffmpeg -> mp4 (H.264, 30fps)
