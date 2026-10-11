#!/usr/bin/env python3
"""
BOOK TOOLS - version 2.3

Single tool for an AI agent (or a person) to work on a book's data.md without
reading the whole file, to check the book's layout.html and style.css, and to export the book as PDF or EPUB.
Python standard library only (PyMuPDF or pdfplumber are optional, used only by the pdf-to-images command).

Usage:
  python book_tools.py validate      data.md                 (also checks layout.html and style.css next to it)
  python book_tools.py list          data.md
  python book_tools.py show          data.md 12.4            (one page)
  python book_tools.py show          data.md ch:12           (only the "# 12: ..." chapter block)
  python book_tools.py replace       data.md 12.4 new.md     (replace one page)
  python book_tools.py append        data.md new.md          (add chapter(s) at the end)
  python book_tools.py images        data.md                 (images with name, size and prompt)
  python book_tools.py fix           data.md                 (wrapper lines, encoding, line breaks)
  python book_tools.py fix           layout.html             (same, for the layout file)
  python book_tools.py pdf-to-images file.pdf output_folder
  python book_tools.py migrate       data.md [--out file] [--language en|pt|es|fr|de]
                                     (old Portuguese format -> new English format)
  python book_tools.py migrate-css   estilo.css [--out style.css]
                                     (old CSS variable / theme names -> new ones)
  python book_tools.py pdf           data.md out.pdf [--format SIZE] [--theme NAME] [--bleed]
                                     [--cmyk [--icc profile.icc] [--condition NAME] [--pdfx 4|3]] [--force] [--open]
                                     (RGB PDF for screens; --cmyk: PDF/X for print shops)
  python book_tools.py epub          data.md out.epub [--format SIZE] [--theme NAME] [--force] [--open]
                                     (fixed-layout EPUB 3 for e-book stores)
  python book_tools.py package       data.md out.zip [exported.pdf ...]
                                     (the book's files + the exported files, in one zip)

pdf and epub lay the book out with the viewer in a headless Chrome or Edge (BOOK_BROWSER
overrides which); pdf --cmyk also needs Ghostscript (BOOK_GS overrides which).

Every command that changes a file first saves a copy as <file>.bak, and the
data.md commands run the validation at the end. The last line of "validate"
is always "RESULT: OK" or "RESULT: ERRORS (n)".
"""
import os
import re
import shutil
import sys
import unicodedata

VERSION = "2.3"
TOOL = "python book_tools.py"

# ---------------------------------------------------------------- wrapper lines
WRAP_TOP = "<!-- BOOK FILE: DO NOT DELETE THE FIRST 3 OR THE LAST 3 LINES\nbook(function(){/*\n-->\n"
WRAP_END = "\n<!--\n*/});\n-->\n"
WRAP_MARK = "book(function(){/*"
OLD_WRAP_MARK = "livro(function(){/*"      # wrapper of the old Portuguese format

# ---------------------------------------------------------------- new format
KEYS = {
    "book": ["title", "author", "chapters", "footer", "first-page", "format", "theme", "language"],
    "chapter": ["subtitle", "tags", "image", "image-prompt", "opener", "layout", "class"],
    "page": ["subtitle", "lede", "logo", "logo-prompt", "layout", "class"],
    "box": ["icon", "color", "width", "height", "type", "columns", "image", "image-prompt",
            "caption", "title", "layout", "class", "area"],
}
ICONS = ["question", "bulb", "plus", "at", "gear", "chart", "document", "star", "trophy", "clock",
         "people", "check", "target", "trend", "search", "bolt", "shield", "link", "robot", "table",
         "money", "chat", "calendar", "pie", "code", "cloud", "alert", "book", "rocket"]
COLORS = ["primary", "accent", "green", "red", "purple"]   # the sample's colors; a book's style.css may add others
WIDTHS = {"1/4": 3, "1/3": 4, "1/2": 6, "2/3": 8, "3/4": 9, "full": 12}
TYPES = ["text", "image", "cards"]
FORMATS = ["original", "a4", "letter", "a5", "5x8in", "5.5x8.5in", "6x9in", "7x10in", "8x10in", "8.5x11in",
           "14x21cm", "15.6x23.4cm", "16x23cm", "17x24cm", "b5"]
# older ids still accepted (the viewer maps them to the ids above)
FORMAT_ALIASES = ["14x21", "16x23", "17x24", "kdp6x9", "kdp7x10", "kdp8x10", "kdp85x11", "6x9", "8.5x11"]
SIZE_RE = re.compile(r"^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|in)?$")


def custom_size_ok(v):
    """A custom page size "W x H mm|cm|in", each side between 50 and 600 mm."""
    m = SIZE_RE.match(v)
    if not m:
        return False
    k = {"mm": 1, "cm": 10, "in": 25.4}[m.group(3) or "mm"]
    w, h = (float(x.replace(",", ".")) * k for x in m.group(1, 2))
    return 50 <= w <= 600 and 50 <= h <= 600
THEMES = ["dark", "light"]
LANGUAGES = ["en", "pt", "es", "fr", "de"]
IMAGE_SIZE = {"logo": "1024x1024", "opener": "1536x1024", "image": "1536x1024"}
# Words per page. The reference book (A4) holds about 300 words a page with body text near 10 pt.
# The viewer shrinks text to fit, so a fuller page means smaller print, and a smaller page
# holds fewer words at the same size: the budget scales with the square root of the page area.
A4_WORDS, A4_MAX_WORDS = 300, 420
FORMAT_MM = {"original": (134, 189.4), "a4": (210, 297), "letter": (215.9, 279.4), "a5": (148, 210),
             "5x8in": (127, 203.2), "5.5x8.5in": (139.7, 215.9), "6x9in": (152.4, 228.6), "7x10in": (177.8, 254),
             "8x10in": (203.2, 254), "8.5x11in": (215.9, 279.4), "14x21cm": (140, 210), "15.6x23.4cm": (156, 234),
             "16x23cm": (160, 230), "17x24cm": (170, 240), "b5": (176, 250),
             "14x21": (140, 210), "16x23": (160, 230), "17x24": (170, 240), "kdp6x9": (152.4, 228.6),
             "kdp7x10": (177.8, 254), "kdp8x10": (203.2, 254), "kdp85x11": (215.9, 279.4), "6x9": (152.4, 228.6),
             "8.5x11": (215.9, 279.4)}


def format_mm(v):
    """Page size in mm for a format id or a custom "W x H mm|cm|in"; None when unknown."""
    nv = norm(v or "").replace(" ", "")
    if nv in FORMAT_MM:
        return FORMAT_MM[nv]
    m = SIZE_RE.match(norm(v or ""))
    if not m:
        return None
    k = {"mm": 1, "cm": 10, "in": 25.4}[m.group(3) or "mm"]
    return tuple(float(x.replace(",", ".")) * k for x in m.group(1, 2))


def word_budget(v):
    """(ideal, max) words per page for the book's format (A4 when no format is set)."""
    w, h = format_mm(v) or FORMAT_MM["a4"]
    s = ((w * h) / (210 * 297)) ** .5
    return round(A4_WORDS * s / 10) * 10, round(A4_MAX_WORDS * s / 10) * 10

# ---------------------------------------------------------------- old -> new tables
OLD_KEYS = {
    "book": {"livro": "title", "autor": "author", "total-capitulos": "chapters", "rodape": "footer",
             "pagina-inicial": "first-page", "formato": "format", "tema": "theme"},
    "chapter": {"subtitulo": "subtitle", "destaques": "tags", "imagem": "image",
                "prompt-imagem": "image-prompt", "capa": "opener"},
    "page": {"subtitulo": "subtitle", "selo": "lede", "prompt-logo": "logo-prompt"},
    "box": {"icone": "icon", "cor": "color", "largura": "width", "altura": "height", "tipo": "type",
            "colunas": "columns", "imagem": "image", "prompt-imagem": "image-prompt",
            "legenda": "caption", "titulo": "title"},
}
# old book-level keys that no longer exist: where the setting lives now
OLD_BOOK_DROPPED = {"cor-principal": "--color-primary in style.css",
                    "cor-destaque": "--color-accent in style.css",
                    "fonte": "--font-body in style.css"}
OLD_ICONS = {"pergunta": "question", "lampada": "bulb", "mais": "plus", "arroba": "at",
             "engrenagem": "gear", "grafico": "chart", "documento": "document", "estrela": "star",
             "trofeu": "trophy", "relogio": "clock", "pessoas": "people", "check": "check",
             "alvo": "target", "tendencia": "trend", "lupa": "search", "raio": "bolt",
             "escudo": "shield", "link": "link", "robo": "robot", "tabela": "table",
             "dinheiro": "money", "chat": "chat", "calendario": "calendar", "pizza": "pie",
             "codigo": "code", "nuvem": "cloud", "alerta": "alert", "livro": "book",
             "foguete": "rocket"}
OLD_VALUES = {   # keyed by the NEW property name; old values are compared normalized
    "theme": {"escuro": "dark", "claro": "light"},
    "format": {"carta": "letter"},
    "opener": {"sim": "yes", "nao": "no"},
    "color": {"azul": "primary", "dourado": "accent", "verde": "green", "vermelho": "red",
              "roxo": "purple"},
    "width": {"inteira": "full", "100%": "full", "metade": "1/2", "terco": "1/3", "quarto": "1/4"},
    "type": {"texto": "text", "imagem": "image", "cartoes": "cards"},
    "title": {"oculto": "hidden"},
    "icon": {k: v for k, v in OLD_ICONS.items() if k != v},
}
OLD_CSS_VARS = {
    "--cor-principal": "--color-primary", "--cor-principal-escura": "--color-primary-dark",
    "--cor-destaque": "--color-accent", "--cor-destaque-escura": "--color-accent-dark",
    "--fonte-texto": "--font-body", "--fonte-titulos": "--font-heading",
    "--altura-cabecalho": "--title-height", "--altura-rodape": "--footer-height",
    "--espaco-entre-caixas": "--box-gap", "--arredondamento": "--radius",
    "--tamanho-titulo-caixa": "--box-title-size", "--tamanho-icone": "--icon-size",
    "--entrelinha": "--line-height",
    "--fundo-pagina": "--page-bg", "--fundo-cabecalho": "--title-bg", "--cor-cabecalho": "--title-color",
    "--cor-cabecalho-sub": "--muted-color", "--fundo-rodape": "--footer-bg", "--cor-rodape": "--footer-color",
    "--fundo-caixa": "--box-bg", "--borda-caixa": "--rule-color", "--brilho-caixa": "--box-shadow",
    "--cor-texto": "--text-color", "--cor-titulo-caixa": "--box-title-color", "--cor-negrito": "--bold-color",
    "--fundo-cartao": "--card-bg", "--cor-cartao": "--card-color", "--borda-cartao": "--card-border",
    "--fundo-destaque": "--quote-bg", "--borda-destaque": "--quote-border",
    "--fundo-abertura": "--opener-bg", "--cor-abertura": "--opener-color",
}
OLD_CSS_THEMES = {"theme-escuro": "theme-dark", "theme-claro": "theme-light"}

