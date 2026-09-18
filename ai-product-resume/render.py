from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


def launch_browser(p):
    executable = os.environ.get("CHROMIUM_PATH")
    kwargs = {"headless": True, "args": ["--no-sandbox"]}
    if executable:
        kwargs["executable_path"] = executable
    return p.chromium.launch(**kwargs)


def build(source: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    html = source.read_text(encoding="utf-8")
    errors: list[str] = []

    with sync_playwright() as p:
        browser = launch_browser(p)
        page = browser.new_page(viewport={"width": 1440, "height": 1800}, device_scale_factor=1)
        page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"pageerror:{err}"))
        page.set_content(html, wait_until="load")

        metrics = page.evaluate(
            """() => {
              const r = document.querySelector('.resume').getBoundingClientRect();
              return {
                resume: {w:r.width,h:r.height,top:r.top,bottom:r.bottom},
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
                horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                hasMirrorEye: document.body.innerText.includes('镜瞳'),
                hasWrongName: document.body.innerText.includes('劲通')
              };
            }"""
        )
        if metrics["horizontalOverflow"]:
            raise RuntimeError(f"desktop horizontal overflow: {metrics}")
        if not metrics["hasMirrorEye"] or metrics["hasWrongName"]:
            raise RuntimeError(f"company-name check failed: {metrics}")
        if errors:
            raise RuntimeError(f"browser errors: {errors}")

        page.locator(".resume").screenshot(path=str(out_dir / "snapshot.png"))

        page.emulate_media(media="print")
        page.pdf(
            path=str(out_dir / "Liu_Shiyu_AI_Product_Resume_CN.pdf"),
            format="A4",
            print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            prefer_css_page_size=True,
        )

        page.emulate_media(media="screen")
        page.set_viewport_size({"width": 390, "height": 844})
        page.set_content(html, wait_until="load")
        mobile = page.evaluate(
            """() => ({
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              toolbar: !!document.querySelector('.toolbar'),
              resume: !!document.querySelector('.resume')
            })"""
        )
        page.screenshot(path=str(out_dir / "snapshot-mobile.png"), full_page=True)

        (out_dir / "build-report.json").write_text(
            json.dumps({"desktop": metrics, "mobile": mobile, "errors": errors}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        browser.close()


def verify_live(url: str, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    pdf_url = urljoin(url, "Liu_Shiyu_AI_Product_Resume_CN.pdf")
    snapshot_url = urljoin(url, "snapshot.png")

    with sync_playwright() as p:
        browser = launch_browser(p)
        page = browser.new_page(viewport={"width": 1440, "height": 1800})
        page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"pageerror:{err}"))

        last_error = None
        for _ in range(12):
            try:
                response = page.goto(url, wait_until="networkidle", timeout=30000)
                if response and response.ok:
                    last_error = None
                    break
                last_error = f"status={response.status if response else 'none'}"
            except Exception as exc:
                last_error = str(exc)
            time.sleep(5)
        if last_error:
            raise RuntimeError(f"live page unavailable after retries: {last_error}")

        checks = page.evaluate(
            """() => ({
              title: document.title,
              hasName: document.body.innerText.includes('刘师宇'),
              hasMirrorEye: document.body.innerText.includes('镜瞳'),
              hasWrongName: document.body.innerText.includes('劲通'),
              hasPdfButton: [...document.querySelectorAll('a')].some(a => a.textContent.includes('PDF')),
              horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
            })"""
        )
        if not all([checks["hasName"], checks["hasMirrorEye"], checks["hasPdfButton"]]):
            raise RuntimeError(f"required content missing: {checks}")
        if checks["hasWrongName"] or checks["horizontalOverflow"]:
            raise RuntimeError(f"content/layout regression: {checks}")
        if errors:
            raise RuntimeError(f"browser errors: {errors}")

        pdf = page.request.get(pdf_url)
        snap = page.request.get(snapshot_url)
        if not pdf.ok:
            raise RuntimeError(f"PDF request failed: {pdf.status}")
        if not snap.ok:
            raise RuntimeError(f"snapshot request failed: {snap.status}")
        if len(pdf.body()) < 50000:
            raise RuntimeError(f"PDF too small: {len(pdf.body())} bytes")
        if len(snap.body()) < 10000:
            raise RuntimeError(f"snapshot too small: {len(snap.body())} bytes")

        page.screenshot(path=str(out_dir / "live-desktop.png"), full_page=True)
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(url, wait_until="networkidle")
        mobile_checks = page.evaluate(
            """() => {
              const resume = document.querySelector('.resume').getBoundingClientRect();
              const content = getComputedStyle(document.querySelector('.content'));
              const sidebar = getComputedStyle(document.querySelector('.sidebar'));
              return {
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
                resumeWidth: resume.width,
                gridColumns: content.gridTemplateColumns,
                sidebarBorderLeft: sidebar.borderLeftWidth,
                hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
              };
            }"""
        )
        if mobile_checks["hasHorizontalOverflow"] or mobile_checks["resumeWidth"] > 390:
            raise RuntimeError(f"mobile layout overflow: {mobile_checks}")
        if mobile_checks["sidebarBorderLeft"] != "0px":
            raise RuntimeError(f"mobile sidebar did not collapse: {mobile_checks}")
        page.screenshot(path=str(out_dir / "live-mobile.png"), full_page=True)

        report = {
            "url": url,
            "pdf_url": pdf_url,
            "snapshot_url": snapshot_url,
            "checks": checks,
            "pdf_status": pdf.status,
            "pdf_bytes": len(pdf.body()),
            "snapshot_status": snap.status,
            "snapshot_bytes": len(snap.body()),
            "mobile_checks": mobile_checks,
            "errors": errors,
        }
        (out_dir / "live-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        browser.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    b = sub.add_parser("build")
    b.add_argument("--source", required=True)
    b.add_argument("--out", required=True)

    v = sub.add_parser("verify")
    v.add_argument("--url", required=True)
    v.add_argument("--out", required=True)

    args = parser.parse_args()
    if args.command == "build":
        build(Path(args.source), Path(args.out))
    else:
        verify_live(args.url, Path(args.out))


if __name__ == "__main__":
    main()
