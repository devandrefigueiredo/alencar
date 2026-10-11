# engine/ — book engine

Code shared by every book in `books/`. Nothing here is specific to one book.

```
engine/
  viewer/viewer.js            viewer: data.md parser, template filling, text fitting, search, navigation, printing, EN/PT interface
  viewer/viewer.css           viewer and page styles (dark/light themes)
  tools/book_tools.py         CLI for agents: validate, list, show, replace, append, images, fix,
                              pdf-to-images, migrate, migrate-css; export: pdf, epub, package
  templates/new-book/         skeleton of a new book (index.html + data.md + layout.html + style.css + images/)
```

## How a book loads the engine

`books/<book>/index.html` is a tiny file, identical in every book (a copy of
`templates/new-book/index.html`). It loads `../../engine/viewer/viewer.css`, then the book's own
`style.css`, and finally `viewer.js`. The viewer reloads `style.css` when the window gets focus and lays the
book out again if the computed style of the pages changed.

## The layout belongs to the book

The engine does not decide where anything goes. `viewer.css` only has the viewer interface, the physical page
(size, bleed, `--u`, `--b`, print breaks), the "missing image" placeholder and a plain fallback used while a book
has no `layout.html`. Everything else is in the book:

- `layout.html`: `<template id="...">` elements. Defaults: `page`, `opener`, `box`, `image-box`; any other id can
  be chosen in data.md with `layout:` on a chapter, page or box. The engine fills them (`fillTree`):
  `{{path}}` values, `data-if`, `data-each`, `data-slot` (boxes, body, icon, image, logo, intro), `data-image`,
  and `data-fit="--v MIN MAX [shrink%]"` regions, which `fitRegion` fits by binary search on that variable.
- `style.css`: any CSS whose selectors start at `.book` or `.theme-NAME`.

Each page is wrapped in `<section class="page odd|even [classes]" data-layout="<template id>">`; each box's root
element gets `--span`, `--rows` and, with `area:`, `--area` + `data-area`. The values a template can read are
built in `bookCtx`, `chapterCtx`, `renderPage`, `renderOpener` and `renderBox`.

`layout.html` is read like `data.md` (a `<script>` over `file://`), with its own wrapper
(`layout(function(){/* ... */});`).

`viewer.js` reads `data.md` **as a `<script>`**. That is the only way to read a sibling file over
`file://` without a server and without asking for permission: Chrome blocks `fetch`/XHR on `file://`.
For that to work, `data.md` is a polyglot:

```
<!-- BOOK FILE: DO NOT DELETE ...  ← JS: line comment (HTML-like syntax, Annex B) | MD: opens an HTML comment
book(function(){/*                 ← JS: calls book() and opens a block comment
-->                                ← MD: closes the HTML comment
...the book's markdown...
<!--
*/});                              ← JS: closes the comment and the call
-->                                ← JS: line comment (HTMLCloseComment) | MD: closes the comment
```

`book(fn)` gets the text back with `fn.toString()`. The only content restriction is that it must not
contain `*/`. Files with the old wrapper (`livro(function(){/*`) still load. Imported files may be plain
Markdown: the viewer adds the wrapper. The viewer re-reads `data.md` every 2.5 s (script with
`?v=timestamp`), so it notices by itself when the file is saved again.

Writing (saving a dropped image, Import with a backup in `versions/`) uses the File System Access API
(Chrome/Edge) and asks for the folder once. Reading does not depend on it.

## Interface language

The interface follows the browser language: Portuguese for `pt*`, English otherwise (`STRINGS`,
`PROBLEMS`, `KIND_LABEL` in `viewer.js`). Labels printed inside the book ("Chapter", "In this chapter")
follow the book's `language:` property instead (`BOOK_LABELS`). The "Copy for AI" report is always in
English, because agent instructions are English.

## Safety

- Book text is escaped first; `inline()` only adds back `strong`, `em`, `code` and `https:` links.
- Image paths must stay inside the book folder (`safePath`: relative, no `..`, no scheme).
- Images saved through the viewer must be real PNG/JPEG/WebP (checked by their bytes, not by name).
- Templates are parsed inert (`DOMParser`) and sanitized (`cleanTemplate`): only structural HTML and simple
  SVG, only `class`, `style`, SVG geometry and `data-*` attributes, no `url()`. Values are inserted escaped;
  in attributes only into `class` (as names) and `data-*`.
