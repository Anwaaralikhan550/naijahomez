import json
import re
import time
from pathlib import Path
from typing import Dict, List

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

BASE = "https://studee.akhee.ai"
OUT_DIR = Path("E:/naijahomz/naija/studee_outputs")
OUT_DIR.mkdir(parents=True, exist_ok=True)

ACCOUNTS = {
    "admin": {"email": "admin@studee.test", "password": "Admin@12345", "prefixes": ["/admin"], "extras": ["/", "/ai-search", "/themes"]},
    "teacher_alice": {"email": "teacher.alice@studee.test", "password": "Teacher@12345", "prefixes": ["/teacher"], "extras": ["/", "/ai-search", "/themes"]},
    "teacher_bob": {"email": "teacher.bob@studee.test", "password": "Teacher@12345", "prefixes": ["/teacher"], "extras": ["/", "/ai-search", "/themes"]},
    "student_one": {"email": "student.one@studee.test", "password": "Student@12345", "prefixes": ["/student", "/live-quiz"], "extras": ["/", "/ai-search", "/themes"]},
    "student_two": {"email": "student.two@studee.test", "password": "Student@12345", "prefixes": ["/student", "/live-quiz"], "extras": ["/", "/ai-search", "/themes"]},
    "student_three": {"email": "student.three@studee.test", "password": "Student@12345", "prefixes": ["/student", "/live-quiz"], "extras": ["/", "/ai-search", "/themes"]},
}

FEATURE_KEYWORDS = [
    "assistant", "generator", "analyzer", "translator", "explainer", "coach", "chat",
    "quiz", "assessment", "lesson", "module", "material", "class", "progress", "result",
    "vocabulary", "ar-", "notes", "submissions", "resources", "analytics", "moderation"
]

def parse_routes_from_manifest(manifest_text: str) -> List[str]:
    m = re.search(r"sortedPages:\[(.*?)\]}}\(", manifest_text, flags=re.S)
    if not m:
        raise RuntimeError("Could not parse sortedPages from manifest")
    raw = m.group(1)
    routes = re.findall(r'"([^"]+)"', raw)
    out = []
    for r in routes:
        if r == "/_app":
            continue
        r = (
            r.replace("[token]", "demo")
             .replace("[id]", "1")
             .replace("[classId]", "1")
             .replace("[materialId]", "1")
             .replace("[moduleId]", "1")
             .replace("[sessionId]", "1")
             .replace("[teacherId]", "1")
        )
        out.append(r)
    return sorted(set(out))


def select_routes(all_routes: List[str], prefixes: List[str], extras: List[str]) -> List[str]:
    picked = set(extras)
    for r in all_routes:
        if any(r.startswith(p) for p in prefixes):
            picked.add(r)
    return sorted(picked)


def short_text(s: str, n: int = 240) -> str:
    s = re.sub(r"\s+", " ", (s or "")).strip()
    return s[:n]


def capture_page_snapshot(page, route: str, role: str) -> Dict:
    response = None
    status = None
    nav_error = None
    try:
        response = page.goto(BASE + route, wait_until="domcontentloaded", timeout=45000)
        status = response.status if response else None
    except Exception as e:
        nav_error = str(e)

    try:
        page.wait_for_timeout(1200)
    except Exception:
        pass

    title = ""
    try:
        title = page.title()
    except Exception:
        pass

    h1s, h2s, h3s, btns = [], [], [], []
    body_excerpt = ""
    try:
        h1s = page.locator("h1").all_inner_texts()[:5]
        h2s = page.locator("h2").all_inner_texts()[:8]
        h3s = page.locator("h3").all_inner_texts()[:8]
        btns = page.locator("button").all_inner_texts()[:12]
        body_excerpt = short_text(page.inner_text("body"), 420)
    except Exception:
        pass

    screenshot_path = OUT_DIR / f"{role}_{route.strip('/').replace('/','_') or 'home'}.png"
    try:
        page.screenshot(path=str(screenshot_path), full_page=True)
    except Exception:
        screenshot_path = None

    return {
        "route": route,
        "status": status,
        "url": page.url,
        "title": title,
        "h1": [short_text(x, 120) for x in h1s if short_text(x)],
        "h2": [short_text(x, 120) for x in h2s if short_text(x)],
        "h3": [short_text(x, 120) for x in h3s if short_text(x)],
        "buttons": [short_text(x, 80) for x in btns if short_text(x)],
        "body_excerpt": body_excerpt,
        "nav_error": nav_error,
        "screenshot": str(screenshot_path) if screenshot_path else None,
    }