MIGRATE_HINT = f"run: {TOOL} migrate data.md"

# chapter heading: "# 12: Title" (also "# Chapter 12: Title" / "# Capítulo 12: Title")
CHAPTER_RE = re.compile(r"^(?:(?:chapter|cap[ií]tulo)\s+([\w.\-]+?)|(\d+))\s*[:\-–—|.]\s*\S", re.I)
CHAPTER_NUM_RE = re.compile(r"^(?:(?:chapter|cap[ií]tulo)\s+([\w.\-]+)|(\d+)(?=\s*[:\-–—|.)]|\s|$))", re.I)
OLD_CHAPTER_RE = re.compile(r"^(#\s+)cap[ií]tulo\s+(\d[\w.\-]*)\s*([:\-–—|.])", re.I)


def norm(s):
    s = unicodedata.normalize("NFD", str(s))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def read_file(path):
    with open(path, "rb") as f:
        data = f.read()
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return data.decode(enc).replace("\r\n", "\n").replace("\r", "\n"), enc
        except UnicodeDecodeError:
            continue
    raise SystemExit("Could not read the file.")


def write_file(path, text):
    # the whole text is built before opening for writing; a backup is kept
    text = text.replace("\r\n", "\n")
    if os.path.exists(path):
        shutil.copyfile(path, path + ".bak")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def split_wrapper(text):
    """Return (body, wrapper, offset).

    body    - the Markdown without the wrapper lines
    wrapper - "new", "old" (Portuguese livro(...) wrapper) or None (plain Markdown)
    offset  - number of file lines before the first body line (to report real line numbers)
    """
    if WRAP_MARK in text:
        mark, kind = WRAP_MARK, "new"
    elif OLD_WRAP_MARK in text:
        mark, kind = OLD_WRAP_MARK, "old"
    else:
        start = 0
        while start < len(text) and text[start] == "\n":
            start += 1
        return text[start:].strip("\n") + "\n", None, text.count("\n", 0, start)
    a = text.index(mark) + len(mark)
    m = re.match(r"[^\n]*\n?\s*-->[^\n]*\n", text[a:])
    start = a + (m.end() if m else 0)
    while start < len(text) and text[start] == "\n":
        start += 1
    b = text.rfind("*/});")
    body = text[start:b] if b > start else text[start:]
    body = re.sub(r"\n?<!--\s*$", "", body)
    return body.strip("\n") + "\n", kind, text.count("\n", 0, start)


def wrap(body):
    return WRAP_TOP + "\n" + body.strip("\n").replace("*/", "* /") + "\n" + WRAP_END


def rebuild(body, wrapper):
    """Write back in the same style the file had: wrapped (new wrapper) or plain Markdown."""
    if wrapper:
        return wrap(body)
    return body.strip("\n") + "\n"


# ---------------------------------------------------------------- structure
def structure(body):
    """List of blocks: every '# ' and '## ' with start/end line (0-based, in the body)."""
    lines = body.split("\n")
    blocks = []
    in_comment = False
    for i, l in enumerate(lines):
        if "<!--" in l and "-->" not in l:
            in_comment = True
        if in_comment:
            if "-->" in l:
                in_comment = False
            continue
        m = re.match(r"^(#{1,2})\s+(.+?)\s*$", l)
        if m:
            level = len(m.group(1))
            text = m.group(2)
            num = ""
            if level == 1:
                mm = CHAPTER_NUM_RE.match(text)
                num = (mm.group(1) or mm.group(2)) if mm else ""
            else:
                mm = re.match(r"^(\d+(?:[.\-]\d+)*)\s*[:\-–—|.)]?\s+", text)
                num = mm.group(1) if mm else ""
            blocks.append({"level": level, "text": text, "num": num, "start": i})
    for k, b in enumerate(blocks):
        end = len(lines)
        for b2 in blocks[k + 1:]:
            if b2["level"] <= b["level"] or b["level"] == 1:
                end = b2["start"]
                break
        # for a chapter, "show ch:N" takes only the chapter heading block (up to the first page)
        b["end"] = end
    return lines, blocks


def trim_end(lines, end):
    """Do not leave a separator comment of the next chapter stuck to the block."""
    while end > 0 and (not lines[end - 1].strip() or lines[end - 1].strip().startswith("<!--")):
        end -= 1
    return end


# ---------------------------------------------------------------- validation
def validate(text, show=True, extra=None):
    errors, warnings = [], []
    E = lambda n, m: errors.append(f"line {n}: {m}" if n else m)
    W = lambda n, m: warnings.append(f"line {n}: {m}" if n else m)
    old_format = [False]

    def old(n, m):
        old_format[0] = True
        E(n, f"{m} ({MIGRATE_HINT})")

    body, wrapper, off = split_wrapper(text)
    if wrapper == "old":
        old(1, "old Portuguese wrapper lines (livro(function(){/* ...) -> new book(function(){/* lines")
    elif wrapper == "new":
        if not text.startswith(WRAP_TOP):
            E(1, "the first 3 lines must be exactly the fixed opening lines "
                 f"(repair with: {TOOL} fix data.md)")
        if not text.rstrip("\n").endswith(WRAP_END.strip("\n")):
            E(0, "the last 3 lines must be exactly the fixed closing lines "
                 f"(repair with: {TOOL} fix data.md)")
    # wrapper == None: plain Markdown is accepted (the viewer's Import adds the wrapper)
    if "*/" in body:
        E(0, 'the text must not contain "*/" (it breaks the file). Change it to "* /"')

    lines = body.split("\n")
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    meta = {}
    if i < len(lines) and lines[i].strip() == "---":
        i += 1
        while i < len(lines) and lines[i].strip() != "---":
            t = lines[i].strip()
            n = i + 1 + off
            if t:
                m = re.match(r"^([^:]+?)\s*:\s*(.*)$", t)
                if not m:
                    E(n, f'strange line in the book header: "{t}"')
                else:
                    k, v = norm(m.group(1)), m.group(2).strip()
                    if k in KEYS["book"]:
                        meta[k] = (v, n)
                    elif k in OLD_KEYS["book"]:
                        new = OLD_KEYS["book"][k]
                        nv = map_value(new, v)
                        old(n, f'old key "{m.group(1)}: {v}" -> use "{new}: {nv}"' if nv != v
                            else f'old key "{m.group(1)}:" -> rename to "{new}:"')
                        meta.setdefault(new, (nv, n))
                    elif k in OLD_BOOK_DROPPED:
                        old(n, f'old key "{m.group(1)}:" no longer exists in the header; '
                               f"use {OLD_BOOK_DROPPED[k]}")
                    else:
                        E(n, f'property "{m.group(1)}" does not exist in the book header. '
                             f'Accepted: {", ".join(KEYS["book"])}')
            i += 1
        i += 1
    else:
        E(0, "the book must start with the header between '---' lines (title:, author:, ...)")
    for k in ("title", "author"):
        if k not in meta:
            W(0, f'header without "{k}:"')
    if "format" in meta:
        v, n = meta["format"]
        nv = norm(v).replace(" ", "")
        if nv not in FORMATS and nv not in FORMAT_ALIASES and not custom_size_ok(norm(v)):
            bad_value("format", v, FORMATS, n, E, old,
                      extra=' (or a custom size "W x H mm|cm|in", 50-600 mm per side, e.g. "15 x 22 cm" or "5.25 x 8 in")')
    if "theme" in meta:
        v, n = meta["theme"]
        if norm(v) in OLD_VALUES["theme"] or not TOKEN_RE.match(norm(v)):
            bad_value("theme", v, THEMES, n, E, old, extra=" (or any .theme-NAME defined in style.css)")
    if "language" in meta:
        v, n = meta["language"]
        if norm(v) not in LANGUAGES:
            E(n, f'language "{v}" does not exist. Use: {", ".join(LANGUAGES)}')
    for k in ("chapters", "first-page"):
        if k in meta and not re.match(r"^\d+$", meta[k][0].strip()):
            E(meta[k][1], f'{k} must be a whole number')

    fmt_value = meta["format"][0] if "format" in meta else None
    fmt_name = fmt_value if fmt_value and format_mm(fmt_value) else "a4"
    ideal_words, max_words = word_budget(fmt_name)

    level, current, in_props, in_comment = None, None, False, False
    pages, chapters = {}, 0
    st = {"page": None, "words": 0, "boxes": 0, "box": None}

    def close_page():
        if st["page"]:
            if st["boxes"] == 0:
                E(st["page"][1], f'page "{st["page"][0]}" has no box (###)')
            if st["words"] > max_words:
                W(st["page"][1], f'page "{st["page"][0]}" has {st["words"]} words; at {fmt_name} a page holds about '
                                 f'{ideal_words} (at most {max_words}). Above that the text prints too small or does '
                                 f'not fit: cut words or split the page.')

    def close_box():
        c = st["box"]
        if c and not c["content"] and norm(c["props"].get("type", "")) != "image" and "image" not in c["props"]:
            W(c["line"], f'box "{c["title"]}" is empty')

    for j in range(i, len(lines)):
        t = lines[j].strip()
        n = j + 1 + off
        if in_comment:
            if "-->" in t:
                in_comment = False
            continue
        if t.startswith("<!--"):
            if "-->" not in t:
                in_comment = True
            continue
        m = re.match(r"^(#{1,4})\s+(.+?)\s*$", t)
        if m:
            lv = len(m.group(1))
            heading = m.group(2)
            if lv == 1:
                close_box(); st["box"] = None
                close_page(); st["page"] = None
                chapters += 1
                if not CHAPTER_RE.match(heading):
                    W(n, f'chapter heading out of pattern: "# {heading}". Use "# 12: Title"')
                level, current, in_props = "chapter", {}, True
            elif lv == 2:
                close_box(); st["box"] = None
                close_page()
                if chapters == 0:
                    E(n, "page (##) before any chapter (#)")
                mm = re.match(r"^(\d+(?:[.\-]\d+)*)\s*:\s+\S", heading)
                if not mm:
                    W(n, f'page heading out of pattern: "## {heading}". Use "## 12.1: Title"')
                    num = heading
                else:
                    num = mm.group(1)
                if num in pages:
                    E(n, f'page "{num}" already exists at line {pages[num]}')
                pages[num] = n
                st["page"], st["words"], st["boxes"] = (num, n), 0, 0
                level, current, in_props = "page", {}, True
            elif lv == 3:
                close_box()
                if st["page"] is None:
                    E(n, "box (###) before any page (##)")
                st["boxes"] += 1
                st["box"] = {"title": heading, "line": n, "props": {}, "content": 0}
                level, current, in_props = "box", st["box"]["props"], True
            continue
        if level is None:
            if t:
                E(n, f'text before the first chapter: "{t[:50]}"')
            continue
        if in_props:
            if not t:
                continue
            pm = re.match(r"^([A-Za-zÀ-ÿ\-]+)\s*:\s*(.*)$", t)
            key = norm(pm.group(1)) if pm else ""
            if pm and key in KEYS[level]:
                v = pm.group(2).strip()
                current[key] = v
                check_prop(key, v, n, E, old)
                continue
            if pm and key in OLD_KEYS[level]:
                new, v = OLD_KEYS[level][key], pm.group(2).strip()
                nv = map_value(new, v)
                hint = f'"{new}: {nv}"' if nv != v else f'"{new}:"'
                old(n, f'old key "{pm.group(1)}: {v}" -> use {hint}' if nv != v
                    else f'old key "{pm.group(1)}:" -> rename to {hint}')
                current.setdefault(new, nv)
                continue
            if pm and level != "box":
                E(n, f'property "{pm.group(1)}" does not exist here. Accepted: {", ".join(KEYS[level])}')
            elif pm and len(pm.group(1)) > 3:
                similar = [x for x in KEYS["box"] if distance(x, key) <= 2]
                if similar:
                    E(n, f'"{pm.group(1)}:" looks like a typo of "{similar[0]}:"')
            in_props = False
            if level == "chapter":
                check_chapter_images(current, n, E, W)
            if level == "page":
                check_page_images(current, n, E, W)
            if level == "box":
                check_box(st["box"], E, W)
        if t:
            box = st["box"]
            if box is not None:
                box["content"] += 1
                if norm(box["props"].get("type", "")) == "cards":
                    mm = re.match(r"^[-*+]\s+([A-Za-zÀ-ÿ]+)\s*:", t)
                    if mm and norm(mm.group(1)) not in ICONS:
                        if norm(mm.group(1)) in OLD_VALUES["icon"]:
                            old(n, f'card icon "{mm.group(1)}" is an old name -> use '
                                   f'"{OLD_VALUES["icon"][norm(mm.group(1))]}"')
                        else:
                            E(n, f'card icon "{mm.group(1)}" does not exist. Use: {", ".join(ICONS)}')
                    elif re.match(r"^[-*+]\s+", t) and not mm:
                        W(n, 'card without an icon. Use "- icon-name: text"')
            st["words"] += len(re.findall(r"\S+", re.sub(r"^[-*+>]\s+", "", t)))
    if in_props and level == "box" and st["box"]:
        check_box(st["box"], E, W)
    close_box()
    close_page()
    if chapters == 0:
        E(0, 'no chapter found. Every chapter starts with "# N: Title"')
    if extra:
        errors += extra[0]
        warnings += extra[1]

    if show:
        print(f"VALIDATION (book_tools {VERSION}): {chapters} chapter(s), {len(pages)} page(s); "
              f"page size {fmt_name}: about {ideal_words} words a page, at most {max_words}")
        for e in errors:
            print("  ERROR  ", e)
        for w in warnings:
            print("  WARNING", w)
        if old_format[0]:
            print(f"  TIP     This file uses the old Portuguese format. Convert it with: {TOOL} migrate <data.md>")
        print("RESULT: OK" if not errors else f"RESULT: ERRORS ({len(errors)})")
    return errors, warnings


