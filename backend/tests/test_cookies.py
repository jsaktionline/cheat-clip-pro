"""Unit tests for cookie normalisation (backend.utils.cookies)."""

from __future__ import annotations

import json

import pytest

from backend.utils.cookies import normalize_to_netscape


class TestJsonInput:
    def test_converts_cookie_editor_json(self):
        raw = json.dumps(
            [
                {
                    "domain": ".youtube.com",
                    "path": "/",
                    "secure": True,
                    "expirationDate": 1_900_000_000,
                    "name": "SID",
                    "value": "abc123",
                }
            ]
        )
        result = normalize_to_netscape(raw)
        assert result.startswith("# Netscape HTTP Cookie File")
        assert ".youtube.com\tTRUE\t/\tTRUE\t1900000000\tSID\tabc123" in result

    def test_accepts_wrapped_cookies_object(self):
        raw = json.dumps({"cookies": [{"domain": "youtube.com", "name": "HSID", "value": "xyz"}]})
        result = normalize_to_netscape(raw)
        # Non-dot domains are session cookies; expiry defaults to the max value.
        assert "youtube.com\tFALSE\t/\tFALSE\t2147483647\tHSID\txyz" in result

    def test_skips_entries_without_name(self):
        raw = json.dumps([{"domain": ".youtube.com", "value": "orphan"}])
        # Falls through to the plain-text path, which still yields a valid header.
        assert normalize_to_netscape(raw).startswith("# Netscape HTTP Cookie File")


class TestCookieHeaderInput:
    def test_converts_devtools_cookie_header(self):
        result = normalize_to_netscape("Cookie: SID=abc; HSID=def; VISITOR_INFO1_LIVE=ghi")
        assert ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tabc" in result
        assert ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tHSID\tdef" in result

    def test_header_without_prefix_also_works(self):
        result = normalize_to_netscape("SID=abc; HSID=def")
        assert "SID\tabc" in result


class TestNetscapeInput:
    def test_preserves_existing_header_once(self):
        raw = (
            "# Netscape HTTP Cookie File\n"
            ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tabc\n"
        )
        result = normalize_to_netscape(raw)
        assert result.count("# Netscape HTTP Cookie File") == 1
        assert ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tabc" in result

    def test_repairs_space_separated_columns(self):
        raw = "youtube.com  TRUE  /  TRUE  2147483647  SID  abc"
        result = normalize_to_netscape(raw)
        assert "youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tabc" in result

    def test_normalises_bom_and_nul_bytes(self):
        raw = "\ufeff.youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tabc\x00"
        result = normalize_to_netscape(raw)
        assert "\ufeff" not in result
        assert "\x00" not in result
        assert "SID\tabc" in result


class TestEmptyInput:
    @pytest.mark.parametrize("raw", ["", "   ", "\n\n", None])
    def test_returns_empty_string(self, raw):
        assert normalize_to_netscape(raw) == ""
