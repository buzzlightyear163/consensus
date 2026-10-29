"""Renders brand/video.html to consensus-launch.mp4 (1920x1080, 30 fps, H.264).

Run the dev server first (npm run dev), then:
  python3 brand/video.py [port]              full render
  python3 brand/video.py [port] --preview    a few still frames to check
"""
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].isdigit() else "5173"
PREVIEW = "--preview" in sys.argv
OUT = Path(__file__).parent
W, H, FPS = 1920, 1080, 30

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    page.goto(f"http://localhost:{PORT}/brand/video.html")
    page.wait_for_function("window.__ready === true", timeout=60000)
    duration = page.evaluate("window.__duration")
    frame = page.locator("#frame")

    def shot(t):
        page.evaluate(f"window.__frame({t})")
        return frame.screenshot(type="jpeg", quality=92)

    if PREVIEW:
        for t in [0, 4.7, 7.0, 10.2, 13.0]:
            (OUT / f".preview-{t:05.2f}.jpg").write_bytes(shot(t))
            print("preview", t)
    else:
        tmp = OUT / ".consensus-launch.part.mp4"
        ff = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(tmp)],
            stdin=subprocess.PIPE,
        )
        total = int(round(duration * FPS))
        for i in range(total):
            ff.stdin.write(shot(i / FPS))
            if i % 60 == 0:
                print(f"frame {i}/{total}", flush=True)
        ff.stdin.close()
        if ff.wait() == 0:
            os.replace(tmp, OUT / "consensus-launch.mp4")
            print("saved consensus-launch.mp4")
        else:
            print("ffmpeg failed")
    browser.close()
