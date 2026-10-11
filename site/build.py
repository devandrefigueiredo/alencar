"""Builds the static site into _site/ (what GitHub Pages publishes).

Usage (from the repository root):
    python site/build.py            # writes _site/
    python -m http.server -d _site  # local preview at http://localhost:8000

The site is for AI agents. Its home page is agent/AGENTS.md rendered as static HTML (no script,
so text-only fetchers can read it), next to the plain /agents.md and /llms.txt. It also publishes
the reference books (raw files + README.md manifest + zip) that agents must follow, the checker
tool, a zip of the new-book template, and the viewer the author uses to preview and print.
Python standard library only.
"""
import hashlib
import html
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = ROOT / "_site"
SAMPLES = ["the-art-of-lorem-ipsum-en"]
CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
       "object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'")


# ---------------------------------------------------------------------------
# Minimal Markdown → HTML (headings, paragraphs, lists, tables, code, quotes).
# Everything is escaped first; only the tags below are produced.
# ---------------------------------------------------------------------------
def inline(text):
    stash = []

    def keep(h):
        stash.append(h)
        return f"\x00{len(stash) - 1}\x00"

    t = html.escape(text, quote=True)
    t = re.sub(r"`([^`]+)`", lambda m: keep(f"<code>{m.group(1)}</code>"), t)

    def link(m):
        label, url = m.group(1), html.unescape(m.group(2))
        if not re.match(r"^(https://|\./|\.\./|[\w\-./#]+$)", url) or url.lower().startswith("javascript:"):
            return label
        return keep(f'<a href="{html.escape(url, quote=True)}">{label}</a>')

    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)", r"\1<em>\2</em>", t)
    return re.sub(r"\x00(\d+)\x00", lambda m: stash[int(m.group(1))], t)


def slug(text, seen):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "section"
    base, k = s, 2
    while s in seen:
        s, k = f"{base}-{k}", k + 1
    seen.add(s)
    return s


def markdown(src):
    lines = src.replace("\r\n", "\n").split("\n")
    out, i, seen = [], 0, set()
    para = []

    def flush():
        if para:
            out.append(f"<p>{inline(' '.join(para))}</p>")
            para.clear()

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith("```"):
            flush()
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith("```"):
                j += 1
            out.append("<pre><code>" + html.escape("\n".join(lines[i + 1:j])) + "</code></pre>")
            i = j + 1
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            flush()
            n = len(m.group(1))
            out.append(f'<h{n} id="{slug(m.group(2), seen)}">{inline(m.group(2))}</h{n}>')
            i += 1
            continue
        if s.startswith("|") and i + 1 < len(lines) and re.match(r"^\|?\s*:?-{2,}", lines[i + 1].strip()):
            flush()
            cells = lambda r: [c.strip() for c in r.strip().strip("|").split("|")]
            head = cells(s)
            rows = []
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(cells(lines[i]))
                i += 1
            th = "".join(f"<th>{inline(c)}</th>" for c in head)
            body = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows)
            out.append(f'<div class="tbl"><table><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table></div>')
            continue
        if re.match(r"^([-*+]|\d+[.)])\s+", s):
            flush()
            ordered = bool(re.match(r"^\d", s))
            items = []
            while i < len(lines) and (re.match(r"^\s*([-*+]|\d+[.)])\s+", lines[i]) or (items and re.match(r"^\s{2,}\S", lines[i]))):
                mm = re.match(r"^\s*(?:[-*+]|\d+[.)])\s+(.*)$", lines[i])
                if mm:
                    items.append(mm.group(1))
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            continue
        if s.startswith(">"):
            flush()
            q = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                q.append(lines[i].strip()[1:].strip())
                i += 1
            out.append(f"<blockquote><p>{inline(' '.join(q))}</p></blockquote>")
            continue
        if re.match(r"^(-{3,}|\*{3,})$", s):
            flush()
            out.append("<hr>")
        elif not s:
            flush()
        else:
            para.append(s)
        i += 1
    flush()
    return "\n".join(out)


