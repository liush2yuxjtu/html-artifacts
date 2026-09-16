#!/usr/bin/env python3
"""Browser acceptance for the ChatCut GitHub Pages surface.

Pattern follows anthropics/skills:webapp-testing:
- navigate the running app
- wait for rendered/network state
- capture screenshots + browser failures
- discover stable selectors from the rendered page
- exercise the real scroll/hydration journey and one visible interaction

The same script runs against the real public Pages URL and a local server mounted
at the exact `/chatcut-playable/` subpath so a fix can be proven before merge.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

TARGET = os.environ.get(
    "CHATCUT_PAGES_URL",
    "https://liush2yuxjtu.github.io/html-artifacts/chatcut-playable/?utm_source=chatgpt.com",
)
EXPECTED_HOST = os.environ.get("CHATCUT_EXPECTED_HOST", "liush2yuxjtu.github.io")
OUT = Path(os.environ.get("CHATCUT_E2E_OUT", "chatcut-pages-e2e"))
OUT.mkdir(parents=True, exist_ok=True)


def visible(locator) -> bool:
    try:
        return locator.count() > 0 and locator.first.is_visible()
    except Exception:
        return False


def scroll_hydration_journey(page) -> list[dict[str, object]]:
    """Scroll the actual page so Astro `client:visible` islands get a chance to hydrate."""
    steps: list[dict[str, object]] = []
    selectors = [
        "#best-moments",
        "#motion-graphics",
        "#transcript-captions",
        "#image-to-video",
        "#music-generation",
        "#pricing",
        "footer",
    ]
    for selector in selectors:
        locator = page.locator(selector).first
        if locator.count() == 0:
            steps.append({"selector": selector, "exists": False})
            continue
        try:
            locator.scroll_into_view_if_needed(timeout=10_000)
        except Exception:
            page.evaluate("sel => document.querySelector(sel)?.scrollIntoView({block:'center'})", selector)
        page.wait_for_timeout(850)
        steps.append(
            {
                "selector": selector,
                "exists": True,
                "pending": locator.evaluate("el => Boolean(el.closest('astro-island[ssr]') || el.querySelector('astro-island[ssr]'))"),
            }
        )
    page.evaluate("() => window.scrollTo({top:0, behavior:'instant'})")
    page.wait_for_timeout(600)
    return steps


def main() -> int:
    report: dict[str, object] = {
        "target": TARGET,
        "expected_host": EXPECTED_HOST,
        "failures": [],
        "console_errors": [],
        "page_errors": [],
        "request_failures": [],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            device_scale_factor=1,
            ignore_https_errors=False,
        )
        page = context.new_page()

        page.on(
            "console",
            lambda msg: report["console_errors"].append(msg.text)
            if msg.type == "error"
            else None,
        )
        page.on("pageerror", lambda err: report["page_errors"].append(str(err)))
        page.on(
            "requestfailed",
            lambda req: report["request_failures"].append(
                {
                    "url": req.url,
                    "error": req.failure or "request failed",
                    "resource_type": req.resource_type,
                }
            ),
        )

        response = page.goto(TARGET, wait_until="domcontentloaded", timeout=60_000)
        report["http_status"] = response.status if response else None
        report["final_url"] = page.url

        try:
            page.wait_for_load_state("networkidle", timeout=20_000)
            report["networkidle"] = True
        except PlaywrightTimeoutError:
            report["networkidle"] = False

        page.wait_for_timeout(1_200)
        report["scroll_journey"] = scroll_hydration_journey(page)

        report["title"] = page.title()
        report["h1"] = page.locator("h1").first.inner_text().strip() if page.locator("h1").count() else ""
        report["playable_version"] = page.evaluate(
            "() => document.documentElement.dataset.ccPlayableVersion || null"
        )
        report["pending_astro_islands"] = page.locator("astro-island[ssr]").count()
        report["astro_islands"] = page.locator("astro-island").count()
        report["local_send_count"] = page.locator(".cc-local-send").count()
        report["status_count"] = page.locator("[data-cc-status]").count()
        report["expert_send_visible"] = visible(page.locator("#best-moments .cc-expert-send"))
        report["motion_generate_visible"] = visible(page.locator("#motion-graphics [aria-label='Generate']"))
        report["image_generate_visible"] = visible(
            page.locator("#image-to-video .itv-story:not(.itv-story-video) [aria-label='Generate']")
        )
        report["video_generate_visible"] = visible(
            page.locator("#image-to-video .itv-story-video [aria-label='Generate']")
        )
        report["music_send_visible"] = visible(page.locator("#music-generation .cc-music-send"))

        report["resolved_runtime_urls"] = page.evaluate(
            """() => Array.from(document.querySelectorAll('astro-island')).slice(0, 12).map(x => ({
              component: x.getAttribute('component-url'),
              renderer: x.getAttribute('renderer-url'),
              ssr: x.hasAttribute('ssr')
            }))"""
        )

        page.screenshot(path=str(OUT / "desktop-before.png"), full_page=True, animations="disabled")

        interaction_ok = False
        interaction_status = None
        expert_send = page.locator("#best-moments .cc-expert-send")
        if visible(expert_send):
            expert_send.first.click()
            try:
                page.wait_for_function(
                    "() => document.querySelector('#best-moments [data-cc-status=\"expert\"]')?.textContent.trim() === 'Done · first cut updated'",
                    timeout=10_000,
                )
                interaction_ok = True
            except PlaywrightTimeoutError:
                interaction_ok = False
            status = page.locator("#best-moments [data-cc-status='expert']")
            interaction_status = status.first.inner_text().strip() if status.count() else None
            page.screenshot(path=str(OUT / "desktop-after.png"), full_page=True, animations="disabled")
        report["interaction_ok"] = interaction_ok
        report["interaction_status"] = interaction_status

        mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        mobile = mobile_context.new_page()
        mobile_response = mobile.goto(TARGET, wait_until="domcontentloaded", timeout=60_000)
        try:
            mobile.wait_for_load_state("networkidle", timeout=20_000)
        except PlaywrightTimeoutError:
            pass
        mobile.wait_for_timeout(1_200)
        scroll_hydration_journey(mobile)
        mobile.screenshot(path=str(OUT / "mobile.png"), full_page=True, animations="disabled")
        report["mobile_status"] = mobile_response.status if mobile_response else None
        report["mobile_overflow"] = mobile.evaluate(
            "() => document.documentElement.scrollWidth > window.innerWidth + 1"
        )
        if report["mobile_overflow"]:
            report["mobile_overflow_elements"] = mobile.evaluate(
                """() => Array.from(document.querySelectorAll('body *')).map(el => {
                  const r = el.getBoundingClientRect();
                  return {tag:el.tagName, id:el.id, cls:String(el.className || '').slice(0,120), left:r.left, right:r.right, width:r.width};
                }).filter(x => x.right > window.innerWidth + 1 || x.left < -1).slice(0,30)"""
            )
        mobile_context.close()

        failures: list[str] = report["failures"]  # type: ignore[assignment]
        if report["http_status"] != 200:
            failures.append(f"http-status:{report['http_status']}")
        if urlparse(str(report["final_url"])).hostname != EXPECTED_HOST:
            failures.append("unexpected-final-host")
        if not report["h1"]:
            failures.append("missing-visible-h1")
        if report["playable_version"] != "2":
            failures.append("playable-patch-not-booted")
        if int(report["pending_astro_islands"] or 0) > 0:
            failures.append("astro-islands-still-pending-after-scroll")
        if int(report["local_send_count"] or 0) == 0:
            failures.append("no-playable-controls")
        if not bool(report["expert_send_visible"]):
            failures.append("expert-demo-control-not-visible")
        if not interaction_ok:
            failures.append("expert-demo-interaction-failed")
        if bool(report["mobile_overflow"]):
            failures.append("mobile-horizontal-overflow")
        if report["page_errors"]:
            failures.append("page-errors")

        (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        context.close()
        browser.close()

    return 1 if report["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