def login(page, email: str, password: str) -> Dict:
    result = {"ok": False, "message": "", "url": ""}
    page.goto(BASE + "/login", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(1000)

    email_selectors = [
        "input[type='email']",
        "input[name='email']",
        "input[placeholder*='Email' i]",
    ]
    pass_selectors = [
        "input[type='password']",
        "input[name='password']",
        "input[placeholder*='Password' i]",
    ]

    filled_email = False
    for sel in email_selectors:
        loc = page.locator(sel)
        if loc.count() > 0:
            loc.first.fill(email)
            filled_email = True
            break

    filled_pass = False
    for sel in pass_selectors:
        loc = page.locator(sel)
        if loc.count() > 0:
            loc.first.fill(password)
            filled_pass = True
            break

    if not (filled_email and filled_pass):
        result["message"] = "Login form fields not found"
        result["url"] = page.url
        return result

    candidates = [
        "button:has-text('Login')",
        "button:has-text('Log In')",
        "button:has-text('Sign In')",
        "button[type='submit']",
        "text=Login",
    ]

    clicked = False
    for c in candidates:
        loc = page.locator(c)
        if loc.count() > 0:
            try:
                loc.first.click(timeout=5000)
                clicked = True
                break
            except Exception:
                continue

    if not clicked:
        page.keyboard.press("Enter")

    page.wait_for_timeout(3000)
    for _ in range(12):
        url = page.url
        if "/login" not in url:
            break
        page.wait_for_timeout(1000)

    result["url"] = page.url

    err_text = ""
    try:
        err_text = short_text(page.inner_text("body"), 300)
    except Exception:
        pass

    if "/login" not in page.url:
        result["ok"] = True
        result["message"] = "Login successful"
    else:
        result["ok"] = False
        result["message"] = f"Stayed on login page. Body: {err_text}"

    return result


def run() -> None:
    manifest_js = __import__("requests").get(BASE + "/_next/static/DcEdUWMe2c7BR7n305G3b/_buildManifest.js", timeout=30).text
    all_routes = parse_routes_from_manifest(manifest_js)

    master = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "base": BASE,
        "route_count": len(all_routes),
        "accounts": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for role, cfg in ACCOUNTS.items():
            context = browser.new_context(ignore_https_errors=True)
            page = context.new_page()
            login_result = login(page, cfg["email"], cfg["password"])
            role_data = {
                "email": cfg["email"],
                "login": login_result,
                "pages": [],
                "feature_pages": [],
            }

            if login_result["ok"]:
                targets = select_routes(all_routes, cfg["prefixes"], cfg["extras"])
                for rt in targets:
                    snap = capture_page_snapshot(page, rt, role)
                    role_data["pages"].append(snap)
                    if any(k in rt for k in FEATURE_KEYWORDS):
                        role_data["feature_pages"].append(snap)
            else:
                # still capture login page for evidence
                role_data["pages"].append(capture_page_snapshot(page, "/login", role))

            master["accounts"][role] = role_data
            context.close()

        browser.close()

    json_path = OUT_DIR / "studee_full_role_exploration.json"
    json_path.write_text(json.dumps(master, indent=2, ensure_ascii=False), encoding="utf-8")

    md_lines = [
        "# STUDEE Authenticated Feature Exploration",
        "",
        f"Generated: {master['timestamp']}",
        f"Base: {BASE}",
        f"Total discovered routes in manifest: {master['route_count']}",
        "",
    ]

    for role, data in master["accounts"].items():
        md_lines.append(f"## {role}")
        md_lines.append(f"- Email: {data['email']}")
        md_lines.append(f"- Login: {'PASS' if data['login']['ok'] else 'FAIL'}")
        md_lines.append(f"- Login URL after submit: {data['login'].get('url','')}")
        md_lines.append(f"- Login note: {data['login'].get('message','')}")

        pages = data["feature_pages"] if data["feature_pages"] else data["pages"]
        md_lines.append(f"- Feature pages captured: {len(pages)}")

        for pinfo in pages:
            label = pinfo["route"]
            h = pinfo["h1"][0] if pinfo["h1"] else (pinfo["h2"][0] if pinfo["h2"] else "(no heading)")
            md_lines.append(f"  - `{label}` | status={pinfo['status']} | url={pinfo['url']}")
            md_lines.append(f"    Output sample: {h}")
            if pinfo.get("buttons"):
                md_lines.append(f"    Buttons: {', '.join(pinfo['buttons'][:5])}")

        md_lines.append("")

    md_path = OUT_DIR / "studee_full_role_exploration.md"
    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    print(f"JSON: {json_path}")
    print(f"MD: {md_path}")


if __name__ == "__main__":
    run()
