# alencar — book workspace

Your book lives in a plain text file (`data.md`). An AI assistant (ChatGPT, Claude, Gemini or any other) writes
that file, and the viewer lays out the pages automatically: no misaligned boxes, no waiting for the AI to draw a PDF.
In this first version **every change comes from the AI**; the viewer is for previewing and printing.

## What is in this folder

```
README.md                        this guide
agent/AGENTS.md                  instructions for AI assistants (published as /agents.md)
site/                            the website, made for AI agents: home = AGENTS.md, reference books, viewer at /app/
.github/workflows/pages.yml      publishes the site to GitHub Pages
engine/                          the "engine" that builds the pages — do not change it
  tools/book_tools.py            helper tool the AI uses to check and edit the book
  templates/new-book/            empty book to start a new one
books/
  the-art-of-lorem-ipsum-en/     sample book in English (placeholder text, public-domain photos)
    index.html                   open this to see the book without the website
    data.md                      the book's content (the AI writes it)
    layout.html                  the book's layout: how each kind of page and box is built (the AI writes it)
    style.css                    the book's look: positions, sizes, colors and fonts (the AI writes it)
    images/                      the book's images (CREDITS.md lists their sources)
    fonts/                       optional: font files the book uses (when it needs fonts not installed everywhere)
```

**Important:** do not rearrange the folders. Each book's `index.html` looks for the engine in `engine/`.

**The layout belongs to the book, not to the engine.** The engine reads `data.md`, fills the templates of the
book's `layout.html` and fits the text to the page; where things go and how they look is decided only by that
book's `layout.html` and `style.css`. The sample books are one example of a layout: an AI can copy it and change
anything, or design a completely different one.

## 1. Open a book

On the website, open the viewer at `/app/` and drop what your AI gave you: the zip, the files
(`data.md`, `layout.html`, `style.css`, images) or the book folder. Nothing is uploaded: the book is opened inside your browser.
If you open a **folder**, the preview updates by itself whenever your AI saves a file there.

Without the website: double-click `books/<book>/index.html`. Use **Google Chrome** or **Microsoft Edge**.

The toolbar at the top:

| Button | What it does |
|---|---|
| **Contents** | List of chapters and pages. Click one to jump to it. |
| **‹ page ›** | Changes page. Type a number and press Enter. The keyboard arrows also work. |
| **− / + / Fit** | Zoom out, zoom in, fit the page to the window. |
| **Search** | Finds a word in the whole book (Ctrl+F). Enter jumps to the next match. |
| **Problems** | Lists what needs attention: text that does not fit, missing images, mistakes in data.md. Has a **Copy for AI** button. |
| **Reload** | Reads the book again (the viewer also notices changes on its own). |
| **Open** (website) | Opens another book: files, a zip or a folder. |
| **⚙ (gear)** | Settings: interface language (PT / EN). The default follows your browser; English otherwise. |
| **Print / PDF** | Choose the page size and print or save as PDF. |

## 2. Working with an AI

1. Tell your AI: "Read https://github.com/devandrefigueiredo/alencar and follow agent/AGENTS.md to help me write a book about …". That file is written
   for the AI: it explains the format and points to the reference book the AI must follow. If your AI cannot open links, attach `agent/AGENTS.md` (and, if it can run Python,
   `engine/tools/book_tools.py`). Some AIs (ChatGPT, for one) can read the web but cannot download into the place
   where they run code; for them, download https://github.com/devandrefigueiredo/alencar/archive/refs/heads/main.zip
   (this whole folder in one zip) and attach it from the start.
   Starting from just an idea is fine: the AI interviews you in short rounds (each question comes with a suggestion;
   reply "ok" to accept), shows you the plan and the chapter list, delivers a sample page, then writes chapter by
   chapter. After the sample and after each chapter it asks whether you want to check the next one (for example
   "chapter 2") or let it write the rest without stopping and come back when the whole book is done. Each time it gives you a PDF, to see the result (`<title>_sample.pdf`, `<title>_chapter3.pdf`,
   `<title>.pdf`), and `<title>.zip`, to attach to your next request. The plan is saved inside `data.md` (as a hidden comment), so another chat or AI can continue later.
   The interview approach is adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills) (MIT).
2. To change an existing book, also attach its current `data.md` (and `layout.html` + `style.css` when the change
   is about the look or the layout).
3. Ask in your own language, for example:
   - "On page 1.4, replace the Takeaway text with this: ..."
   - "Write page 1.5 about topic X, in the same style."
   - "Here is the PDF of chapter 3. Add it to the book." (attach the PDF)
   - "Make the book white." / "Change the green to blue."
   - "Put the page title at the bottom and the boxes in two columns." / "Design a new chapter opener."
   - "Generate the missing images."
4. The AI gives you files to download (ideally one zip with `data.md`, `layout.html`, `style.css` and `images/`).
   When the book is finished and the AI can run the tool, it also gives you the book's PDF.