- In app mode `style.css` is rebuilt by `cleanCss`: selectors must start at the book (`.book`/`.theme-NAME`) and
  cannot jump out with `+`/`~`; no `url()`, `image-set()`, `@import`, `expression()` (escapes decoded first).
  `#view` and `#pv` have `contain: paint`, so nothing in a book can draw over the viewer. In local mode
  `style.css` is a plain `<link>` (its text cannot be read over `file://`); `book_tools.py validate` applies
  the same rules.
- Custom fonts: the only `url()` allowed is in `@font-face` `src`, naming `fonts/<lowercase-name>.woff2|woff|ttf|otf`
  (`FONT_PATH`/`FONT_SRC` in `viewer.js`, `FONT_PATH_RE`/`FONT_SRC_RE` in `book_tools.py`). In app mode the file
  must be a real font (checked by its first bytes, `isFont`) and the `url()` is rewritten to its `blob:` URL; the
  app's CSP has `font-src 'self' blob:`. In local mode the `<link>` loads it directly (Chrome allows fonts over
  `file://` from the same folder). The text is fitted after the fonts load (`fontsReady`); a face that failed or a
  file that is not in the book becomes a STYLE problem (`font-file`).

## Fitting and printing

- Page size in mm (`--pw`, `--ph`, `--bl` for bleed). Print sizes: the `FORMATS` list in `viewer.js`. Printing
  injects `@page { size }`.
- `fitPage` fits every `data-fit` region of the page. A region that does not fit at its minimum flags the
  page OVERFLOW and goes into the problems report; regions measured in pt feed the FONT SIZE note.

## Export (book_tools.py pdf / epub)

The book is never laid out by Python: `pdf` and `epub` copy the book's own files (data.md, layout.html,
style.css, real images in `images/`, real fonts in `fonts/`) and `viewer/` into a temporary folder and open
`index.html?export=pdf|epub&format=..&bleed=0|1&theme=..` in a headless Chrome/Edge with no network
(`--host-resolver-rules`) and a time budget (`--virtual-time-budget`). In that mode (`EXPORT` in `viewer.js`)
size, bleed and theme come from the address instead of saved preferences, and after `render` the viewer writes a
JSON report into a `<script id="book-export">` (`exportReport`): the problems in English, the size, the table of
contents and, for EPUB, every page serialized as XHTML. A first `--dump-dom` run reads the report; the tool stops
on errors.

- PDF: a second run with `--print-to-pdf` (the viewer's `@page` size and print CSS). With `--cover-pdf` it runs
  twice, with `part=interior` and `part=cover`: the viewer hides the other pages (`.page.skip`) before printing.
  The cover page is the one `cover:` names (default: the first page); it takes no page number (`renderPage`). `--cmyk` passes it through
  Ghostscript: PDF/X-4 (or 3) in CMYK with an output intent (`--icc`, or Ghostscript's `default_cmyk.icc`), links
  dropped (PDF/X forbids annotations), TrimBox/BleedBox set page by page by an `EndPage` procedure (Ghostscript
  ignores `PDFXTrimBoxToMediaBoxOffset` for PDF input).
- EPUB: one fixed-layout XHTML per page (`rendition:layout pre-paginated`, viewport = page size in px) with
  `engine.css` — the part of `viewer.css` between `EXPORT:BEGIN` and `EXPORT:END` — plus the book's `style.css`,
  the images the pages use and the fonts `style.css` names. Every page is parsed as XML before it goes in.
  EPUBCheck runs when `BOOK_EPUBCHECK` (jar or program) or `epubcheck` is available.

## Test

```
python engine/tools/book_tools.py validate books/the-art-of-lorem-ipsum-en/data.md
python engine/tools/book_tools.py pdf books/the-art-of-lorem-ipsum-en/data.md test.pdf --format 6x9in --bleed --cmyk
python engine/tools/book_tools.py epub books/the-art-of-lorem-ipsum-en/data.md test.epub
```
For the visuals, open `books/the-art-of-lorem-ipsum-en/index.html` in Chrome.

## Changing the data.md format

The accepted properties live in three places that must move together:
`KEYS`/`ICONS`/`WIDTHS` in `viewer.js`, the matching tables in `book_tools.py`, and the format
tables in `agent/AGENTS.md`. The template language (values, slots, `data-*` directives) and the layout/CSS
rules live in `viewer.js`, in `check_layout`/`check_style` of `book_tools.py` and in section 8 of
`agent/AGENTS.md`; change them together too. The sample layout is in `books/*/layout.html` + `style.css` and
`templates/new-book/` (all copies of the same files).
