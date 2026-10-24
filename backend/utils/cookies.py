"""Cookie normalisation utilities (stdlib only, easily unit-tested)."""

import json
import re


def normalize_to_netscape(raw_content: str) -> str:
    """Cleans raw cookie input, strips UTF BOMs and null bytes, and auto-converts
    JSON cookies, HTTP Cookie headers, or misaligned columns to valid Netscape format for yt-dlp.
    """
    if not raw_content:
        return ""

    text = (
        raw_content.replace("\ufeff", "")
        .replace("\ufffe", "")
        .replace("\x00", "")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .strip()
    )

    if not text:
        return ""

    # 1. Check for JSON format (Cookie-Editor, EditThisCookie, etc.)
    if text.startswith("[") or text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict) and "cookies" in parsed and isinstance(parsed["cookies"], list):
                parsed = parsed["cookies"]
            elif isinstance(parsed, dict):
                parsed = [parsed]
            if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
                lines = [
                    "# Netscape HTTP Cookie File",
                    "# http://curl.haxx.se/rfc/cookie_spec.html",
                    "# Converted automatically from JSON format by CheatClip Pro",
                    "",
                ]
                count = 0
                for item in parsed:
                    domain = str(item.get("domain") or item.get("host") or "").strip()
                    if not domain:
                        domain = ".youtube.com"
                    flag = "TRUE" if domain.startswith(".") else "FALSE"
                    path = str(item.get("path") or "/").strip()
                    secure = "TRUE" if item.get("secure") else "FALSE"
                    exp = item.get("expirationDate") or item.get("expires") or item.get("expiry") or 0
                    try:
                        exp_int = int(float(exp))
                    except Exception:
                        exp_int = 0
                    if exp_int <= 0:
                        exp_int = 2147483647

                    name = str(item.get("name") or "").strip()
                    val = str(item.get("value") or "").strip()
                    if name:
                        lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{exp_int}\t{name}\t{val}")
                        count += 1

                if count > 0:
                    return "\n".join(lines) + "\n"
        except Exception:
            pass

    # 2. Check for HTTP Cookie header format (e.g. from browser DevTools Network tab or curl: "Cookie: SID=...; HSID=...")
    clean_header = text
    if clean_header.lower().startswith("cookie:"):
        clean_header = clean_header[7:].strip()
    if ";" in clean_header and "=" in clean_header and "\t" not in clean_header:
        pairs = clean_header.split(";")
        header_lines = [
            "# Netscape HTTP Cookie File",
            "# http://curl.haxx.se/rfc/cookie_spec.html",
            "# Converted automatically from HTTP Cookie header by CheatClip Pro",
            "",
        ]
        cookie_count = 0
        for pair in pairs:
            pair = pair.strip()
            if not pair or "=" not in pair:
                continue
            k, v = pair.split("=", 1)
            name = k.strip()
            val = v.strip()
            if name:
                header_lines.append(f".youtube.com\tTRUE\t/\tTRUE\t2147483647\t{name}\t{val}")
                cookie_count += 1
        if cookie_count > 0:
            return "\n".join(header_lines) + "\n"

    # 3. Handle standard Netscape text and space-to-tab repair
    lines = text.split("\n")
    cleaned_lines = []
    has_header = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if "# Netscape HTTP Cookie File" in stripped:
            has_header = True
            cleaned_lines.append(stripped)
            continue
        if stripped.startswith("#") and not stripped.startswith("#HttpOnly_"):
            cleaned_lines.append(stripped)
            continue

        # If line has spaces instead of tabs, convert 2+ spaces to tabs
        if "\t" not in stripped:
            parts = re.split(r'\s{2,}|\t', stripped)
            if len(parts) >= 6:
                stripped = "\t".join(parts)

        cleaned_lines.append(stripped)

    if not has_header:
        cleaned_lines.insert(0, "# Netscape HTTP Cookie File")
        cleaned_lines.insert(1, "# http://curl.haxx.se/rfc/cookie_spec.html")
        cleaned_lines.insert(2, "")

    return "\n".join(cleaned_lines) + "\n"