5. Open them in the viewer (or save them into the book folder you opened there).
6. If **Problems** shows something, click **Copy for AI** and paste it into the chat. The AI fixes it.

AI assistants that can open this folder (for example Claude Code or similar tools) can edit the book files
directly; just tell them to follow `agent/AGENTS.md`.

## 3. Images

Each image has an exact file name, for example `1-1-logo.png` (PNG, JPG or WebP). Ask your AI for the missing ones
and keep them in the book's `images` folder (or inside the zip) with exactly that name. The **Problems** panel lists
every missing image with its name, size and the description (prompt) to generate it.

## 3.1 Fonts

By default a book uses fonts installed on the computer. For a font that is not (from Google Fonts, for example),
ask your AI to use it: the font file goes in the book's `fonts` folder (or inside the zip), and `style.css` points
to it. If a font file is missing or broken, **Problems** says which one.

## 4. Printing or saving a PDF

Click **Print / PDF** and pick a page size:

| For | Size |
|---|---|
| Printing at home or in the office | **A4** or **Letter** |
| A print shop (metric sizes) | **14 × 21 cm**, **15.6 × 23.4 cm**, **16 × 23 cm**, **17 × 24 cm** or **B5** |
| Print-on-demand (Amazon KDP, IngramSpark, Lulu…) | **6 × 9 in** (most common) or **8.5 × 11 in** (best for a visual book) |
| Any other size | ask your AI to set it as the book's size (for example "15 x 22 cm"); it appears first, marked as the book default |

For a print shop or a print-on-demand service, tick **Add bleed**. Then click **Print / Save PDF**. In the browser's print window:
- **Destination:** **Save as PDF** (or your printer).
- Under **More settings:** **Margins = None** and tick **Background graphics**.

### 4.1 Files for a print shop, a store or an e-book (AI with this folder)

An AI that works in this folder (a coding agent) makes the final files itself and asks first where the book is
going. You can also run the commands yourself (Google Chrome or Microsoft Edge must be installed):

```
python engine/tools/book_tools.py name books/<book>/data.md                                   (<name>: the title in lowercase, no accents)
python engine/tools/book_tools.py pdf  books/<book>/data.md <name>_chapter3.pdf --chapter 3     (one chapter, to review it)
python engine/tools/book_tools.py pdf  books/<book>/data.md <name>.pdf                         (screen, home printer)
python engine/tools/book_tools.py pdf  books/<book>/data.md <name>_print.pdf --bleed --cmyk     (print shop, print-on-demand)
python engine/tools/book_tools.py pdf  books/<book>/data.md <name>_print.pdf --cover-pdf <name>_cover.pdf  (the cover in its own file)
python engine/tools/book_tools.py epub books/<book>/data.md <name>.epub                        (Apple Books, Kobo, Google Play…)
python engine/tools/book_tools.py package books/<book>/data.md <name>.zip <name>_print.pdf <name>.epub  (everything in one zip)
python engine/tools/book_tools.py unpack  <name>.zip books/<book>                               (a book zip back into a folder)
```

`--cmyk` makes a PDF/X-4 in CMYK and needs [Ghostscript](https://ghostscript.com/releases/gsdnld.html); add
`--icc profile.icc` with the colour profile your print shop gives you. `--format 6x9in` changes the page size
for that file only. Add `--open` to see the result.

Every book starts with a cover page (the page before chapter 1). Stores such as Amazon KDP ask for the cover
as a separate file: `--cover-pdf` takes it out of the book's PDF and saves it on its own.

## 5. Starting a new book

1. Copy the folder `engine/templates/new-book` into `books/` and rename it (e.g. `books/my_second_book`).
2. Open its `index.html`.
3. Ask the AI to fill it, attaching that folder's `data.md`.

## 6. Migrating an old book (Portuguese format)

Books made with the earlier version (files `data.md` + `estilo.css`, keys like `livro:`, `autor:`, `largura:`)
can be converted. From this folder, run:

```
python engine/tools/book_tools.py migrate books/<book>/data.md
python engine/tools/book_tools.py migrate-css books/<book>/estilo.css
```

Then make sure the book folder has a `style.css` and open its `index.html` to check. The book's text is not
translated — only the format changes. If you prefer, ask an AI that can run Python to do it for you.

Books made before the layout moved into the book (a `style.css` with only colors and sizes, no `layout.html`)
open with a plain fallback layout. To get the sample's layout back, copy `layout.html` from
`engine/templates/new-book/` into the book folder and add sections 4 to 11 of that template's `style.css` to the
book's `style.css` (keep the book's own values in sections 1 to 3).

## 7. The website

```
python site/build.py              # builds _site/
python -m http.server -d _site    # preview at http://localhost:8000
```

`.github/workflows/pages.yml` validates the samples, builds `_site/` and publishes it with GitHub Pages on every
push to `main`. Host it on its own origin (its own repository/organization or a custom domain), not under a
`user.github.io` that serves other projects: the viewer keeps folder permissions per origin.
