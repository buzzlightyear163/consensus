"""Screenshots brand/render.html at 2x and downsamples to the final sizes.

Run the dev server first (npm run dev), then: python3 brand/render.py [port]
"""
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "5173"
OUT = Path(__file__).parent
SHOTS = {
    "coin": ("consensus-coin.png", (1000, 1000)),
    "banner": ("consensus-x-banner.png", (1500, 500)),
    "launch": ("consensus-launch.png", (1600, 900)),
}

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    for shot, (name, (w, h)) in SHOTS.items():
        page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
        page.goto(f"http://localhost:{PORT}/brand/render.html?shot={shot}")
        page.wait_for_function("window.__done === true", timeout=60000)
        page.wait_for_timeout(300)
        raw = OUT / f".{shot}@2x.png"
        page.locator("#frame").screenshot(path=str(raw))
        Image.open(raw).convert("RGB").resize((w, h), Image.LANCZOS).save(OUT / name, optimize=True)
        raw.unlink()
        print("saved", name)
        page.close()
    browser.close()

# The coin image doubles as the X profile picture.
Image.open(OUT / "consensus-coin.png").resize((400, 400), Image.LANCZOS).save(OUT / "consensus-x-pfp.png", optimize=True)
print("saved consensus-x-pfp.png")