def map_value(key, v):
    """New value for an old (Portuguese) value of property `key`; unchanged if not old."""
    return OLD_VALUES.get(key, {}).get(norm(v).replace(" ", ""), v)


def bad_value(key, v, allowed, n, E, old, extra=""):
    nv = norm(v).replace(" ", "")
    if nv in OLD_VALUES.get(key, {}):
        old(n, f'{key} "{v}" is an old value -> use "{OLD_VALUES[key][nv]}"')
    else:
        E(n, f'{key} "{v}" does not exist. Use: {", ".join(allowed)}{extra}')


def check_prop(k, v, n, E, old):
    nv = norm(v).replace(" ", "")
    if k == "icon" and nv not in ICONS:
        bad_value(k, v, ICONS, n, E, old)
    if k == "color" and (nv in OLD_VALUES["color"] or not TOKEN_RE.match(nv)):
        bad_value(k, v, COLORS, n, E, old, extra=" (or any name your style.css styles: letters, digits, -)")
    if k in ("layout", "area") and not TOKEN_RE.match(v.strip()):
        E(n, f'{k} "{v}" must be one name made of letters, digits and "-" (e.g. "wide")')
    if k == "class" and not all(TOKEN_RE.match(x) for x in v.split()):
        E(n, f'class "{v}" must be names made of letters, digits and "-", separated by spaces')
    if k == "width" and nv not in WIDTHS and not (nv.isdigit() and 1 <= int(nv) <= 12):
        bad_value(k, v, list(WIDTHS), n, E, old, extra=" (or a number of grid columns 1-12)")
    if k == "type" and nv not in TYPES:
        bad_value(k, v, TYPES, n, E, old)
    if k == "height" and not re.match(r"^[1-6]$", nv):
        E(n, "height must be a number from 1 to 6")
    if k == "columns" and nv not in ("2", "3"):
        E(n, "columns must be 2 or 3")
    if k == "title" and nv != "hidden":
        bad_value(k, v, ["hidden"], n, E, old)
    if k == "opener" and nv not in ("yes", "no"):
        bad_value(k, v, ["yes", "no"], n, E, old)
    if k in ("image", "logo"):
        if not re.match(r"^images/[a-z0-9][a-z0-9\-]*\.(png|jpg|jpeg|webp)$", v):
            E(n, f'image name "{v}" out of pattern. Use images/ + lowercase letters, numbers and '
                 f'hyphens + .png (e.g. images/12-1-photo.png)')


def check_chapter_images(p, n, E, W):
    if "image" in p and not p.get("image-prompt"):
        W(n, "chapter with image but without image-prompt")


def check_page_images(p, n, E, W):
    if "logo" in p and not p.get("logo-prompt"):
        W(n, "page with logo but without logo-prompt")


def check_box(c, E, W):
    p = c["props"]
    if norm(p.get("type", "")) == "image":
        if not p.get("image"):
            E(c["line"], f'box "{c["title"]}" is type image but has no "image:"')
        if not p.get("image-prompt"):
            W(c["line"], f'box "{c["title"]}" without image-prompt')


def distance(a, b):
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (ca != cb))
    return d[len(b)]


# ---------------------------------------------------------------- migration
def migrate_body(body, language=None):
    """Convert an old Portuguese-format body to the new English format.

    Returns (new_body, notes). Lines that are already in the new format are kept.
    """
    lines = body.split("\n")
    out, notes = [], []
    counts = {}

    def bump(what):
        counts[what] = counts.get(what, 0) + 1

    i = 0
    while i < len(lines) and not lines[i].strip():
        out.append(lines[i]); i += 1
    # ---- front matter
    if i < len(lines) and lines[i].strip() == "---":
        out.append(lines[i]); i += 1
        dropped = []
        has_language = False
        while i < len(lines) and lines[i].strip() != "---":
            l = lines[i]
            m = re.match(r"^(\s*)([^:]+?)(\s*:\s*)(.*)$", l)
            if m:
                k = norm(m.group(2))
                if k in OLD_BOOK_DROPPED:
                    dropped.append((m.group(2).strip(), m.group(4).strip(), OLD_BOOK_DROPPED[k]))
                    bump("dropped book keys")
                    i += 1
                    continue
                new = OLD_KEYS["book"].get(k, k if k in KEYS["book"] else None)
                if new:
                    if new != k:
                        bump("book keys")
                    v = m.group(4)
                    nv = map_value(new, v.strip())
                    if nv != v.strip():
                        bump("values")
                        v = nv
                    if new == "language":
                        has_language = True
                    l = f"{m.group(1)}{new}{m.group(3)}{v}"
            out.append(l)
            i += 1
        if language and not has_language:
            out.append(f"language: {language}")
        if i < len(lines):
            out.append(lines[i]); i += 1
        for k, v, where in dropped:
            out.append(f"<!-- removed by migrate: {k}: {v} (now set {where}) -->")
            notes.append(f'book key "{k}: {v}" has no equivalent in data.md; moved to a comment. Set {where}.')
        if not language and not has_language:
            notes.append('no "language:" in the header, so printed labels default to English '
                         '("Chapter", "In this chapter"). Add "language: pt" if the book is in Portuguese.')
    # ---- body
    level, in_props, in_comment, box_type = None, False, False, ""
    for l in lines[i:]:
        t = l.strip()
        if in_comment:
            out.append(l)
            if "-->" in t:
                in_comment = False
            continue
        if t.startswith("<!--"):
            out.append(l)
            if "-->" not in t:
                in_comment = True
            continue
        m = re.match(r"^(#{1,4})\s+(.+?)\s*$", t)
        if m:
            lv = len(m.group(1))
            if lv == 1:
                mm = OLD_CHAPTER_RE.match(l)
                if mm:
                    rest = l[mm.end():].lstrip()
                    l = f"{mm.group(1)}{mm.group(2)}: {rest}"
                    bump("chapter headings")
                level, in_props = "chapter", True
            elif lv == 2:
                level, in_props = "page", True
            elif lv == 3:
                level, in_props, box_type = "box", True, ""
            out.append(l)
            continue
        if level and in_props:
            if not t:
                out.append(l)
                continue
            pm = re.match(r"^(\s*)([A-Za-zÀ-ÿ\-]+)(\s*:\s*)(.*)$", l)
            k = norm(pm.group(2)) if pm else ""
            if pm and (k in KEYS[level] or k in OLD_KEYS[level]):
                new = OLD_KEYS[level].get(k, k)
                if new != k:
                    bump("property keys")
                v = pm.group(4)
                nv = map_value(new, v.strip())
                if nv != v.strip():
                    bump("icons" if new == "icon" else "values")
                    v = nv
                if new == "type":
                    box_type = norm(v)
                out.append(f"{pm.group(1)}{new}{pm.group(3)}{v}")
                continue
            in_props = False
        if level == "box" and box_type == "cards":
            cm = re.match(r"^(\s*[-*+]\s+)([A-Za-zÀ-ÿ]+)(\s*:)", l)
            if cm and norm(cm.group(2)) in OLD_VALUES["icon"]:
                l = cm.group(1) + OLD_VALUES["icon"][norm(cm.group(2))] + l[cm.end(2):]
                bump("card icons")
        out.append(l)
    summary = ", ".join(f"{v} {k}" for k, v in counts.items()) or "nothing to change"
    return "\n".join(out), [f"changed: {summary}"] + notes


