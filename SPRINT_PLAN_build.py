"""Convert SPRINT_PLAN.md -> PDF (Edge headless) + DOCX (python-docx) + styled HTML."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import markdown
from docx import Document
from docx.shared import Pt, Inches, RGBColor

HERE = Path(__file__).resolve().parent
SRC = HERE / "SPRINT_PLAN.md"
HTML_OUT = HERE / "SPRINT_PLAN.html"
PDF_OUT = HERE / "SPRINT_PLAN.pdf"
DOCX_OUT = HERE / "SPRINT_PLAN.docx"

STYLE_CSS = (
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
    "line-height:1.55;color:#1a1a1a;max-width:880px;margin:32px auto;padding:0 24px 80px;background:#fff}"
    "h1{font-size:1.9rem;border-bottom:3px solid #0f172a;padding-bottom:8px;margin-top:1.6em}"
    "h2{font-size:1.45rem;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-top:2em;color:#0f172a}"
    "h3{font-size:1.2rem;margin-top:1.6em;color:#1f2937}"
    "h4{font-size:1.05rem;margin-top:1.4em;color:#1f2937}"
    "blockquote{border-left:4px solid #2563eb;background:#eff6ff;margin:1em 0;padding:10px 16px;color:#1e3a8a}"
    "table{border-collapse:collapse;width:100%;margin:1em 0;font-size:0.92rem}"
    "th,td{border:1px solid #d1d5db;padding:8px 12px;text-align:left;vertical-align:top}"
    "th{background:#f9fafb}"
    "tr:nth-child(even)td{background:#f3f4f6}"
    "code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:0.9em}"
    "pre{background:#0f172a;color:#f1f5f9;padding:16px;border-radius:6px;overflow-x:auto;"
    "font-size:0.85rem;line-height:1.45}"
    "pre code{background:transparent;padding:0;color:inherit}"
    "ul,ol{padding-left:1.5em}li{margin:4px 0}"
    "hr{border:0;border-top:1px solid #e5e7eb;margin:2em 0}"
)


def md_to_html(md_text: str) -> str:
    body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists", "toc"],
    )
    LT = chr(0x3C)
    close_style = LT + "/style" + chr(0x3E)
    close_head = LT + "/head" + chr(0x3E)
    open_body = LT + "body" + chr(0x3E)
    close_body = LT + "/body" + chr(0x3E)
    close_html = LT + "/html" + chr(0x3E)
    head = (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<title>J.A.R.V.I.S Sprint Plan</title>"
        + LT + "style" + chr(0x3E) + STYLE_CSS + close_style + close_head + open_body
    )
    tail = close_body + close_html
    return head + body + tail


def html_to_pdf_edge(html_path: Path, pdf_path: Path) -> None:
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    edge = next((c for c in candidates if Path(c).exists()), None)
    if not edge:
        edge = shutil.which("msedge") or shutil.which("msedge.exe")
    if not edge or not Path(edge).exists():
        raise RuntimeError("Microsoft Edge not found")

    url = "file:///" + str(html_path).replace("\\", "/")
    cmd = [
        edge,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        "--print-to-pdf=" + str(pdf_path),
        url,
    ]
    subprocess.run(cmd, check=True, timeout=180)


def md_text_to_docx(md_text: str, out_path: Path) -> None:
    """Light-weight MD -> DOCX. Tables become compact 'Col | Col' lines."""
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    in_code = False
    code_buf: list[str] = []

    def flush_code():
        nonlocal code_buf
        if not code_buf:
            return
        joined = "\n".join(code_buf)
        p = doc.add_paragraph()
        run = p.add_run(joined)
        run.font.name = "Consolas"
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x10, 0x10, 0x10)
        p.paragraph_format.left_indent = Inches(0.25)
        code_buf = []

    for raw_line in md_text.splitlines():
        line = raw_line.rstrip()

        if line.startswith("```"):
            if in_code:
                in_code = False
                flush_code()
            else:
                in_code = True
            continue
        if in_code:
            code_buf.append(line)
            continue

        if line.startswith("### "):
            doc.add_heading(line[4:], level=3)
        elif line.startswith("## "):
            doc.add_heading(line[3:], level=2)
        elif line.startswith("# "):
            doc.add_heading(line[2:], level=1)
        elif line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(set(c) <= set("-: ") for c in cells if c):
                continue
            doc.add_paragraph("  -  " + " | ".join(cells), style="List Bullet")
        elif line.startswith("> "):
            p = doc.add_paragraph(line[2:])
            p.paragraph_format.left_indent = Inches(0.3)
            for run in p.runs:
                run.italic = True
        elif line.startswith("- "):
            doc.add_paragraph(line[2:], style="List Bullet")
        elif line and line[0].isdigit() and ". " in line[:4]:
            doc.add_paragraph(line.split(". ", 1)[1], style="List Number")
        elif line.startswith("- [ ]") or line.startswith("- [x]"):
            mark = "[ ]" if "[ ]" in line else "[x]"
            doc.add_paragraph(mark + "  " + line[5:].strip(), style="List Bullet")
        elif line.strip() == "---":
            doc.add_paragraph("_" * 60)
        elif line.strip() == "":
            doc.add_paragraph("")
        else:
            doc.add_paragraph(line)

    flush_code()
    doc.save(str(out_path))


def main():
    md = SRC.read_text(encoding="utf-8")
    print(f"[md]   read {SRC} ({len(md)} chars)")

    html = md_to_html(md)
    HTML_OUT.write_text(html, encoding="utf-8")
    print(f"[html] wrote {HTML_OUT}")

    md_text_to_docx(md, DOCX_OUT)
    print(f"[docx] wrote {DOCX_OUT}")

    try:
        html_to_pdf_edge(HTML_OUT, PDF_OUT)
        size = PDF_OUT.stat().st_size if PDF_OUT.exists() else 0
        print(f"[pdf]  wrote {PDF_OUT} ({size/1024:.1f} KB)")
    except Exception as exc:
        print(f"[pdf]  FAILED: {exc}")
        sys.exit(2)


if __name__ == "__main__":
    main()
