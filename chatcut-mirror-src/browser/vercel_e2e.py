#!/usr/bin/env python3
"""ChatCut Vercel browser acceptance gate.

Follows anthropics/skills:webapp-testing reconnaissance-then-action:
1) navigate + wait for networkidle
2) capture screenshot / rendered DOM evidence
3) inspect known stable selectors from html-artifacts PR #8
4) exercise Best Moments interaction only after the rendered page is healthy
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

SECTIONS = [
    "#best-moments", "#motion-graphics", "#transcript-captions",
    "#image-to-video", "#music-generation", "#pricing", "footer",
]

def visible(locator) -> bool:
    try:
        return any(item.is_visible() for item in locator.all())
    except Exception:
        return False

def scroll_journey(page):
    steps=[]
    for selector in SECTIONS:
        loc=page.locator(selector).first
        if loc.count()==0:
            steps.append({"selector":selector,"exists":False}); continue
        try:
            loc.scroll_into_view_if_needed(timeout=8000)
        except Exception:
            page.evaluate("sel => document.querySelector(sel)?.scrollIntoView({block:'center'})", selector)
        page.wait_for_timeout(500)
        steps.append({
            "selector":selector,"exists":True,
            "pending":loc.evaluate("el => Boolean(el.closest('astro-island[ssr]') || el.querySelector('astro-island[ssr]'))")
        })
    # A section list alone can skip the FAQ island on tall mobile layouts.
    for island in page.locator("astro-island[client='visible']").all():
        island.evaluate("el => (el.querySelector('section,nav,div,button,details') || el).scrollIntoView({block:'center',behavior:'instant'})")
        # Keep the island in view until hydration commits. A fixed 450 ms dwell
        # can leave slow visible islands before their observer callback runs.
        uid = island.get_attribute("uid")
        try:
            page.wait_for_function("uid => !Array.from(document.querySelectorAll('astro-island')).find(el => el.getAttribute('uid') === uid)?.hasAttribute('ssr')", arg=uid, timeout=10000)
        except PlaywrightTimeoutError:
            steps.append({"selector": "astro-island[uid=" + str(uid) + "]", "exists": True, "pending": True})
    page.evaluate("() => window.scrollTo({top:0, behavior:'instant'})")
    page.wait_for_timeout(300)
    return steps

def run_once(browser, target: str, out: Path, mobile: bool=False, cpu: int=1):
    out.mkdir(parents=True, exist_ok=True)
    viewport={"width":390,"height":844} if mobile else {"width":1440,"height":1000}
    context=browser.new_context(viewport=viewport, device_scale_factor=1, ignore_https_errors=False, locale="zh-CN", is_mobile=mobile, has_touch=mobile)
    page=context.new_page()
    if cpu > 1: context.new_cdp_session(page).send("Emulation.setCPUThrottlingRate", {"rate":cpu})
    console_errors=[]; page_errors=[]; failed=[]; doc_responses=[]; http_errors=[]; navigations=[]
    active_requests=set()
    page.on("request", lambda r: active_requests.add(r))
    page.on("requestfinished", lambda r: active_requests.discard(r))
    page.on("requestfailed", lambda r: active_requests.discard(r))
    page.on("console", lambda m: console_errors.append(m.text) if m.type=="error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.on("requestfailed", lambda r: failed.append({"url":r.url,"error":r.failure or "failed","type":r.resource_type}))
    def on_response(r):
        if r.status>=400: http_errors.append({"status":r.status,"url":r.url,"type":r.request.resource_type})
        if r.request.resource_type=="document": doc_responses.append({"status":r.status,"url":r.url})
    page.on("response", on_response)
    page.on("framenavigated", lambda f: navigations.append(f.url) if f==page.main_frame else None)

    report={"target":target,"failures":[]}
    initial=None
    try:
        initial=page.goto(target, wait_until="domcontentloaded", timeout=60000)
        try:
            page.wait_for_load_state("networkidle", timeout=20000); report["networkidle"]=True
        except PlaywrightTimeoutError:
            report["networkidle"]=False
            report["networkidle_pending"]=[{"url":r.url,"type":r.resource_type} for r in active_requests]
        page.wait_for_timeout(1200)
    except Exception as e:
        report["failures"].append("navigation-exception")
        report["navigation_exception"]=str(e)
    report["initial_status"]=initial.status if initial else None
    report["final_url"]=page.url
    report["title"]=page.title()
    report["h1"]=page.locator("h1").first.inner_text().strip() if page.locator("h1").count() else ""
    report["document_responses"]=doc_responses
    report["navigations"]=navigations
    report["console_errors"]=console_errors
    report["page_errors"]=page_errors
    report["request_failures"]=failed
    report["http_errors"]=http_errors
    report["vercel_auth_detected"]=("vercel.com/login" in page.url) or ("Log in to Vercel" in report["h1"])
    report["is_404"]=(report["title"].startswith("404") or "doesn’t exist" in report["h1"] or "doesn't exist" in report["h1"])
    report["astro_islands"]=page.locator("astro-island").count()
    report["pending_astro_islands"]=page.locator("astro-island[ssr]").count()
    report["playable_version"]=page.evaluate("() => document.documentElement.dataset.ccPlayableVersion || null")
    report["local_send_count"]=page.locator(".cc-local-send").count()
    report["horizontal_overflow"]=page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")
    report["scroll_journey"]=scroll_journey(page) if not report["is_404"] and not report["vercel_auth_detected"] else []

    # Lazy islands must be measured AFTER the scroll journey, not before it.
    if not report["is_404"] and not report["vercel_auth_detected"]:
        try:
            page.wait_for_function("() => document.querySelectorAll('astro-island[ssr]').length === 0", timeout=15000)
        except PlaywrightTimeoutError:
            pass
    report["astro_islands"] = page.locator("astro-island").count()
    report["pending_astro_islands"] = page.locator("astro-island[ssr]").count()
    report["playable_version"] = page.evaluate("() => document.documentElement.dataset.ccPlayableVersion || null")
    report["local_send_count"] = page.locator(".cc-local-send").count()
    (out/"rendered-before.html").write_text(page.content(), encoding="utf-8")

    screenshot="mobile.png" if mobile else "desktop-before.png"
    page.screenshot(path=str(out/screenshot), full_page=True, animations="disabled")

    interaction_ok=False; interaction_status=None
    if not report["is_404"] and not report["vercel_auth_detected"]:
        controls={
            "expert": visible(page.locator("#best-moments .cc-expert-send")),
            "motion": visible(page.locator("#motion-graphics [aria-label='Generate']")),
            "image": visible(page.locator("#image-to-video .itv-story:not(.itv-story-video) [aria-label='Generate']")),
            "video": visible(page.locator("#image-to-video .itv-story-video [aria-label='Generate']")),
            "music": visible(page.locator("#music-generation .cc-music-send")),
        }
        report["controls"]=controls
        expert=page.locator("#best-moments .cc-expert-send")
        if controls["expert"]:
            expert.first.click()
            try:
                page.wait_for_function("() => document.querySelector('#best-moments [data-cc-status=\"expert\"]')?.textContent.trim() === 'Done · first cut updated'", timeout=10000)
                interaction_ok=True
            except PlaywrightTimeoutError:
                pass
            status=page.locator("#best-moments [data-cc-status='expert']")
            interaction_status=status.first.inner_text().strip() if status.count() else None
            page.screenshot(path=str(out/"desktop-after.png"), full_page=True, animations="disabled")
    else:
        report["controls"]={}
    report["demo_actions"] = []
    if interaction_ok:
        actions = [
            ("motion", "#motion-graphics [aria-label='Generate']:visible", "done"),
            ("transcript", "#transcript-captions #tc-edit-send:visible", "clean"),
            ("image", "#image-to-video .itv-story:not(.itv-story-video) [aria-label='Generate']:visible", "generated"),
            ("video", "#image-to-video .itv-story-video [aria-label='Generate']:visible", "generated"),
            ("music", "#music-generation .cc-music-send:visible", "generated"),
        ]
        for name, selector, expected in actions:
            result = {"demo": name, "selector": selector, "expected": expected, "pass": False}
            try:
                page.locator(selector).first.click(timeout=8000)
                page.wait_for_function("([key,value]) => window.__chatcutDemoSession?.[key] === value", arg=[name,expected], timeout=10000)
                visible_checks = {
                    "motion": ("#motion-graphics [data-cc-status='motion']:visible", "Generated · editable motion graphics ready"),
                    "transcript": ("#tc-edit-status:visible", "fillers removed"),
                    "image": ("#image-to-video [data-cc-status='image']:visible", "Generated · ready to add to the edit"),
                    "video": ("#image-to-video [data-cc-status='video']:visible", "Generated · original preview video loaded"),
                    "music": ("#music-generation .cc-music-state-pill:visible", "Music ready"),
                }
                status_selector, expected_text = visible_checks[name]
                page.wait_for_function("([selector,text]) => Array.from(document.querySelectorAll(selector)).some(el => el.getClientRects().length && el.textContent.includes(text))", arg=[status_selector.replace(":visible", ""),expected_text], timeout=8000)
                result["visible_text"] = page.locator(status_selector).first.inner_text()
                if name == "transcript":
                    result["remaining_visible_fillers"] = page.locator("#transcript-captions .tc-word[data-tc-filler='true']:visible").count()
                    if result["remaining_visible_fillers"]: raise AssertionError("Filler words still visible")
                result["pass"] = True
                result["state"] = page.evaluate("key => window.__chatcutDemoSession?.[key]", name)
            except Exception as error:
                result["error"] = str(error)
            report["demo_actions"].append(result)
        page.screenshot(path=str(out/"all-demos-after.png"), full_page=True, animations="disabled")
        (out/"rendered-after.html").write_text(page.content(), encoding="utf-8")
    report["interaction_ok"]=interaction_ok
    report["interaction_status"]=interaction_status

    failures=report["failures"]
    if report["vercel_auth_detected"]: failures.append("vercel-deployment-protection")
    if report["is_404"]: failures.append("rendered-404")
    if report["initial_status"] and report["initial_status"]>=400: failures.append(f"initial-http-{report['initial_status']}")
    if any(x["status"]>=400 for x in doc_responses): failures.append("document-http-error")
    if urlparse(report["final_url"]).hostname != urlparse(target).hostname: failures.append("unexpected-final-host")
    if any(not a["pass"] for a in report["demo_actions"]): failures.append("demo-action-failed")
    if page_errors: failures.append("page-errors")
    if console_errors: failures.append("console-errors")
    if http_errors: failures.append("asset-or-http-errors")
    # Video range downloads may keep a healthy page non-idle. Only use this
    # bounded fallback when EVERY outstanding request is actually media.
    if not report.get("networkidle"):
        pending = report.get("networkidle_pending", [])
        report["media_only_readiness_fallback"] = bool(pending) and all(r["type"] == "media" for r in pending)
        if not report["media_only_readiness_fallback"]: failures.append("networkidle-not-reached")
    if any(not step.get("exists") for step in report["scroll_journey"]): failures.append("missing-required-section")
    if report["horizontal_overflow"]: failures.append("horizontal-overflow")
    if not report["is_404"] and not report["vercel_auth_detected"]:
        if report["playable_version"] != "2": failures.append("playable-patch-not-booted")
        if report["pending_astro_islands"]>0: failures.append("astro-islands-still-pending")
        if report["local_send_count"]==0: failures.append("no-playable-controls")
        if not report["controls"].get("expert",False): failures.append("expert-control-not-visible")
        if not interaction_ok: failures.append("expert-interaction-failed")
        if not all(report["controls"].values()): failures.append("missing-demo-control")

    report["non_media_request_failures"] = [r for r in failed if r["type"] != "media"]
    report["media_request_errors"] = [r for r in failed if r["type"] == "media" and r["error"] != "net::ERR_ABORTED"]
    if report["non_media_request_failures"]: failures.append("non-media-request-failed")
    if report["media_request_errors"]: failures.append("media-request-failed")
    report["viewport"] = viewport
    report["cpu_throttle"] = cpu
    report["hydration_diagnostics"] = page.evaluate("() => window.__ccHydrationErrors || []")
    (out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    context.close()
    return report

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--url',required=True)
    ap.add_argument('--out',required=True)
    ap.add_argument('--cpu',type=int,choices=range(1,9),default=1)
    ap.add_argument('--device',choices=['both','desktop','mobile'],default='both')
    args=ap.parse_args(); out=Path(args.out)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, channel='chrome')
        desktop=run_once(browser,args.url,out/"desktop",False,args.cpu) if args.device != "mobile" else {"failures":[],"skipped":True}
        mobile=run_once(browser,args.url,out/"mobile",True,args.cpu) if args.device != "desktop" else {"failures":[],"skipped":True}
        browser.close()
    combined={"target":args.url,"desktop":desktop,"mobile":mobile,"failures":sorted(set(desktop['failures']+mobile['failures']))}
    (out/"summary.json").write_text(json.dumps(combined,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({
        "target":args.url,
        "desktop":{"initial_status":desktop.get('initial_status'),"final_url":desktop.get('final_url'),"title":desktop.get('title'),"astro":desktop.get('astro_islands'),"pending":desktop.get('pending_astro_islands'),"interaction_ok":desktop.get('interaction_ok'),"failures":desktop.get('failures')},
        "mobile":{"initial_status":mobile.get('initial_status'),"final_url":mobile.get('final_url'),"title":mobile.get('title'),"overflow":mobile.get('horizontal_overflow'),"failures":mobile.get('failures')},
        "verdict":"PASS" if not combined['failures'] else "FAIL",
        "failures":combined['failures']
    },ensure_ascii=False,indent=2))
    return 0 if not combined['failures'] else 1

if __name__=='__main__': sys.exit(main())