def migrate_css(text):
    counts = {"variables": 0, "theme classes": 0}

    def var(m):
        new = OLD_CSS_VARS.get(m.group(0))
        if new:
            counts["variables"] += 1
            return new
        return m.group(0)

    def theme(m):
        counts["theme classes"] += 1
        return "." + OLD_CSS_THEMES[m.group(1)]

    text = re.sub(r"--[A-Za-z0-9\-]+", var, text)
    text = re.sub(r"\.(theme-escuro|theme-claro)(?![\w\-])", theme, text)
    notes = [f'changed: {counts["variables"]} variable(s), {counts["theme classes"]} theme class(es)']
    if re.search(r"url\(|@import", text, re.I):
        notes.append("WARNING: url() / @import found; the viewer ignores them")
    if not re.search(r"\.book\s+\.page\b", text):
        notes.append("NOTE: this style.css only has variables. Since version 2.1 the layout belongs to the book: "
                     "copy sections 4-11 of the sample style.css and the sample layout.html into this book")
    return text, notes


# ---------------------------------------------------------------- layout.html and style.css
# The same rules the viewer applies (engine/viewer/viewer.js: parseLayout, cleanCss).
LAYOUT_TOP = "<!-- BOOK LAYOUT: DO NOT DELETE THE FIRST 3 OR THE LAST 3 LINES\nlayout(function(){/*\n-->\n"
LAYOUT_MARK = "layout(function(){/*"
LAYOUT_TAGS = set(("template div span section header footer aside article nav main figure figcaption h1 h2 h3 h4 h5 h6 "
                   "p b i em strong small sup sub br hr ul ol li blockquote svg g path circle ellipse rect line polyline "
                   "polygon").split())
LAYOUT_ATTRS = set(("class style viewbox d cx cy r rx ry x y x1 y1 x2 y2 width height points fill stroke stroke-width "
                    "stroke-linecap stroke-linejoin stroke-dasharray opacity fill-opacity stroke-opacity transform "
                    "preserveaspectratio aria-hidden").split())
DEFAULT_TEMPLATES = {"page": "content pages", "opener": "chapter openers", "box": "text boxes", "image-box": "image boxes"}
SLOTS = {"boxes", "logo", "image", "intro", "icon", "body"}
FIT_RE = re.compile(r"^(--[a-z0-9-]+)\s+(\d+(?:\.\d+)?)(pt|u)\s+(\d+(?:\.\d+)?)(pt|u)(?:\s+(\d+(?:\.\d+)?)%)?$", re.I)
TOKEN_RE = re.compile(r"^[a-z][a-z0-9_-]*$", re.I)
BAD_CSS_RE = re.compile(r"url\s*\(|image-set\s*\(|src\s*\(|expression\s*\(|javascript:|vbscript:|@import|-moz-binding|"
                        r"behavior\s*:", re.I)


# Custom fonts: the only url() a book may use, inside @font-face src, naming a file in its fonts/ folder
FONT_PATH_RE = re.compile(r"^fonts/[a-z0-9][a-z0-9\-]*\.(woff2|woff|ttf|otf)$")
FONT_SRC_RE = re.compile(r"""^(?:local\(\s*(?:"[^"\\]*"|'[^'\\]*'|[\w -]+)\s*\)|"""
                         r"""url\(\s*(["']?)([^"'()\s\\]+)\1\s*\)"""
                         r"""(?:\s+format\(\s*(["']?)(woff2|woff|truetype|opentype)\3\s*\))?)$""", re.I)
FONT_MAGIC = (b"wOF2", b"wOFF", b"OTTO", b"true", b"\x00\x01\x00\x00")


def css_decode(s):
    s = re.sub(r"\\([0-9a-fA-F]{1,6})\s?", lambda m: chr(min(int(m.group(1), 16), 0x10FFFF) or 0xFFFD), s)
    return re.sub(r"\\(.)", r"\1", s)


def bad_css(s):
    return bool(BAD_CSS_RE.search(css_decode(s)))


