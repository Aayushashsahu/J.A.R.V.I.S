"""Render docs/architecture/architecture.svg -> docs/architecture/architecture.png.

Why this exists:
  The SVG is the source-of-truth, but GitHub renders SVGs at varying resolutions
  and submitting teams need a stable PNG. We use Microsoft Edge headless (same
  pattern as SPRINT_PLAN_build.py) so we don't introduce a new toolchain.

Usage:
    python docs/architecture/build_architecture.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SVG_PATH = HERE / "architecture.svg"
PNG_PATH = HERE / "architecture.png"
HTML_WRAP_PATH = HERE / "_render.html"

# Tailored to the SVG canvas (1400x1900). The screenshot is taken at 2x DPR for
# sharpness when reviewers zoom in.
HTML_WRAP = r"""<!doctype html>
<html><head><meta charset="utf-8">
<title>J.A.R.V.I.S Architecture</title>
<style>
  html, body { margin:0; padding:0; background:#fafbfc; }
  /* Center the SVG and let the viewBox drive intrinsic size */
  svg { display:block; }
</style>
</head><body>
__SVG__
</body</html>
"""


def find_edge() -> str | None:
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    return shutil.which("msedge") or shutil.which("msedge.exe")


def main() -> int:
    if not SVG_PATH.exists():
        print(f"[error] missing {SVG_PATH}", file=sys.stderr)
        return 2

    edge = find_edge()
    if not edge:
        print("[error] Microsoft Edge not found (needed for SVG -> PNG)", file=sys.stderr)
        return 3

    svg_text = SVG_PATH.read_text(encoding="utf-8")
    # Strip XML decl so it embeds cleanly inside HTML body
    if svg_text.lstrip().startswith("<?xml"):
        svg_text = svg_text.split("?>", 1)[1].lstrip()

    HTML_WRAP_PATH.write_text(HTML_WRAP.replace("__SVG__", svg_text), encoding="utf-8")

    url = "file:///" + str(HTML_WRAP_PATH).replace("\\", "/")
    # Window size matches the SVG canvas; --hide-scrollbars keeps edges clean.
    cmd = [
        edge,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        f"--window-size=1400,1900",
        f"--screenshot={PNG_PATH}",
        url,
    ]
    print("[render] " + " ".join(cmd[:3]) + " ...")
    subprocess.run(cmd, check=True, timeout=120)

    size_kb = PNG_PATH.stat().st_size / 1024 if PNG_PATH.exists() else 0
    print(f"[png]    wrote {PNG_PATH} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
