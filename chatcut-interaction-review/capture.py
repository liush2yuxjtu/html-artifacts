#!/usr/bin/env python3
from pathlib import Path
import json, subprocess, time, os
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "original-homepages-2026-09-15" / "chatcut"
PREVIEW_DIR = ROOT / "chatcut-production-mirror" / "dist"
OUT = ROOT / "chatcut-interaction-review" / "keyframes"
OUT.mkdir(parents=True, exist_ok=True)

ITEMS = [
  {"id":"A01","title":"Best Moments","baseline_heading":"Edit Like an Expert Editor","preview":"#best-moments","trigger":'.cc-local-send[aria-label="Apply editing prompt"]',"wait":2.2},
  {"id":"A02","title":"AI Motion Graphics","baseline_heading":"AI Motion Graphics, Generated From a Sentence","preview":"#motion-graphics","trigger":'a[aria-label="Generate"]',"wait":1.2},
  {"id":"A03","title":"Text-Based Editing","baseline_heading":"Text-Based Editing for Your Talking Head Content","preview":'#transcript-captions [data-tc-part="edit"]',"trigger":"#tc-edit-send","wait":1.6},
  {"id":"A04","title":"Auto AI Captions","baseline_heading":"Auto AI Captions, in 100+ Languages","preview":'#transcript-captions [data-tc-part="captions"]',"trigger":None,"wait":0.8},
  {"id":"A05","title":"AI Image Generation","baseline_heading":"AI Image Generation, Right Inside Your Edit","preview":'#image-to-video .itv-story:not(.itv-story-video)',"trigger":".itv-send-btn, a[aria-label='Generate']","wait":1.4},
  {"id":"A06","title":"AI Video Generation","baseline_heading":"AI Video Generation for the Shots You Couldn't Film","preview":"#image-to-video .itv-story-video","trigger":".itv-send-btn, a[aria-label='Generate']","wait":1.6},
  {"id":"A07","title":"AI Music Generator","baseline_heading":"AI Music Generator","preview":"#music-generation","trigger":".cc-music-send","wait":1.4},
]

def serve(path, port):
    return subprocess.Popen(["python3","-m","http.server",str(port),"--bind","127.0.0.1"], cwd=path, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def section_for_heading(page, heading):
    h = page.get_by_role("heading", name=heading, exact=False).first
    return h.locator("xpath=ancestor::section[1]")

def shot(locator, path):
    locator.scroll_into_view_if_needed()
    locator.screenshot(path=str(path))

baseline_server = serve(BASE_DIR, 8765)
preview_server = serve(PREVIEW_DIR, 8766)
time.sleep(1)

report = {"baseline":"2026-09-15 static homepage reference","preview":"current main build","items":[]}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        base = browser.new_page(viewport={"width":1440,"height":1000})
        preview = browser.new_page(viewport={"width":1440,"height":1000})
        base.goto("http://127.0.0.1:8765/", wait_until="domcontentloaded")
        preview.goto("http://127.0.0.1:8766/", wait_until="domcontentloaded")
        preview.wait_for_timeout(2200)

        for item in ITEMS:
            row = {"id":item["id"],"title":item["title"],"trigger":item["trigger"],"status":"UNKNOWN","errors":[]}
            try:
                bsec = section_for_heading(base, item["baseline_heading"])
                shot(bsec, OUT / f'{item["id"].lower()}-baseline.png')
                row["baseline_keyframe"] = f'{item["id"].lower()}-baseline.png'
            except Exception as e:
                row["errors"].append(f"baseline screenshot: {e}")

            try:
                root = preview.locator(item["preview"]).first
                root.wait_for(state="visible", timeout=12000)
                root.scroll_into_view_if_needed()
                preview.wait_for_timeout(500)
                shot(root, OUT / f'{item["id"].lower()}-preview-idle.png')
                row["preview_idle_keyframe"] = f'{item["id"].lower()}-preview-idle.png'

                if item["trigger"]:
                    trigger = root.locator(item["trigger"]).first
                    trigger.wait_for(state="visible", timeout=7000)
                    before = preview.evaluate("() => JSON.stringify(window.__chatcutDemoSession || {})")
                    trigger.click()
                    preview.wait_for_timeout(int(item["wait"]*1000))
                    after = preview.evaluate("() => JSON.stringify(window.__chatcutDemoSession || {})")
                    shot(root, OUT / f'{item["id"].lower()}-preview-after.png')
                    row["preview_after_keyframe"] = f'{item["id"].lower()}-preview-after.png'
                    row["session_before"] = before
                    row["session_after"] = after
                    row["status"] = "PASS" if before != after else "FAIL"
                    if before == after:
                        row["errors"].append("trigger did not change DemoSession")
                else:
                    row["status"] = "GAP"
                    row["errors"].append("no click gate implemented yet; native behavior remains")
            except Exception as e:
                row["status"] = "FAIL"
                row["errors"].append(f"preview interaction: {e}")
            report["items"].append(row)
        browser.close()
finally:
    baseline_server.terminate()
    preview_server.terminate()

(OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