AGENTS_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<meta name="referrer" content="no-referrer">
<title>alencar — instructions for AI agents</title>
<meta name="description" content="Instructions for AI agents that write books for alencar: format, rules and a reference book to follow.">
<link rel="alternate" type="text/markdown" href="agents.md" title="These instructions as plain text">
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<header class="top">
  <a class="brand" href="./">alencar</a>
  <nav>
    <a href="agents.md">agents.md</a>
    <a href="samples/the-art-of-lorem-ipsum-en/README.md">Reference book</a>
    <a href="app/?sample=en">Sample</a>
    <a href="app/">Viewer</a>
  </nav>
</header>
<article class="doc">
<p class="note">This site is for AI agents. Read the plain-text file <a href="agents.md">/agents.md</a> (same text as
this page) and the reference book under <a href="samples/the-art-of-lorem-ipsum-en/README.md">/samples/the-art-of-lorem-ipsum-en/</a>
(<a href="downloads/the-art-of-lorem-ipsum-en.zip">zip</a>). Optional checker:
<a href="tools/book_tools.py">/tools/book_tools.py</a>. The author previews and prints your files at <a href="app/">/app/</a>.</p>
{body}
</article>
</body>
</html>
"""

ROLE = [
    (r"^cover\.", "cover page 0.1 (portrait, 1024 × 1536)"),
    (r"^ch(\d+)-opener\.", "chapter {0} opener (landscape, 1536 × 1024)"),
    (r"^(\d+)-(\d+)-logo\.", "logo of page {0}.{1} (square, 1024 × 1024)"),
    (r"^(\d+)-(\d+)-[\w-]+\.", "image box of page {0}.{1} (landscape, 1536 × 1024)"),
]


def image_size(path):
    """Width × height of a PNG or JPEG, read from its header (stdlib only)."""
    b = path.read_bytes()
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")
    i = 2
    while b[:2] == b"\xff\xd8" and i + 9 < len(b):
        if b[i] != 0xFF:
            break
        marker, size = b[i + 1], int.from_bytes(b[i + 2:i + 4], "big")
        if marker in (0xC0, 0xC1, 0xC2):
            return int.from_bytes(b[i + 7:i + 9], "big"), int.from_bytes(b[i + 5:i + 7], "big")
        i += 2 + size
    return None


def manifest(name, folder):
    """README.md listed next to a reference book, so agents see every file without a directory listing."""
    title = re.search(r"^title:\s*(.+)$", (folder / "data.md").read_text(encoding="utf-8"), re.M).group(1)
    lines = [f"# Reference book: {title}", "",
             "Follow this book exactly when you write one (see \"Reference book\" in /agents.md).",
             "Body text is placeholder; structure, layout, look, image names and fullness are the pattern.", "",
             "| File | What it is |", "|---|---|",
             "| [data.md](data.md) | the content: front matter, BOOK PLAN, chapters, pages, boxes |",
             "| [layout.html](layout.html) | the templates of pages, openers and boxes — copy it as is |",
             "| [style.css](style.css) | the look — copy it; change only sections 1–3 for a new look |",
             f"| [../../downloads/{name}.zip](../../downloads/{name}.zip) | all of the above plus images, in one zip |",
             "", "## Images", "", "| File | Size | Role |", "|---|---|---|"]
    for img in sorted((folder / "images").iterdir()):
        if img.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        wh = image_size(img)
        role = next((r.format(*m.groups()) for pat, r in ROLE for m in [re.match(pat, img.name)] if m), "")
        lines.append(f"| [images/{img.name}](images/{img.name}) | {wh[0]} × {wh[1]} px | {role} |" if wh else
                     f"| [images/{img.name}](images/{img.name}) | | {role} |")
    lines += ["", "In this reference the photos are smaller JPGs (public-domain, see [images/CREDITS.md](images/CREDITS.md));",
              "a new book's images come from the author's choice (agents.md section 5), at the sizes given in the Role column.", ""]
    if (folder / "fonts").is_dir():
        lines += ["", "## Fonts", "", "| File |", "|---|"]
        lines += [f"| [fonts/{f.name}](fonts/{f.name}) |" for f in sorted((folder / "fonts").iterdir()) if f.is_file()]
        lines.append("")
    return "\n".join(lines)


def build():
    if OUT.exists():
        if OUT.name != "_site" or OUT.parent != ROOT:
            sys.exit("refusing to clean an unexpected folder")
        shutil.rmtree(OUT)
    shutil.copytree(SITE, OUT, ignore=shutil.ignore_patterns("build.py", "__pycache__"))
    (OUT / ".nojekyll").write_text("", encoding="utf-8")

    shutil.copytree(ROOT / "engine" / "viewer", OUT / "engine" / "viewer")
    # cache busting: the viewer page asks for this exact version of the engine files
    stamp = hashlib.sha256(b"".join((OUT / "engine" / "viewer" / f).read_bytes() for f in ("viewer.js", "viewer.css"))).hexdigest()[:10]
    app = OUT / "app" / "index.html"
    app.write_text(app.read_text(encoding="utf-8").replace("viewer.js\"", f"viewer.js?v={stamp}\"")
                   .replace("viewer.css\"", f"viewer.css?v={stamp}\""), encoding="utf-8", newline="\n")
    (OUT / "tools").mkdir()
    shutil.copy2(ROOT / "engine" / "tools" / "book_tools.py", OUT / "tools" / "book_tools.py")

    agents = (ROOT / "agent" / "AGENTS.md").read_text(encoding="utf-8")
    (OUT / "agents.md").write_text(agents, encoding="utf-8", newline="\n")
    page = AGENTS_PAGE.replace("{csp}", CSP).replace("{body}", markdown(agents))
    (OUT / "index.html").write_text(page, encoding="utf-8", newline="\n")

    (OUT / "downloads").mkdir()
    for name in SAMPLES:
        src, dst = ROOT / "books" / name, OUT / "samples" / name
        dst.mkdir(parents=True)
        for f in ("data.md", "layout.html", "style.css"):
            shutil.copy2(src / f, dst / f)
        shutil.copytree(src / "images", dst / "images")
        if (src / "fonts").is_dir():
            shutil.copytree(src / "fonts", dst / "fonts")
        (dst / "README.md").write_text(manifest(name, dst), encoding="utf-8", newline="\n")
        with zipfile.ZipFile(OUT / "downloads" / f"{name}.zip", "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(dst.rglob("*")):
                if f.is_file():
                    z.write(f, f"{name}/" + f.relative_to(dst).as_posix())

    tpl = ROOT / "engine" / "templates" / "new-book"
    with zipfile.ZipFile(OUT / "downloads" / "new-book.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(tpl.rglob("*")):
            if f.is_file() and f.name != "index.html":
                z.write(f, "new-book/" + f.relative_to(tpl).as_posix())

    # the whole kit with the repository's layout, for chat agents whose sandbox cannot reach the internet:
    # the author attaches this one zip and every command in AGENTS.md works unchanged inside it
    kit = [ROOT / "README.md", ROOT / "agent" / "AGENTS.md"]
    for d in [ROOT / "engine"] + [ROOT / "books" / n for n in SAMPLES]:
        kit += [f for f in sorted(d.rglob("*")) if f.is_file() and "__pycache__" not in f.parts
                and f.suffix != ".bak"]
    with zipfile.ZipFile(OUT / "downloads" / "kit.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in kit:
            z.write(f, "alencar/" + f.relative_to(ROOT).as_posix())

    files = [p for p in OUT.rglob("*") if p.is_file()]
    print(f"built {OUT} - {len(files)} files, {sum(p.stat().st_size for p in files) // 1024} KB")


if __name__ == "__main__":
    build()