def check_layout(path, used):
    """Errors and warnings for layout.html. used: {template id: first data.md line using it}."""
    errors, warnings = [], []
    E = lambda m: errors.append(f"layout.html: {m}")
    W = lambda m: warnings.append(f"layout.html: {m}")
    if not os.path.exists(path):
        E("missing. Every book needs its own layout.html (copy it from the sample book or the new-book "
          "template and adapt it); without it the viewer shows a plain fallback")
        return errors, warnings, set()
    text, _ = read_file(path)
    if LAYOUT_MARK in text:
        if not text.startswith(LAYOUT_TOP):
            E(f"the first 3 lines must be exactly the fixed opening lines (repair with: {TOOL} fix layout.html)")
        if not text.rstrip("\n").endswith(WRAP_END.strip("\n")):
            E(f"the last 3 lines must be exactly the fixed closing lines (repair with: {TOOL} fix layout.html)")
        a = text.index(LAYOUT_MARK) + len(LAYOUT_MARK)
        b = text.rfind("*/});")
        body = text[a:b] if b > a else text[a:]
    else:
        E(f"the wrapper lines are missing; double-clicking index.html cannot read it (add them with: {TOOL} fix layout.html)")
        body = text
    if "*/" in body:
        E('must not contain the two characters "*/"')

    from html.parser import HTMLParser

    class P(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.ids, self.cur, self.depth = {}, None, 0

        def handle_starttag(self, tag, attrs):
            self.check(tag, attrs)
            if tag == "template":
                tid = dict(attrs).get("id", "")
                if not TOKEN_RE.match(tid or ""):
                    E(f'line {self.getpos()[0]}: <template> needs an id made of letters, digits and "-"')
                elif tid in self.ids:
                    E(f'line {self.getpos()[0]}: template "{tid}" is defined twice')
                else:
                    self.ids[tid] = self.getpos()[0]
                self.cur = tid
            elif self.cur is None:
                W(f"line {self.getpos()[0]}: <{tag}> outside any <template> is ignored")

        def handle_startendtag(self, tag, attrs):
            self.check(tag, attrs)

        def handle_endtag(self, tag):
            if tag == "template":
                self.cur = None

        def check(self, tag, attrs):
            n = self.getpos()[0]
            if tag == "template":
                return
            if tag not in LAYOUT_TAGS:
                E(f"line {n}: <{tag}> is not allowed (the viewer removes it). Use plain HTML (div, span, section, "
                  f"header, footer, h1-h6, p, ul, li...) or simple SVG")
            for k, v in attrs:
                v = v or ""
                if k.startswith("data-"):
                    ok = bool(re.match(r"^data-[a-z0-9-]+$", k))
                else:
                    ok = k in LAYOUT_ATTRS
                if not ok:
                    E(f'line {n}: attribute "{k}" is not allowed (no ids, events, links or src)')
                elif bad_css(v):
                    E(f'line {n}: {k}="{v[:40]}" uses url(), @import or similar, which is not allowed')
                if k == "data-fit" and not FIT_RE.match(v.strip()):
                    E(f'line {n}: data-fit="{v}" is not valid. Use "--name MIN MAX [shrink%]" with MIN and MAX in pt '
                      f'or u, e.g. "--fs 4.5pt 13pt"')
                if k == "data-slot" and v.strip() not in SLOTS:
                    W(f'line {n}: data-slot="{v}" is unknown. Slots: {", ".join(sorted(SLOTS))}')
                if k == "data-image" and not re.match(r"^images/[a-z0-9][a-z0-9\-]*\.(png|jpg|jpeg|webp)$", v):
                    E(f'line {n}: data-image="{v}" out of pattern. Use images/ + lowercase name + .png, .jpg or .webp')
                if "{{" in v and k != "class" and not k.startswith("data-"):
                    W(f'line {n}: {{{{...}}}} only works in text, class and data-* attributes')

    p = P()
    p.feed(body)
    p.close()
    for tid, what in DEFAULT_TEMPLATES.items():
        if tid not in p.ids:
            W(f'no <template id="{tid}">: {what} use the plain fallback')
    for tid, line in used.items():
        if tid not in p.ids:
            errors.append(f'line {line}: "layout: {tid}" but layout.html has no <template id="{tid}"> '
                          f'(templates: {", ".join(p.ids) or "none"})')
    return errors, warnings, set(p.ids)


def css_items(src):
    """Top-level CSS items as (head, body); body None for "@x ...;" statements."""
    out, i, start, n = [], 0, 0, len(src)

    def skip_str(j):
        q = src[j]
        j += 1
        while j < n and src[j] != q:
            j += 2 if src[j] == "\\" else 1
        return j

    while i < n:
        c = src[i]
        if c in "\"'":
            i = skip_str(i) + 1
            continue
        if c == ";":
            out.append((src[start:i], None))
            i += 1
            start = i
            continue
        if c == "}":
            i += 1
            start = i
            continue
        if c == "{":
            d, j = 1, i + 1
            while j < n and d:
                cj = src[j]
                if cj in "\"'":
                    j = skip_str(j)
                elif cj == "{":
                    d += 1
                elif cj == "}":
                    d -= 1
                j += 1
            out.append((src[start:i], src[i + 1:j - 1]))
            start = i = j
            continue
        i += 1
    if src[start:].strip():
        out.append((src[start:], None))
    return out


def split_top(s, sep):
    out, d, start, q, i = [], 0, 0, None, 0
    while i < len(s):
        c = s[i]
        if q:
            if c == "\\":
                i += 1
            elif c == q:
                q = None
        elif c in "\"'":
            q = c
        elif c in "([":
            d += 1
        elif c in ")]":
            d -= 1
        elif c == sep and not d:
            out.append(s[start:i])
            start = i + 1
        i += 1
    out.append(s[start:])
    return out


def book_selector(sel):
    d, top, i = 0, "", 0
    while i < len(sel):
        c = sel[i]
        if c in "([":
            d += 1
        elif c in ")]":
            d -= 1
        elif not d and c in " \t\n>+~":
            break
        if not d and c not in ")]":
            top += c
        i += 1
    if not re.search(r"\.(book|theme-[a-z0-9_-]+)(?![\w-])", top, re.I):
        return False
    if re.match(r"^\s*[+~]", sel[i:]):
        return False
    return not bad_css(sel)


def font_src_check(value, problems, fonts):
    """@font-face src: local() fonts and url()s of files in fonts/ (collected in fonts)."""
    for it in split_top(value, ","):
        x = it.strip()
        m = FONT_SRC_RE.match(x)
        if not m or (m[2] and not FONT_PATH_RE.match(m[2])):
            problems.append(f'"{x[:60]}" is not allowed: @font-face src takes local("Name") or '
                            f'url("fonts/name.woff2") (a file in the book\'s fonts/ folder; lowercase letters, numbers, '
                            f'hyphens; .woff2, .woff, .ttf or .otf)')
        elif m[2] and m[2] not in fonts:
            fonts.append(m[2])


def css_check(src, problems, fonts):
    for head, body in css_items(src):
        head = head.strip()
        if not head:
            continue
        short = re.sub(r"\s+", " ", head)[:60]
        if head.startswith("@"):
            name = (re.match(r"^@([\w-]+)", head) or [None, ""])[1].lower()
            if body is None or bad_css(head):
                problems.append(f'"{short}" is not allowed (no @import, @charset, url())')
            elif name in ("media", "supports", "container", "layer"):
                css_check(body, problems, fonts)
            elif re.match(r"^(-webkit-)?keyframes$", name) or name == "font-face":
                for d in split_top(body, ";"):
                    m = re.match(r"^\s*src\s*:([\s\S]*)$", d, re.I)
                    if name == "font-face" and m:
                        font_src_check(m[1], problems, fonts)
                    elif bad_css(d):
                        problems.append(f'"{d.strip()[:60]}" uses url() or similar (url() only in @font-face src)')
            else:
                problems.append(f'"@{name}" is not allowed')
            continue
        bare = re.sub(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'", "", body or "")
        if body is None or "{" in bare or "}" in bare:
            problems.append(f'"{short}": broken rule or nested CSS (write every rule flat)')
            continue
        for s in split_top(head, ","):
            if s.strip() and not book_selector(s.strip()):
                problems.append(f'selector "{s.strip()[:60]}" must start at .book (or .theme-NAME) and cannot use + or ~ '
                                f"right after it")
        for d in split_top(body, ";"):
            if not d.strip():
                continue
            m = re.match(r"^\s*(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:([\s\S]*)$", d)
            if not m or not m[2].strip() or bad_css(m[2]) or m[1].lower() in ("behavior", "-moz-binding"):
                problems.append(f'"{d.strip()[:60]}" is not allowed (no url(), @import, expression())')


def check_style(path):
    errors, warnings = [], []
    if not os.path.exists(path):
        errors.append("style.css: missing. Every book needs its own style.css (copy it from the sample book)")
        return errors, warnings
    text, _ = read_file(path)
    problems, fonts = [], []
    css_check(re.sub(r"/\*[\s\S]*?\*/", "", text), problems, fonts)
    errors += [f"style.css: {p} — the viewer ignores it" for p in problems]
    folder = os.path.dirname(os.path.abspath(path))
    for f in fonts:
        fp = os.path.join(folder, *f.split("/"))
        if not os.path.isfile(fp):
            errors.append(f'style.css: font file "{f}" not found. Put it in the book\'s fonts/ folder with that exact name')
            continue
        with open(fp, "rb") as fh:
            if fh.read(4) not in FONT_MAGIC:
                errors.append(f'style.css: "{f}" is not a font file (WOFF2, WOFF, TrueType or OpenType)')
    fdir = os.path.join(folder, "fonts")
    if os.path.isdir(fdir):
        for n in sorted(os.listdir(fdir)):
            if re.search(r"\.(woff2?|ttf|otf)$", n, re.I) and f"fonts/{n}" not in fonts:
                warnings.append(f'style.css: fonts/{n} is not used by any @font-face '
                                f'(names are lowercase letters, numbers and hyphens)')
    return errors, warnings


def layout_refs(text):
    """{template id: first line} for every "layout:" property in data.md."""
    body, _, off = split_wrapper(text)
    used = {}
    for k, l in enumerate(body.split("\n")):
        m = re.match(r"^\s*layout\s*:\s*(\S+)\s*$", l)
        if m:
            used.setdefault(m.group(1), k + 1 + off)
    return used


# ---------------------------------------------------------------- commands
def cmd_validate(path):
    text, _ = read_file(path)
    folder = os.path.dirname(os.path.abspath(path))
    le, lw, _ = check_layout(os.path.join(folder, "layout.html"), layout_refs(text))
    se, sw = check_style(os.path.join(folder, "style.css"))
    errors, _ = validate(text, extra=(le + se, lw + sw))
    return 1 if errors else 0


def cmd_fix(path):
    if os.path.basename(path).lower() == "layout.html":
        text, enc = read_file(path)
        if LAYOUT_MARK in text:
            a = text.index(LAYOUT_MARK) + len(LAYOUT_MARK)
            m = re.match(r"[^\n]*\n?\s*-->[^\n]*\n", text[a:])
            a += m.end() if m else 0
            b = text.rfind("*/});")
            body = re.sub(r"\n?<!--\s*$", "", text[a:b] if b > a else text[a:])
        else:
            body = text
        write_file(path, LAYOUT_TOP + "\n" + body.strip("\n").replace("*/", "* /") + "\n" + WRAP_END)
        print(f"Fixed {path} (read as {enc}, written as UTF-8 with the wrapper lines). Backup: {path}.bak")
        errors, warnings, _ = check_layout(path, {})
        for e in errors:
            print("  ERROR  ", e)
        for w in warnings:
            print("  WARNING", w)
        return 1 if errors else 0
    text, enc = read_file(path)
    body, _, _ = split_wrapper(text)
    new = wrap(body)
    write_file(path, new)
    print(f"Fixed (read as {enc}, written as UTF-8 with the wrapper lines). Backup: {path}.bak")
    errors, _ = validate(new)
    return 1 if errors else 0


def cmd_list(path):
    text, _ = read_file(path)
    body, _, _ = split_wrapper(text)
    lines, blocks = structure(body)
    props = set(KEYS["page"] + KEYS["box"] + list(OLD_KEYS["page"]) + list(OLD_KEYS["box"]))
    for b in blocks:
        if b["level"] == 1:
            print(f'\n# {b["text"]}')
        else:
            content = "\n".join(l for l in lines[b["start"] + 1:b["end"]]
                                if not l.lstrip().startswith("#")
                                and norm(l.split(":", 1)[0]) not in props)
            words = len(re.findall(r"\S+", content))
            print(f'   ## {b["text"]}   ({words} words)')
    return 0


def find(blocks, target):
    low = target.lower()
    for prefix in ("ch:", "chapter:", "cap:"):
        if low.startswith(prefix):
            n = target[len(prefix):]
            return [b for b in blocks if b["level"] == 1 and b["num"] == n]
    return [b for b in blocks if b["level"] == 2 and b["num"] == target]


def cmd_show(path, target):
    text, _ = read_file(path)
    body, _, _ = split_wrapper(text)
    lines, blocks = structure(body)
    found = find(blocks, target)
    if not found:
        print(f'Could not find "{target}". Use "list" to see what exists.')
        return 1
    b = found[0]
    end = b["end"]
    if b["level"] == 1:
        nxt = [x for x in blocks if x["start"] > b["start"]]
        end = nxt[0]["start"] if nxt else len(lines)
    print("\n".join(lines[b["start"]:trim_end(lines, end)]))
    return 0


def cmd_replace(path, target, new_path):
    text, _ = read_file(path)
    new, _ = read_file(new_path)
    new, _, _ = split_wrapper(new)
    first = next((t.strip() for t in new.split("\n") if t.strip()), "")
    if not first.startswith("## "):
        print(f'"{new_path}" must hold the whole new page, starting with its "## N.M: Title" line '
              f'(it is {"empty" if not first else "missing that line"}). NOTHING WAS WRITTEN.')
        return 1
    body, wrapper, _ = split_wrapper(text)
    lines, blocks = structure(body)
    found = find(blocks, target)
    if not found or found[0]["level"] != 2:
        print(f'Could not find page "{target}".')
        return 1
    b = found[0]
    end = trim_end(lines, b["end"])
    rest = lines[end:]
    if not rest or rest[0].strip():
        rest = [""] + rest
    new_body = "\n".join(lines[:b["start"]] + new.strip("\n").split("\n") + rest)
    new_text = rebuild(new_body, wrapper)
    errors, _ = validate(new_text, show=False)
    if errors:
        validate(new_text)
        print("NOTHING WAS WRITTEN. Fix the new file and try again.")
        return 1
    write_file(path, new_text)
    print(f'Page "{target}" replaced. Backup: {path}.bak')
    validate(new_text)
    return 0


def cmd_append(path, new_path):
    text, _ = read_file(path)
    new, _ = read_file(new_path)
    new, _, _ = split_wrapper(new)
    new = re.sub(r"^\s*---\n.*?\n---\n", "", new, count=1, flags=re.S)   # ignore a book header if present
    body, wrapper, _ = split_wrapper(text)
    _, old_blocks = structure(body)
    _, new_blocks = structure(new)
    old_chapters = {b["num"] for b in old_blocks if b["level"] == 1}
    for b in new_blocks:
        if b["level"] == 1 and b["num"] in old_chapters:
            print(f'Chapter {b["num"]} already exists in the book. To redo it, use "replace" page by page.')
            return 1
    if not any(b["level"] == 1 for b in new_blocks):
        print('The new file has no "# N: Title" chapter.')
        return 1
    new_text = rebuild(body.rstrip("\n") + "\n\n" + new.strip("\n") + "\n", wrapper)
    errors, _ = validate(new_text, show=False)
    if errors:
        validate(new_text)
        print("NOTHING WAS WRITTEN. Fix the new file and try again.")
        return 1
    write_file(path, new_text)
    print(f"Chapter(s) appended. Backup: {path}.bak")
    validate(new_text)
    return 0


def cmd_images(path):
    text, _ = read_file(path)
    body, _, _ = split_wrapper(text)
    items = []
    level = None
    aliases = {"imagem": "image", "prompt-imagem": "image-prompt", "prompt-logo": "logo-prompt"}
    for l in body.split("\n"):
        t = l.strip()
        m = re.match(r"^(#{1,3})\s", t)
        if m:
            level = len(m.group(1))
            continue
        pm = re.match(r"^(image|logo|image-prompt|logo-prompt|imagem|prompt-imagem|prompt-logo)\s*:\s*(.*)$", t)
        if not pm:
            continue
        k, v = aliases.get(pm.group(1), pm.group(1)), pm.group(2).strip()
        if k in ("image", "logo"):
            kind = "logo" if k == "logo" else ("opener" if level == 1 else "image")
            items.append({"file": v, "size": IMAGE_SIZE[kind], "prompt": ""})
        elif items:
            items[-1]["prompt"] = v
    base = os.path.dirname(os.path.abspath(path))
    for it in items:
        exists = os.path.exists(os.path.join(base, it["file"]))
        print(f'{"[OK]     " if exists else "[MISSING]"} {it["file"]}  ({it["size"]})\n'
              f'            prompt: {it["prompt"] or "(no prompt)"}')
    return 0


def cmd_pdf_to_images(pdf, folder):
    os.makedirs(folder, exist_ok=True)
    try:
        import fitz  # PyMuPDF (optional)
        doc = fitz.open(pdf)
        for i, pg in enumerate(doc):
            out = os.path.join(folder, f"page-{i + 1:03d}.png")
            pg.get_pixmap(dpi=160).save(out)
            text = pg.get_text().strip()
            print(out, "(has selectable text)" if text else "(image only - read it from the image)")
        return 0
    except ImportError:
        pass
    try:
        import pdfplumber  # optional
        with pdfplumber.open(pdf) as doc:
            for i, pg in enumerate(doc.pages):
                out = os.path.join(folder, f"page-{i + 1:03d}.png")
                pg.to_image(resolution=160).save(out)
                print(out)
        return 0
    except ImportError:
        print("Neither PyMuPDF nor pdfplumber is installed. Ask the user to send the pages as images.")
        return 1


def cmd_migrate(path, out=None, language=None):
    if language and norm(language) not in LANGUAGES:
        print(f'--language must be one of: {", ".join(LANGUAGES)}')
        return 1
    text, enc = read_file(path)
    body, wrapper, _ = split_wrapper(text)
    new_body, notes = migrate_body(body, norm(language) if language else None)
    new_text = rebuild(new_body, wrapper)
    target = out or path
    write_file(target, new_text)
    print(f"Migrated {path} (read as {enc}) -> {target}" + (f" (backup: {target}.bak)" if not out else ""))
    for note in notes:
        print("  " + note)
    errors, _ = validate(new_text)
    return 1 if errors else 0


def cmd_migrate_css(path, out=None):
    text, _ = read_file(path)
    new_text, notes = migrate_css(text)
    if not out:
        folder, name = os.path.split(path)
        out = os.path.join(folder, "style.css") if name.lower() == "estilo.css" else path
    write_file(out, new_text)
    print(f"Migrated {path} -> {out}")
    for note in notes:
        print("  " + note)
    return 0


# ---------------------------------------------------------------- export: pdf, epub, package
# The book is laid out by the same viewer the author sees, in a headless Chrome or Edge, from a
# temporary copy that holds only the book's own files (data.md, layout.html, style.css, images/,
# fonts/) and the engine; the browser gets no network. The viewer is opened as
# index.html?export=pdf|epub&... and writes a JSON report into the page (exportReport in viewer.js).
ENGINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_MAGIC = {".png": (b"\x89PNG",), ".jpg": (b"\xff\xd8\xff",), ".jpeg": (b"\xff\xd8\xff",), ".webp": (b"RIFF",)}
MEDIA_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
               ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf"}
BROWSER_WAIT_MS = 60000          # virtual time the browser gives the viewer to lay the book out
PDFX_VERSIONS = {"4": "PDF/X-4", "3": "PDF/X-3:2002"}
NO_BROWSER = "Needs Google Chrome, Chromium or Microsoft Edge. Install one, or set BOOK_BROWSER to its program file."


def find_browser():
    """Chrome, Chromium or Edge: BOOK_BROWSER first, then the usual install places."""
    if os.environ.get("BOOK_BROWSER"):
        return os.environ["BOOK_BROWSER"]
    places = []
    for root in (os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")):
        if root:
            places += [os.path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
                       os.path.join(root, "Chromium", "Application", "chrome.exe"),
                       os.path.join(root, "Microsoft", "Edge", "Application", "msedge.exe")]
    places += ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
               "/Applications/Chromium.app/Contents/MacOS/Chromium",
               "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
    places += [shutil.which(n) or "" for n in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
                                                "microsoft-edge", "microsoft-edge-stable", "chrome", "msedge")]
    return next((p for p in places if p and os.path.isfile(p)), None)


def find_ghostscript():
    """Ghostscript: BOOK_GS first, then the PATH, then the Windows install folder (newest version)."""
    import glob
    if os.environ.get("BOOK_GS"):
        return os.environ["BOOK_GS"]
    for n in ("gswin64c", "gswin32c", "gs"):
        if shutil.which(n):
            return shutil.which(n)
    found = []
    for root in (os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)")):
        if root:
            found += glob.glob(os.path.join(root, "gs", "gs*", "bin", "gswin*c.exe"))
    version = lambda p: [int(x) for x in re.findall(r"\d+", os.path.basename(os.path.dirname(os.path.dirname(p))))]
    return max(found, key=version) if found else None


def ghostscript_cmyk_profile(gs):
    """Ghostscript's own generic CMYK profile (default_cmyk.icc), or None."""
    import glob
    root = os.path.dirname(os.path.dirname(os.path.realpath(gs)))
    places = [os.path.join(root, "iccprofiles", "default_cmyk.icc")]
    for pattern in ("/usr/share/ghostscript/*/iccprofiles/default_cmyk.icc", "/usr/share/color/icc/ghostscript/default_cmyk.icc",
                    "/opt/homebrew/share/ghostscript/*/iccprofiles/default_cmyk.icc",
                    "/usr/local/share/ghostscript/*/iccprofiles/default_cmyk.icc"):
        places += glob.glob(pattern)
    return next((p for p in places if os.path.isfile(p)), None)


def export_format_ok(value):
    """True when the viewer accepts the --format value: a known id (or old alias) or a custom size."""
    nv = norm(value).replace(" ", "")
    return nv in FORMAT_MM or bool(SIZE_RE.match(norm(value)) and custom_size_ok(norm(value)))


def stage_book(data_path, tmp):
    """Copy the book's own files and the engine into tmp; return (staged index.html, files left out)."""
    src = os.path.dirname(os.path.abspath(data_path))
    book = os.path.join(tmp, "books", "book")
    os.makedirs(book)
    shutil.copytree(os.path.join(ENGINE_DIR, "viewer"), os.path.join(tmp, "engine", "viewer"))
    shutil.copyfile(os.path.join(ENGINE_DIR, "templates", "new-book", "index.html"), os.path.join(book, "index.html"))
    # the viewer reads data.md and layout.html as <script>s: both need their wrapper lines
    text, _ = read_file(data_path)
    with open(os.path.join(book, "data.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(wrap(split_wrapper(text)[0]))
    if os.path.isfile(os.path.join(src, "layout.html")):
        t, _ = read_file(os.path.join(src, "layout.html"))
        if LAYOUT_MARK not in t:
            t = LAYOUT_TOP + "\n" + t.strip("\n").replace("*/", "* /") + "\n" + WRAP_END
        with open(os.path.join(book, "layout.html"), "w", encoding="utf-8", newline="\n") as f:
            f.write(t)
    if os.path.isfile(os.path.join(src, "style.css")):
        shutil.copyfile(os.path.join(src, "style.css"), os.path.join(book, "style.css"))
    is_image = lambda n, head: any(head.startswith(m) for m in IMAGE_MAGIC.get(os.path.splitext(n)[1].lower(), ()))
    is_font = lambda n, head: bool(FONT_PATH_RE.match("fonts/" + n)) and head[:4] in FONT_MAGIC
    skipped = []
    for sub, ok in (("images", is_image), ("fonts", is_font)):
        folder = os.path.join(src, sub)
        if not os.path.isdir(folder):
            continue
        os.makedirs(os.path.join(book, sub))
        for n in sorted(os.listdir(folder)):
            p = os.path.join(folder, n)
            if not os.path.isfile(p) or n.endswith(".bak") or n.upper().startswith(("CREDITS", "README")):
                continue
            with open(p, "rb") as f:
                head = f.read(12)
            if ok(n, head):
                shutil.copyfile(p, os.path.join(book, sub, n))
            else:
                skipped.append(f"{sub}/{n}")
    return os.path.join(book, "index.html"), skipped


def run_browser(browser, index, params, tmp, extra):
    """Open the staged book in a headless browser; returns (stdout text, stderr text)."""
    import pathlib
    import subprocess
    import urllib.parse
    url = pathlib.Path(index).as_uri() + "?" + urllib.parse.urlencode(params)
    profile = os.path.join(tmp, f"profile-{len(os.listdir(tmp))}")
    args = [browser, "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
            "--disable-extensions", "--disable-sync", "--mute-audio", f"--user-data-dir={profile}",
            "--host-resolver-rules=MAP * ~NOTFOUND", f"--virtual-time-budget={BROWSER_WAIT_MS}"]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        args.append("--no-sandbox")   # Chrome does not start as root (containers) without it
    try:
        r = subprocess.run(args + extra + [url], capture_output=True, timeout=600)
    except subprocess.TimeoutExpired:
        return "", "the browser did not finish in 10 minutes"
    return r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace")


def last_line(err):
    lines = err.strip().splitlines()
    return " The browser said: " + lines[-1][:300] if lines else ""


def export_report(browser, index, params, tmp):
    """Lay the book out and read the viewer's report; None (after saying why) when it fails."""
    import json
    out, err = run_browser(browser, index, params, tmp, ["--dump-dom"])
    m = re.search(r'<script type="application/json" id="book-export">([\s\S]*?)</script>', out)
    if not m:
        print("The viewer did not finish laying out the book." + last_line(err))
        return None
    rep = json.loads(m.group(1))
    if not rep.get("ready"):
        print("The viewer could not read data.md. Run validate and fix every error first.")
        return None
    return rep


def report_ok(rep, skipped, force):
    """Prints the viewer's problems; True when the export may go on."""
    for s in skipped:
        print(f"  WARNING [FILE] {s} was left out: not a real PNG/JPEG/WebP image or font file")
    label = {"err": "ERROR  ", "warn": "WARNING"}
    for p in rep["problems"]:
        print(f'  {label.get(p["level"], "NOTE   ")} [{p["kind"]}] {p["text"]}')
    errs = sum(p["level"] == "err" for p in rep["problems"])
    if errs and not force:
        print(f"Not exported: the viewer found {errs} error(s). Fix them, or add --force to export anyway.")
        return False
    return True


def precheck(path, fmt):
    """Runs validate quietly (data.md, layout.html, style.css); True when the book may be exported."""
    if fmt is not None and not export_format_ok(fmt):
        print(f'--format "{fmt}" is not a known size ({", ".join(FORMATS)}) nor "W x H mm|cm|in" (50-600 mm a side)')
        return False
    text, _ = read_file(path)
    folder = os.path.dirname(os.path.abspath(path))
    le, lw, _ = check_layout(os.path.join(folder, "layout.html"), layout_refs(text))
    se, sw = check_style(os.path.join(folder, "style.css"))
    errors, _ = validate(text, show=False, extra=(le + se, lw + sw))
    if errors:
        print(f"Not exported: validate finds {len(errors)} error(s). Run: {TOOL} validate {path}")
        return False
    return True


def show_file(path):
    """Opens the exported file for the author with the system's default app."""
    import subprocess
    try:
        if hasattr(os, "startfile"):
            os.startfile(path)
        else:
            subprocess.Popen(["open" if sys.platform == "darwin" else "xdg-open", path])
    except OSError as e:
        print(f"Could not open {path}: {e}")


def ps_string(s):
    """A PostScript string: (ascii) or <FEFF...> UTF-16 hex for anything else."""
    if all(32 <= ord(c) < 127 for c in s):
        return "(" + s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ")"
    return "<FEFF" + s.encode("utf-16-be").hex().upper() + ">"


def to_cmyk(gs, src, dst, rep, tmp, icc, condition, pdfx):
    """Browser PDF (RGB) → PDF/X: CMYK, the output intent and, with bleed, TrimBox/BleedBox. True when it worked."""
    import subprocess
    profile = os.path.join(tmp, "output-profile.icc").replace("\\", "/")
    shutil.copyfile(icc, profile)
    condition = condition or os.path.splitext(os.path.basename(icc))[0]
    prefix = "\n".join([
        "%!",
        f"[ /GTS_PDFXVersion ({PDFX_VERSIONS[pdfx]}) /Title {ps_string(rep['title'] or 'Book')} /Trapped /False /DOCINFO pdfmark",
        "[/_objdef {icc_PDFX} /type /stream /OBJ pdfmark",
        "[{icc_PDFX} << /N 4 >> /PUT pdfmark",
        f"[{{icc_PDFX}} {ps_string(profile)} (r) file /PUT pdfmark",
        "[/_objdef {OutputIntent_PDFX} /type /dict /OBJ pdfmark",
        f"[{{OutputIntent_PDFX}} << /Type /OutputIntent /S /GTS_PDFX /OutputCondition {ps_string(condition)} "
        f"/Info {ps_string(condition)} /OutputConditionIdentifier {ps_string(condition)} "
        "/RegistryName (http://www.color.org) /DestOutputProfile {icc_PDFX} >> /PUT pdfmark",
        "[{Catalog} << /OutputIntents [ {OutputIntent_PDFX} ] >> /PUT pdfmark", ""])
    with open(os.path.join(tmp, "pdfx.ps"), "w", encoding="ascii") as f:
        f.write(prefix)
    # links are annotations, which PDF/X does not allow: a print file drops them
    args = [gs, "-q", "-dBATCH", "-dNOPAUSE", "-dSAFER", "-dPreserveAnnots=false", f"--permit-file-read={profile}",
            "-sDEVICE=pdfwrite", f"-dPDFX={pdfx}", "-sColorConversionStrategy=CMYK", "-sProcessColorModel=DeviceCMYK",
            f"-sOutputICCProfile={profile}", f"-sOutputFile={dst}"]
    bl = rep["bleed"]
    if bl:
        # Ghostscript ignores PDFXTrimBoxToMediaBoxOffset for PDF input: the boxes are set page by page,
        # from each page's real size (the browser rounds it to whole points)
        b = f"{bl * 72 / 25.4:.3f}"
        size = "currentpagedevice /PageSize get aload pop"
        boxes = f"/TrimBox [{b} {b} {size} {b} sub exch {b} sub exch] /BleedBox [0 0 {size}]"
        args += ["-c", f"<< /EndPage {{ exch pop dup 2 ne {{ [{{ThisPage}} << {boxes} >> /PUT pdfmark }} if 2 ne }} >> setpagedevice", "-f"]
    args += [os.path.join(tmp, "pdfx.ps"), src]
    r = subprocess.run(args, capture_output=True, timeout=1200)
    said = (r.stdout + r.stderr).decode("utf-8", "replace")
    if r.returncode or not os.path.isfile(dst) or "reverting to normal PDF" in said:
        print("Ghostscript could not make the PDF/X file:\n  " + "\n  ".join(said.strip().splitlines()[-8:]))
        return False
    return True


def pdf_page_count(path):
    with open(path, "rb") as f:
        return len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", f.read()))


def cmd_pdf(path, out, format=None, theme=None, bleed=False, cmyk=False, icc=None, condition=None, pdfx="4",
            force=False, show=False):
    import tempfile
    if pdfx not in PDFX_VERSIONS:
        print(f"--pdfx must be one of: {', '.join(PDFX_VERSIONS)}")
        return 1
    if (icc or condition) and not cmyk:
        print("--icc and --condition go with --cmyk (print files) only")
        return 1
    if icc and not os.path.isfile(icc):
        print(f"ICC profile not found: {icc}")
        return 1
    if not precheck(path, format):
        return 1
    browser = find_browser()
    if not browser:
        print(NO_BROWSER)
        return 1
    gs = None
    if cmyk:
        gs = find_ghostscript()
        if not gs:
            print("--cmyk needs Ghostscript (https://ghostscript.com/releases/gsdnld.html; Windows: choco install ghostscript; "
                  "macOS: brew install ghostscript; Linux: apt install ghostscript), or BOOK_GS set to its program file.")
            return 1
        icc = icc or ghostscript_cmyk_profile(gs)
        if not icc:
            print("No CMYK profile found. Pass the print shop's profile with --icc file.icc")
            return 1
    out = os.path.abspath(out)
    with tempfile.TemporaryDirectory(prefix="book-export-") as tmp:
        index, skipped = stage_book(path, tmp)
        params = {"export": "pdf", "bleed": "1" if bleed else "0"}
        params.update({k: v for k, v in (("format", format), ("theme", theme)) if v})
        rep = export_report(browser, index, params, tmp)
        if not rep or not report_ok(rep, skipped, force):
            return 1
        rgb = os.path.join(tmp, "book.pdf")
        _, err = run_browser(browser, index, params, tmp, ["--no-pdf-header-footer", f"--print-to-pdf={rgb}"])
        if not os.path.isfile(rgb):
            print("The browser did not write the PDF." + last_line(err))
            return 1
        n = pdf_page_count(rgb)
        if n and n != rep["pages"]:
            print(f"  WARNING [PDF] the PDF has {n} pages but the book has {rep['pages']}: open it and check")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        if cmyk:
            if not to_cmyk(gs, rgb, out + ".part", rep, tmp, icc, condition, pdfx):
                return 1
            os.replace(out + ".part", out)
        else:
            shutil.copyfile(rgb, out)
    size = rep["format"]["name"] + (f' + {rep["bleed"]} mm bleed on each side' if rep["bleed"] else "")
    color = f"CMYK {PDFX_VERSIONS[pdfx]}, profile {os.path.basename(icc)}" if cmyk else "RGB (screen)"
    print(f"PDF: {out}\n  {rep['pages']} pages, {size}, {color}")
    if show:
        show_file(out)
    return 0


def xml_escape(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def xhtml_doc(lang, title, head, body):
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
            f'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{lang}" xml:lang="{lang}">\n'
            f'<head>\n<meta charset="UTF-8"/>\n<title>{xml_escape(title)}</title>\n{head}</head>\n<body>\n{body}\n</body>\n</html>\n')


def cmd_epub(path, out, format=None, theme=None, force=False, show=False):
    import datetime
    import tempfile
    import urllib.parse
    import uuid
    import xml.dom.minidom
    import zipfile
    if not precheck(path, format):
        return 1
    browser = find_browser()
    if not browser:
        print(NO_BROWSER)
        return 1
    out = os.path.abspath(out)
    with tempfile.TemporaryDirectory(prefix="book-export-") as tmp:
        index, skipped = stage_book(path, tmp)
        params = {"export": "epub", "bleed": "0"}
        params.update({k: v for k, v in (("format", format), ("theme", theme)) if v})
        rep = export_report(browser, index, params, tmp)
        if not rep or not report_ok(rep, skipped, force):
            return 1
        book = os.path.dirname(index)
        with open(os.path.join(ENGINE_DIR, "viewer", "viewer.css"), encoding="utf-8") as f:
            css = f.read()
        a, b = css.find("/* EXPORT:BEGIN"), css.find("/* EXPORT:END */")
        engine_css = ("/* page mechanics, from the book viewer (engine/viewer/viewer.css) */\n"
                      "html,body{margin:0;padding:0}\n" + css[css.index("*/", a) + 2:b].strip() +
                      "\n.page{margin:0;box-shadow:none}\n")
        style = ""
        if os.path.isfile(os.path.join(book, "style.css")):
            with open(os.path.join(book, "style.css"), encoding="utf-8-sig") as f:
                style = f.read()
        if "@font-face" not in re.sub(r"/\*[\s\S]*?\*/", "", style):
            print("  WARNING [FONTS] style.css embeds no fonts: e-readers will use their own, and text fitted to this "
                  "book's fonts may overflow. Embed the fonts the book uses (fonts/ + @font-face, AGENTS.md 8.5).")
        title, lang = rep["title"] or "Book", rep["language"]
        w, h = round(rep["format"]["w"] * 96 / 25.4), round(rep["format"]["h"] * 96 / 25.4)
        head = (f'<meta name="viewport" content="width={w}, height={h}"/>\n'
                '<link rel="stylesheet" type="text/css" href="engine.css"/>\n'
                '<link rel="stylesheet" type="text/css" href="style.css"/>\n')
        wrapper = f'<div class="{xml_escape(rep["cls"])}" style="--pw:{rep["format"]["w"]};--ph:{rep["format"]["h"]};--bl:0">'
        pages, used = [], set()
        for k, body in enumerate(rep["xhtml"]):
            if re.search(r"<script|\son[a-z]+\s*=|javascript:", body, re.I):
                print(f"Not exported: page {k + 1} holds a script or an event handler.")
                return 1
            used.update(urllib.parse.unquote(s) for s in re.findall(r'<img[^>]*\ssrc="([^"]+)"', body))
            page = xhtml_doc(lang, f"{title} — {k + 1}", head, wrapper + body + "</div>")
            try:
                xml.dom.minidom.parseString(page.encode("utf-8"))
            except Exception as e:
                print(f"Not exported: page {k + 1} is not valid XHTML ({e}).")
                return 1
            pages.append((f"p{k + 1:04d}", page))
        fonts = set(re.findall(r"""url\(\s*["']?(fonts/[^"')\s]+)""", style))
        assets = [p for p in sorted(used | fonts) if os.path.isfile(os.path.join(book, p))]
        ident = "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL, f"book:{title}|{rep['author']}"))
        modified = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        manifest = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
                    '<item id="engine-css" href="engine.css" media-type="text/css"/>',
                    '<item id="style-css" href="style.css" media-type="text/css"/>']
        manifest += [f'<item id="f{k}" href="{xml_escape(urllib.parse.quote(p))}" media-type="{MEDIA_TYPES[os.path.splitext(p)[1].lower()]}"/>'
                     for k, p in enumerate(assets)]
        manifest += [f'<item id="{n}" href="{n}.xhtml" media-type="application/xhtml+xml"'
                     + (' properties="svg"' if "<svg" in page else "") + "/>" for n, page in pages]
        opf = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               f'<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="{lang}">\n'
               '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
               f'<dc:identifier id="book-id">{ident}</dc:identifier>\n<dc:title>{xml_escape(title)}</dc:title>\n'
               + (f'<dc:creator>{xml_escape(rep["author"])}</dc:creator>\n' if rep["author"] else "") +
               f'<dc:language>{lang}</dc:language>\n<meta property="dcterms:modified">{modified}</meta>\n'
               '<meta property="rendition:layout">pre-paginated</meta>\n<meta property="rendition:orientation">auto</meta>\n'
               '<meta property="rendition:spread">auto</meta>\n</metadata>\n<manifest>\n' + "\n".join(manifest) +
               '\n</manifest>\n<spine>\n' + "\n".join(f'<itemref idref="{n}"/>' for n, _ in pages) + '\n</spine>\n</package>\n')
        toc = "\n".join(f'<li><a href="p{t["page"] + 1:04d}.xhtml">{xml_escape(t["title"])}</a></li>' for t in rep["toc"])
        nav = xhtml_doc(lang, title, "", f'<nav epub:type="toc" id="toc"><h1>{xml_escape(title)}</h1>\n<ol>\n{toc}\n</ol>\n</nav>')
        container = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                     '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n'
                     '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n'
                     '</container>\n')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with zipfile.ZipFile(out + ".part", "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)  # first, uncompressed
            z.writestr("META-INF/container.xml", container)
            z.writestr("OEBPS/content.opf", opf)
            z.writestr("OEBPS/nav.xhtml", nav)
            z.writestr("OEBPS/engine.css", engine_css)
            z.writestr("OEBPS/style.css", style)
            for p in assets:
                z.write(os.path.join(book, p), "OEBPS/" + p)
            for n, page in pages:
                z.writestr(f"OEBPS/{n}.xhtml", page)
        os.replace(out + ".part", out)
    print(f"EPUB (fixed layout): {out}\n  {rep['pages']} pages, {rep['format']['name']}, {len(assets)} image/font file(s)")
    code = epubcheck(out)
    if show:
        show_file(out)
    return code


def epubcheck(epub):
    """Runs W3C EPUBCheck (what the stores run on upload) when it is installed: BOOK_EPUBCHECK (epubcheck.jar
    or the program) or "epubcheck" on the PATH. 1 when it finds errors."""
    import subprocess
    tool = os.environ.get("BOOK_EPUBCHECK") or shutil.which("epubcheck")
    if not tool:
        print("  NOTE    EPUBCheck is not installed, and the stores run it on upload. To check here, install it "
              "(https://github.com/w3c/epubcheck/releases, needs Java) and set BOOK_EPUBCHECK to its epubcheck.jar.")
        return 0
    if tool.lower().endswith(".jar"):
        if not shutil.which("java"):
            print("  NOTE    BOOK_EPUBCHECK is a .jar but Java is not on the PATH: EPUBCheck was not run.")
            return 0
        tool = [shutil.which("java"), "-jar", tool]
    else:
        tool = [tool]
    r = subprocess.run(tool + [epub], capture_output=True, timeout=600)
    said = (r.stdout + r.stderr).decode("utf-8", "replace")
    for line in said.splitlines():
        m = re.match(r"\s*(FATAL|ERROR|WARNING)(\([^)]*\)): .*?\.epub[/\\]?([^:]*?): (.*)$", line)
        if m:
            print(f"  EPUBCHECK {m.group(1)}{m.group(2)} {m.group(3)}: {m.group(4)}")
    if r.returncode:
        print("EPUBCheck found errors: the stores will reject this file. Fix them before uploading.")
        return 1
    print("  EPUBCheck: no errors")
    return 0


def cmd_package(path, out, *exports):
    """One zip for the author: the book's files (data.md, layout.html, style.css, images/, fonts/) and,
    under export/, the given PDF/EPUB files."""
    import zipfile
    src = os.path.dirname(os.path.abspath(path))
    for e in exports:
        if not os.path.isfile(e) or os.path.splitext(e)[1].lower() not in (".pdf", ".epub"):
            print(f"Only exported .pdf or .epub files go with the book: {e}")
            return 1
    out = os.path.abspath(out)
    names = []
    with zipfile.ZipFile(out + ".part", "w", zipfile.ZIP_DEFLATED) as z:
        for n in ("data.md", "layout.html", "style.css"):
            if os.path.isfile(os.path.join(src, n)):
                z.write(os.path.join(src, n), n)
                names.append(n)
        for sub in ("images", "fonts"):
            folder = os.path.join(src, sub)
            for n in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
                if os.path.isfile(os.path.join(folder, n)) and not n.endswith(".bak"):
                    z.write(os.path.join(folder, n), f"{sub}/{n}")
                    names.append(f"{sub}/{n}")
        for e in exports:
            z.write(e, "export/" + os.path.basename(e))
            names.append("export/" + os.path.basename(e))
    os.replace(out + ".part", out)
    print(f"Package: {out}\n  " + "\n  ".join(names))
    return 0


VALUE_OPTS = ("out", "language", "format", "theme", "icc", "condition", "pdfx")
FLAG_OPTS = {"bleed": "bleed", "cmyk": "cmyk", "force": "force", "open": "show"}   # --flag: keyword


def main(argv):
    args, opts = [], {}
    rest = argv[1:]
    k = 0
    while k < len(rest):
        name = rest[k][2:] if rest[k].startswith("--") else None
        if name in VALUE_OPTS:
            if k + 1 >= len(rest):
                print(__doc__)
                return 1
            opts[name] = rest[k + 1]
            k += 2
        elif name in FLAG_OPTS:
            opts[FLAG_OPTS[name]] = True
            k += 1
        else:
            args.append(rest[k])
            k += 1
    if len(args) < 2:
        print(__doc__)
        return 1
    c, a = args[0], args[1:]
    export = ("format", "theme", "force", "show")
    cmds = {   # name: (function, number of positional arguments (None: 2 or more), accepted options)
        "validate": (cmd_validate, 1, ()), "fix": (cmd_fix, 1, ()), "list": (cmd_list, 1, ()),
        "show": (cmd_show, 2, ()), "replace": (cmd_replace, 3, ()), "append": (cmd_append, 2, ()),
        "images": (cmd_images, 1, ()), "pdf-to-images": (cmd_pdf_to_images, 2, ()),
        "migrate": (cmd_migrate, 1, ("out", "language")), "migrate-css": (cmd_migrate_css, 1, ("out",)),
        "pdf": (cmd_pdf, 2, export + ("bleed", "cmyk", "icc", "condition", "pdfx")),
        "epub": (cmd_epub, 2, export), "package": (cmd_package, None, ()),
    }
    if c not in cmds:
        print(__doc__)
        return 1
    fn, count, accepted = cmds[c]
    if (len(a) < 2 if count is None else len(a) != count) or any(o not in accepted for o in opts):
        print(__doc__)
        return 1
    return fn(*a, **opts)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv))
