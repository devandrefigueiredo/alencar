/* =====================================================================
   BOOK VIEWER ENGINE — version 2.0
   Shared by every book (engine/ folder). Each book has a tiny index.html that
   loads this file, a data.md with the content and a style.css with its look.
   Nothing here needs to change to edit a book.
   ===================================================================== */
"use strict";

/* =====================================================================
   MODE
   local: index.html inside a book folder, opened with a double click (file://)
   app:   the site's viewer page (window.BOOK_APP). The book comes from files,
          a zip or a folder the user opens, or from a published sample.
          Nothing is ever uploaded.
   ===================================================================== */
const APP = !!window.BOOK_APP;
const EDITING = false;   // MVP: every edit comes from the agent; writing into the book folder stays hidden
/* export: book_tools.py (pdf / epub commands) opens index.html?export=pdf|epub&format=..&bleed=1&theme=..
   in a headless browser. Size, bleed and theme then come from the address, not from saved preferences,
   and once the book is laid out the engine writes a JSON report into the page (exportReport). */
const EXPORT = (() => { if (APP) return null; const q = new URLSearchParams(location.search); return q.has("export") ? q : null; })();

/* Never run inside someone else's frame (clickjacking) */
if (window.top !== window.self) { document.documentElement.innerHTML = ""; throw new Error("framed"); }

/* =====================================================================
   INTERFACE LANGUAGE (EN, PT, ES, FR, DE)
   Saved choice first, then the first supported browser language; English is
   the default. A string missing in a language falls back to English.
   Only the viewer's own interface is translated. The labels printed inside
   the book follow the book's "language:" property instead.
   ===================================================================== */
const LANG_KEY = "ui-lang";
const savedLang = (() => { try { return localStorage.getItem(LANG_KEY); } catch { return null; } })();
const UI_LANGS = ["en", "pt", "es", "fr", "de"];
const UI_LANG = UI_LANGS.includes(savedLang) ? savedLang
  : (navigator.languages || [navigator.language || "en"]).map(l => String(l).slice(0, 2).toLowerCase()).find(l => UI_LANGS.includes(l)) || "en";

const STRINGS = {
  en: {
    contents: "Contents", prevPage: "Previous page (←)", nextPage: "Next page (→)", pageField: "Type a page number and press Enter",
    zoomOut: "Zoom out", zoomIn: "Zoom in", fit: "Fit", fitTitle: "Show the whole page", search: "Search the book…  (Ctrl+F)",
    prevHit: "Previous (Shift+Enter)", nextHit: "Next (Enter)", problems: "Problems", problemsTitle: "Problems found in the layout and in data.md",
    reload: "Reload", reloadTitle: "Read data.md again", import: "Import", importTitle: "Replace data.md, style.css or an image with a file (e.g. the one your AI sent)",
    print: "Print / PDF", printTitle: "Print or save as PDF (Ctrl+P)", problemsHead: "Problems and to-dos", copyForAi: "Copy for AI",
    copyForAiTitle: "Copies a ready-made report to paste into your AI chat", close: "Close", openBook: "Open the book",
    printHead: "Print or save as PDF", printIntro: "Choose the page size. The book is laid out again for that size right away — check the preview before printing.",
    pageSize: "1. Page size", printSettings: "2. Settings", bleed: "Add bleed",
    bleedHelp: "Extra 3 mm around the page that the printer trims off. Required by print shops and Amazon KDP (0.125 in = 3.2 mm) when color or images reach the edge. Don't use it for home printing.",
    colors: "Colors", asInBook: "As set in the book", darkBg: "Dark background", lightBg: "Light background (uses less ink)",
    pages: "Pages", from: "from", to: "to", preview: "Preview", howtoHead: "3. In the print window that opens:",
    howto1: "In <b>Destination</b>, choose <b>Save as PDF</b> to create the file — or choose your printer.",
    howto2: "Open <b>More settings</b>: Margins = <b>None</b>, Scale = <b>Default</b>, and tick <b>Background graphics</b>.",
    howto3: "For home printing choose <b>A4</b> or <b>Letter</b>. For a print shop or a print-on-demand service, send the PDF and check their rules (minimum margins, page count, cover).",
    printGo: "Print / Save PDF", book: "Book",
    fmtGroups: {book: "Defined by this book", screen: "Screen", office: "Home and office printers", trade: "Book sizes in inches (print-on-demand: Amazon KDP, IngramSpark, Lulu…)", metric: "Book sizes in centimetres (print shops)"},
    fmtDesc: {original: "Compact page for reading on screen.", a4: "Standard paper in most of the world. Large, easy-to-read text.", letter: "Standard paper in North America.",
      a5: "Half an A4 sheet. Handouts, notebooks, small guides.", "5x8in": "Novels and short non-fiction.", "5.5x8.5in": "Memoirs, guides, poetry.",
      "6x9in": "The most common paperback size for non-fiction.", "7x10in": "Manuals, textbooks and workbooks.", "8x10in": "Illustrated and children's books.",
      "8.5x11in": "Largest common size: workbooks and visual, infographic-style books.", "14x21cm": "Common paperback size in many countries.",
      "15.6x23.4cm": "\"Royal\" size: non-fiction and biographies.", "16x23cm": "Technical and non-fiction books.", "17x24cm": "Textbooks and courses.", b5: "Larger textbooks and magazines."},
    letter: "Letter", screenName: "Screen", custom: "Custom size", setInData: "Defined by this book", bookDefault: "book default",
    allPages: n => `All (${n})`, curPage: n => `Current page only (${n})`, chapterOpt: (n, t) => `Chapter ${n}${t ? " — " + t : ""}`, rangeOpt: "Choose a range…",
    pvNote: (n, f, b) => `${n} page(s) at <b>${f}</b>${b ? " with bleed" : ""}. Preview of the first 3.`,
    pvOver: n => `${n} page(s) with too much text at this size — see "Problems".`,
    hitOf: (a, b) => `${a} of ${b}`, noPage: v => `Page "${v}" does not exist.`, openerToc: "Chapter opener",
    laying: "Laying out the pages…", missingImg: "Missing image", noName: "(no name)", sizeIs: s => `Size: ${s}. `,
    dropHere: "Drag the image here or click to choose.", saveWithName: "Save the image with this name in the book folder.",
    imgSaved: p => `Image saved to <b>${p}</b>`, imgFail: m => `Could not save the image: ${m}`, dropOnSlot: "Drop the image onto a \"Missing image\" placeholder.",
    noProblems: "No problems found. 🎉", missingImgKind: "MISSING IMAGE", promptIs: p => `Prompt: ${p}`, noPrompt: "No image prompt in data.md.",
    copied: "Report copied. Paste it into your AI chat together with data.md.", copiedShort: "Report copied.",
    needChrome: "To save files from the viewer use Google Chrome or Microsoft Edge. You can also save the file straight into the book folder.",
    pickFolder: r => `${r}\n\nThe browser will ask you to choose the book folder (the one with this index.html) and allow editing. This is needed only once.`,
    noDataInFolder: n => `The folder "${n}" has no data.md file. Choose the book folder (the same one as index.html).`,
    whyImg: "To save the image inside the book folder, the viewer needs permission to write to it.",
    whyData: "To replace the book's data.md with the chosen file, the viewer needs permission to write to the book folder.",
    whyCss: "To replace the book's style.css with the chosen file, the viewer needs permission to write to the book folder.",
    cssReplaced: s => `style.css replaced. The previous version was kept in <b>versions/style-${s}.css</b>.`,
    dataReplaced: s => `data.md replaced. The previous version was kept in <b>versions/data-${s}.md</b>.`,
    saveFail: m => `Could not save: ${m}`, notABook: n => `"${n}" does not look like a book data.md (no chapter "# 1: Title" found). Use it anyway?`,
    showingOnly: n => `Showing “${n}” in this window only. To keep it, replace the data.md in the book folder with this file.`,
    reloaded: "Book reloaded.", updated: "data.md updated.", layoutUpdated: "layout.html updated.",
    noDataTitle: "data.md not found",
    noDataBody: `<p>This viewer looks for a file called <b>data.md</b> in the same folder as this <b>index.html</b>, and did not find it.</p>
      <p>Check that the file exists and that its name is exactly <b>data.md</b> (downloads sometimes become “data (1).md” or “data.md.txt”).</p>`,
    retry: "Try again", brokenTitle: "The start or the end of data.md is damaged",
    brokenBody: (top, end) => `<p>The book is in data.md, but the fixed lines at the start or at the end of the file are missing (or the text contains the characters <b>*/</b>, which are not allowed).</p>
      <p>The file must <b>start</b> with these 3 lines:</p><pre class="code">${top}</pre>
      <p>and <b>end</b> with these 3:</p><pre class="code">${end}</pre>
      <p class="muted">Tip: use the button below to choose the data.md — the viewer repairs these lines by itself.</p>`,
    fixBtn: "Choose data.md and repair",
    open: "Open", openTitle: "Open your book: the files your AI gave you (data.md, style.css, images), a zip or a folder",
    settings: "Settings", language: "Language", askAi: "Ask your AI for this image, with exactly this name.",
    appTitle: "Open your book", appIntro: "Drop here what your AI gave you: <b>data.md</b>, <b>style.css</b> and the <b>images</b> — or a <b>.zip</b> with all of them, or the book folder. Everything stays on your computer: nothing is uploaded.",
    chooseFiles: "Choose files or zip", chooseFolder: "Choose folder", folderLive: "With a folder, the preview updates by itself whenever your AI saves a file.",
    orSample: "No book yet? Look at a sample:", sampleEn: "The Art of Lorem Ipsum", home: "Back to the home page",
    zipError: "This zip could not be read.", tooBig: "A file in this book is too big to open (up to 150 MB per image and 20 MB per text file).",
    noMd: "No data.md was found in what you opened.", opened: n => `Opened: ${n}.`
  },
  pt: {
    contents: "Sumário", prevPage: "Página anterior (←)", nextPage: "Próxima página (→)", pageField: "Digite o número da página e aperte Enter",
    zoomOut: "Diminuir zoom", zoomIn: "Aumentar zoom", fit: "Ajustar", fitTitle: "Mostrar a página inteira na tela", search: "Procurar no livro…  (Ctrl+F)",
    prevHit: "Anterior (Shift+Enter)", nextHit: "Próximo (Enter)", problems: "Problemas", problemsTitle: "Problemas encontrados na diagramação e no data.md",
    reload: "Recarregar", reloadTitle: "Ler o data.md de novo", import: "Importar", importTitle: "Trocar o data.md, o style.css ou uma imagem por um arquivo (ex.: o que sua IA mandou)",
    print: "Imprimir / PDF", printTitle: "Imprimir ou gerar PDF (Ctrl+P)", problemsHead: "Problemas e pendências", copyForAi: "Copiar para a IA",
    copyForAiTitle: "Copia um relatório pronto para colar na conversa com sua IA", close: "Fechar", openBook: "Abrir o livro",
    printHead: "Imprimir ou gerar PDF", printIntro: "Escolha o tamanho da página. O livro é rediagramado na hora para o tamanho escolhido — confira a prévia antes de imprimir.",
    pageSize: "1. Tamanho da página", printSettings: "2. Ajustes", bleed: "Adicionar sangria",
    bleedHelp: "Margem extra de 3 mm em volta da página, que a gráfica corta depois. Exigida por gráficas e pela Amazon KDP (0,125 pol. = 3,2 mm) quando há cor ou imagem até a borda. Não use para imprimir em casa.",
    colors: "Cores", asInBook: "Como definido no livro", darkBg: "Fundo escuro", lightBg: "Fundo claro (gasta menos tinta)",
    pages: "Páginas", from: "de", to: "até", preview: "Prévia", howtoHead: "3. Na janela de impressão que vai abrir:",
    howto1: "Em <b>Destino</b>, escolha <b>Salvar como PDF</b> para gerar o arquivo — ou escolha sua impressora.",
    howto2: "Abra <b>Mais definições</b>: Margens = <b>Nenhuma</b>, Escala = <b>Padrão</b>, e marque <b>Gráficos de plano de fundo</b>.",
    howto3: "Para imprimir em casa, escolha <b>A4</b> ou <b>Carta</b>. Para uma gráfica ou um serviço de impressão sob demanda, envie o PDF e confira as regras do serviço (margens mínimas, número de páginas, capa).",
    printGo: "Imprimir / Salvar PDF", book: "Livro",
    fmtGroups: {book: "Definido por este livro", screen: "Tela", office: "Impressoras de casa e escritório", trade: "Tamanhos de livro em polegadas (impressão sob demanda: Amazon KDP, IngramSpark, Lulu…)", metric: "Tamanhos de livro em centímetros (gráficas)"},
    fmtDesc: {original: "Página compacta para ler na tela.", a4: "Papel padrão na maior parte do mundo. Letra grande e fácil de ler.", letter: "Papel padrão na América do Norte.",
      a5: "Meia folha A4. Apostilas, cadernos, guias pequenos.", "5x8in": "Romances e não ficção curta.", "5.5x8.5in": "Memórias, guias, poesia.",
      "6x9in": "O tamanho mais comum de brochura de não ficção.", "7x10in": "Manuais, livros didáticos e de exercícios.", "8x10in": "Livros ilustrados e infantis.",
      "8.5x11in": "Maior tamanho comum: livros de exercícios e livros visuais/infográficos.", "14x21cm": "Tamanho comum de brochura em muitos países.",
      "15.6x23.4cm": "Tamanho \"Royal\": não ficção e biografias.", "16x23cm": "Livros técnicos e de não ficção.", "17x24cm": "Livros didáticos e cursos.", b5: "Livros didáticos maiores e revistas."},
    letter: "Carta", screenName: "Tela", custom: "Tamanho personalizado", setInData: "Definido por este livro", bookDefault: "padrão do livro",
    allPages: n => `Todas (${n})`, curPage: n => `Só a página atual (${n})`, chapterOpt: (n, t) => `Capítulo ${n}${t ? " — " + t : ""}`, rangeOpt: "Escolher intervalo…",
    pvNote: (n, f, b) => `${n} página(s) no formato <b>${f}</b>${b ? " com sangria" : ""}. Prévia das 3 primeiras.`,
    pvOver: n => `${n} página(s) com texto sobrando neste formato — veja "Problemas".`,
    hitOf: (a, b) => `${a} de ${b}`, noPage: v => `Página "${v}" não existe.`, openerToc: "Abertura do capítulo",
    laying: "Diagramando as páginas…", missingImg: "Imagem pendente", noName: "(sem nome)", sizeIs: s => `Tamanho: ${s}. `,
    dropHere: "Arraste a imagem para cá ou clique para escolher.", saveWithName: "Salve a imagem com este nome na pasta do livro.",
    imgSaved: p => `Imagem salva em <b>${p}</b>`, imgFail: m => `Não consegui salvar a imagem: ${m}`, dropOnSlot: "Solte a imagem em cima de um espaço de \"Imagem pendente\".",
    noProblems: "Nenhum problema encontrado. 🎉", missingImgKind: "IMAGEM PENDENTE", promptIs: p => `Prompt: ${p}`, noPrompt: "Sem prompt de imagem no data.md.",
    copied: "Relatório copiado. Cole na conversa com sua IA junto com o data.md.", copiedShort: "Relatório copiado.",
    needChrome: "Para salvar arquivos pelo visualizador use Google Chrome ou Microsoft Edge. Você também pode salvar o arquivo direto na pasta do livro.",
    pickFolder: r => `${r}\n\nO navegador vai pedir para você escolher a pasta do livro (a pasta onde está este index.html) e permitir a edição. Isso só é preciso uma vez.`,
    noDataInFolder: n => `A pasta "${n}" não tem o arquivo data.md. Escolha a pasta do livro (a mesma do index.html).`,
    whyImg: "Para salvar a imagem dentro da pasta do livro, o visualizador precisa de permissão para gravar nela.",
    whyData: "Para trocar o data.md do livro pelo arquivo escolhido, o visualizador precisa de permissão para gravar na pasta do livro.",
    whyCss: "Para trocar o style.css do livro pelo arquivo escolhido, o visualizador precisa de permissão para gravar na pasta do livro.",
    cssReplaced: s => `style.css trocado. A versão anterior foi guardada em <b>versions/style-${s}.css</b>.`,
    dataReplaced: s => `data.md trocado. A versão anterior foi guardada em <b>versions/data-${s}.md</b>.`,
    saveFail: m => `Não consegui salvar: ${m}`, notABook: n => `O arquivo "${n}" não parece um data.md de livro (não achei nenhum capítulo "# 1: Título"). Usar mesmo assim?`,
    showingOnly: n => `Mostrando “${n}” só nesta janela. Para ficar salvo, substitua o data.md da pasta do livro por este arquivo.`,
    reloaded: "Livro recarregado.", updated: "data.md atualizado.", layoutUpdated: "layout.html atualizado.",
    noDataTitle: "Não encontrei o data.md",
    noDataBody: `<p>Este visualizador procura o arquivo <b>data.md</b> na mesma pasta deste <b>index.html</b>, e não achou.</p>
      <p>Confira se o arquivo existe e se o nome é exatamente <b>data.md</b> (às vezes o download vira “data (1).md” ou “data.md.txt”).</p>`,
    retry: "Tentar de novo", brokenTitle: "O data.md está com o começo ou o fim estragado",
    brokenBody: (top, end) => `<p>O livro está no data.md, mas faltam as linhas fixas do começo ou do fim do arquivo (ou o texto tem os caracteres <b>*/</b>, que não são permitidos).</p>
      <p>O arquivo precisa <b>começar</b> com estas 3 linhas:</p><pre class="code">${top}</pre>
      <p>e <b>terminar</b> com estas 3:</p><pre class="code">${end}</pre>
      <p class="muted">Dica: use o botão abaixo para escolher o data.md — o visualizador conserta essas linhas sozinho.</p>`,
    fixBtn: "Escolher o data.md e consertar",
    open: "Abrir", openTitle: "Abrir seu livro: os arquivos que sua IA entregou (data.md, style.css, imagens), um zip ou uma pasta",
    settings: "Configurações", language: "Idioma", askAi: "Peça esta imagem à sua IA, exatamente com este nome.",
    appTitle: "Abra seu livro", appIntro: "Solte aqui o que sua IA entregou: <b>data.md</b>, <b>style.css</b> e as <b>imagens</b> — ou um <b>.zip</b> com tudo, ou a pasta do livro. Tudo fica no seu computador: nada é enviado.",
    chooseFiles: "Escolher arquivos ou zip", chooseFolder: "Escolher pasta", folderLive: "Com uma pasta, a prévia se atualiza sozinha sempre que sua IA salvar um arquivo.",
    orSample: "Ainda não tem um livro? Veja um exemplo:", sampleEn: "The Art of Lorem Ipsum (em inglês)", home: "Voltar para a página inicial",
    zipError: "Não consegui ler este zip.", tooBig: "Um arquivo deste livro é grande demais para abrir (até 150 MB por imagem e 20 MB por arquivo de texto).",
    noMd: "Não achei nenhum data.md no que você abriu.", opened: n => `Aberto: ${n}.`
  },
  es: {
    contents: "Índice", prevPage: "Página anterior (←)", nextPage: "Página siguiente (→)", pageField: "Escribe un número de página y pulsa Enter",
    zoomOut: "Reducir", zoomIn: "Ampliar", fit: "Ajustar", fitTitle: "Mostrar la página completa", search: "Buscar en el libro…  (Ctrl+F)",
    prevHit: "Anterior (Shift+Enter)", nextHit: "Siguiente (Enter)", problems: "Problemas", problemsTitle: "Problemas encontrados en la maquetación y en data.md",
    reload: "Recargar", reloadTitle: "Volver a leer data.md", import: "Importar", importTitle: "Sustituir data.md, style.css o una imagen por un archivo (p. ej., el que te envió tu IA)",
    print: "Imprimir / PDF", printTitle: "Imprimir o guardar como PDF (Ctrl+P)", problemsHead: "Problemas y pendientes", copyForAi: "Copiar para la IA",
    copyForAiTitle: "Copia un informe listo para pegar en el chat con tu IA", close: "Cerrar", openBook: "Abrir el libro",
    printHead: "Imprimir o guardar como PDF", printIntro: "Elige el tamaño de página. El libro se vuelve a maquetar al instante para ese tamaño — revisa la vista previa antes de imprimir.",
    pageSize: "1. Tamaño de página", printSettings: "2. Ajustes", bleed: "Añadir sangrado",
    bleedHelp: "3 mm extra alrededor de la página que la imprenta recorta después. Lo exigen las imprentas y Amazon KDP (0,125 in = 3,2 mm) cuando el color o las imágenes llegan hasta el borde. No lo uses para imprimir en casa.",
    colors: "Colores", asInBook: "Como se define en el libro", darkBg: "Fondo oscuro", lightBg: "Fondo claro (gasta menos tinta)",
    pages: "Páginas", from: "de", to: "a", preview: "Vista previa", howtoHead: "3. En la ventana de impresión que se abre:",
    howto1: "En <b>Destino</b>, elige <b>Guardar como PDF</b> para crear el archivo — o elige tu impresora.",
    howto2: "Abre <b>Más ajustes</b>: Márgenes = <b>Ninguno</b>, Escala = <b>Predeterminado</b>, y marca <b>Gráficos de fondo</b>.",
    howto3: "Para imprimir en casa, elige <b>A4</b> o <b>Carta</b>. Para una imprenta o un servicio de impresión bajo demanda, envía el PDF y revisa sus requisitos (márgenes mínimos, número de páginas, cubierta).",
    printGo: "Imprimir / Guardar PDF", book: "Libro",
    fmtGroups: {book: "Definido por este libro", screen: "Pantalla", office: "Impresoras de casa y oficina", trade: "Tamaños de libro en pulgadas (impresión bajo demanda: Amazon KDP, IngramSpark, Lulu…)", metric: "Tamaños de libro en centímetros (imprentas)"},
    fmtDesc: {original: "Página compacta para leer en pantalla.", a4: "Papel estándar en casi todo el mundo. Texto grande y fácil de leer.", letter: "Papel estándar en Norteamérica.",
      a5: "Media hoja A4. Apuntes, cuadernos, guías pequeñas.", "5x8in": "Novelas y no ficción breve.", "5.5x8.5in": "Memorias, guías, poesía.",
      "6x9in": "El tamaño de rústica más habitual para no ficción.", "7x10in": "Manuales, libros de texto y cuadernos de ejercicios.", "8x10in": "Libros ilustrados e infantiles.",
      "8.5x11in": "El mayor tamaño habitual: cuadernos de ejercicios y libros visuales tipo infografía.", "14x21cm": "Tamaño de rústica habitual en muchos países.",
      "15.6x23.4cm": "Tamaño \"Royal\": no ficción y biografías.", "16x23cm": "Libros técnicos y de no ficción.", "17x24cm": "Libros de texto y cursos.", b5: "Libros de texto más grandes y revistas."},
    letter: "Carta", screenName: "Pantalla", custom: "Tamaño personalizado", setInData: "Definido por este libro", bookDefault: "predeterminado del libro",
    allPages: n => `Todas (${n})`, curPage: n => `Solo la página actual (${n})`, chapterOpt: (n, t) => `Capítulo ${n}${t ? " — " + t : ""}`, rangeOpt: "Elegir un intervalo…",
    pvNote: (n, f, b) => `${n} página(s) en <b>${f}</b>${b ? " con sangrado" : ""}. Vista previa de las 3 primeras.`,
    pvOver: n => `${n} página(s) con demasiado texto en este tamaño — consulta "Problemas".`,
    hitOf: (a, b) => `${a} de ${b}`, noPage: v => `La página "${v}" no existe.`, openerToc: "Apertura del capítulo",
    laying: "Maquetando las páginas…", missingImg: "Imagen pendiente", noName: "(sin nombre)", sizeIs: s => `Tamaño: ${s}. `,
    dropHere: "Arrastra la imagen aquí o haz clic para elegirla.", saveWithName: "Guarda la imagen con este nombre en la carpeta del libro.",
    imgSaved: p => `Imagen guardada en <b>${p}</b>`, imgFail: m => `No se pudo guardar la imagen: ${m}`, dropOnSlot: "Suelta la imagen sobre un espacio de \"Imagen pendiente\".",
    noProblems: "No se encontraron problemas. 🎉", missingImgKind: "IMAGEN PENDIENTE", promptIs: p => `Prompt: ${p}`, noPrompt: "No hay prompt de imagen en data.md.",
    copied: "Informe copiado. Pégalo en el chat con tu IA junto con data.md.", copiedShort: "Informe copiado.",
    needChrome: "Para guardar archivos desde el visor, usa Google Chrome o Microsoft Edge. También puedes guardar el archivo directamente en la carpeta del libro.",
    pickFolder: r => `${r}\n\nEl navegador te pedirá que elijas la carpeta del libro (la que contiene este index.html) y que permitas la edición. Solo hace falta una vez.`,
    noDataInFolder: n => `La carpeta "${n}" no tiene ningún archivo data.md. Elige la carpeta del libro (la misma del index.html).`,
    whyImg: "Para guardar la imagen dentro de la carpeta del libro, el visor necesita permiso para escribir en ella.",
    whyData: "Para sustituir el data.md del libro por el archivo elegido, el visor necesita permiso para escribir en la carpeta del libro.",
    whyCss: "Para sustituir el style.css del libro por el archivo elegido, el visor necesita permiso para escribir en la carpeta del libro.",
    cssReplaced: s => `style.css sustituido. La versión anterior se guardó en <b>versions/style-${s}.css</b>.`,
    dataReplaced: s => `data.md sustituido. La versión anterior se guardó en <b>versions/data-${s}.md</b>.`,
    saveFail: m => `No se pudo guardar: ${m}`, notABook: n => `"${n}" no parece el data.md de un libro (no se encontró ningún capítulo "# 1: Título"). ¿Usarlo de todos modos?`,
    showingOnly: n => `Mostrando “${n}” solo en esta ventana. Para conservarlo, sustituye el data.md de la carpeta del libro por este archivo.`,
    reloaded: "Libro recargado.", updated: "data.md actualizado.", layoutUpdated: "layout.html actualizado.",
    noDataTitle: "No se encontró data.md",
    noDataBody: `<p>Este visor busca un archivo llamado <b>data.md</b> en la misma carpeta que este <b>index.html</b>, y no lo encontró.</p>
      <p>Comprueba que el archivo existe y que su nombre es exactamente <b>data.md</b> (a veces las descargas se convierten en “data (1).md” o “data.md.txt”).</p>`,
    retry: "Reintentar", brokenTitle: "El principio o el final de data.md está dañado",
    brokenBody: (top, end) => `<p>El libro está en data.md, pero faltan las líneas fijas del principio o del final del archivo (o el texto contiene los caracteres <b>*/</b>, que no están permitidos).</p>
      <p>El archivo debe <b>empezar</b> con estas 3 líneas:</p><pre class="code">${top}</pre>
      <p>y <b>terminar</b> con estas 3:</p><pre class="code">${end}</pre>
      <p class="muted">Consejo: usa el botón de abajo para elegir el data.md — el visor repara estas líneas por sí solo.</p>`,
    fixBtn: "Elegir data.md y reparar",
    open: "Abrir", openTitle: "Abrir tu libro: los archivos que te dio tu IA (data.md, style.css, imágenes), un zip o una carpeta",
    settings: "Configuración", language: "Idioma", askAi: "Pide esta imagen a tu IA, exactamente con este nombre.",
    appTitle: "Abre tu libro", appIntro: "Suelta aquí lo que te dio tu IA: <b>data.md</b>, <b>style.css</b> y las <b>imágenes</b> — o un <b>.zip</b> con todo, o la carpeta del libro. Todo se queda en tu ordenador: no se sube nada.",
    chooseFiles: "Elegir archivos o zip", chooseFolder: "Elegir carpeta", folderLive: "Con una carpeta, la vista previa se actualiza sola cada vez que tu IA guarda un archivo.",
    orSample: "¿Aún no tienes un libro? Mira un ejemplo:", sampleEn: "The Art of Lorem Ipsum (en inglés)", home: "Volver a la página de inicio",
    zipError: "No se pudo leer este zip.", tooBig: "Un archivo de este libro es demasiado grande para abrirlo (hasta 150 MB por imagen y 20 MB por archivo de texto).",
    noMd: "No se encontró ningún data.md en lo que abriste.", opened: n => `Abierto: ${n}.`
  },
  fr: {
    contents: "Sommaire", prevPage: "Page précédente (←)", nextPage: "Page suivante (→)", pageField: "Saisissez un numéro de page et appuyez sur Entrée",
    zoomOut: "Zoom arrière", zoomIn: "Zoom avant", fit: "Ajuster", fitTitle: "Afficher la page entière", search: "Rechercher dans le livre…  (Ctrl+F)",
    prevHit: "Précédent (Shift+Enter)", nextHit: "Suivant (Enter)", problems: "Problèmes", problemsTitle: "Problèmes détectés dans la mise en page et dans data.md",
    reload: "Recharger", reloadTitle: "Relire data.md", import: "Importer", importTitle: "Remplacer data.md, style.css ou une image par un fichier (p. ex. celui envoyé par votre IA)",
    print: "Imprimer / PDF", printTitle: "Imprimer ou enregistrer en PDF (Ctrl+P)", problemsHead: "Problèmes et points à régler", copyForAi: "Copier pour l'IA",
    copyForAiTitle: "Copie un rapport prêt à coller dans la conversation avec votre IA", close: "Fermer", openBook: "Ouvrir le livre",
    printHead: "Imprimer ou enregistrer en PDF", printIntro: "Choisissez le format de page. Le livre est aussitôt remis en page pour ce format — vérifiez l'aperçu avant d'imprimer.",
    pageSize: "1. Format de page", printSettings: "2. Réglages", bleed: "Ajouter un fond perdu",
    bleedHelp: "3 mm supplémentaires autour de la page, que l'imprimeur coupe ensuite. Exigé par les imprimeurs et par Amazon KDP (0,125 in = 3,2 mm) lorsque la couleur ou les images vont jusqu'au bord. À ne pas utiliser pour imprimer chez soi.",
    colors: "Couleurs", asInBook: "Comme défini dans le livre", darkBg: "Fond sombre", lightBg: "Fond clair (consomme moins d'encre)",
    pages: "Pages", from: "de", to: "à", preview: "Aperçu", howtoHead: "3. Dans la fenêtre d'impression qui s'ouvre :",
    howto1: "Dans <b>Destination</b>, choisissez <b>Enregistrer au format PDF</b> pour créer le fichier — ou choisissez votre imprimante.",
    howto2: "Ouvrez <b>Plus de paramètres</b> : Marges = <b>Aucune</b>, Mise à l'échelle = <b>Par défaut</b>, et cochez <b>Graphiques d'arrière-plan</b>.",
    howto3: "Pour imprimer chez vous, choisissez <b>A4</b> ou <b>Lettre US</b>. Pour un imprimeur ou un service d'impression à la demande, envoyez le PDF et vérifiez ses exigences (marges minimales, nombre de pages, couverture).",
    printGo: "Imprimer / Enregistrer en PDF", book: "Livre",
    fmtGroups: {book: "Défini par ce livre", screen: "Écran", office: "Imprimantes domestiques et de bureau", trade: "Formats de livre en pouces (impression à la demande : Amazon KDP, IngramSpark, Lulu…)", metric: "Formats de livre en centimètres (imprimeurs)"},
    fmtDesc: {original: "Page compacte pour lire à l'écran.", a4: "Papier standard dans la plupart des pays. Texte grand et facile à lire.", letter: "Papier standard en Amérique du Nord.",
      a5: "Une demi-feuille A4. Supports de cours, carnets, petits guides.", "5x8in": "Romans et essais courts.", "5.5x8.5in": "Mémoires, guides, poésie.",
      "6x9in": "Le format broché le plus courant pour les essais et documents.", "7x10in": "Manuels, livres scolaires et cahiers d'exercices.", "8x10in": "Livres illustrés et livres pour enfants.",
      "8.5x11in": "Le plus grand format courant : cahiers d'exercices et livres visuels façon infographie.", "14x21cm": "Format broché courant dans de nombreux pays.",
      "15.6x23.4cm": "Format \"Royal\" : essais, documents et biographies.", "16x23cm": "Livres techniques et documentaires.", "17x24cm": "Manuels scolaires et cours.", b5: "Grands manuels et magazines."},
    letter: "Lettre US", screenName: "Écran", custom: "Format personnalisé", setInData: "Défini par ce livre", bookDefault: "format par défaut du livre",
    allPages: n => `Toutes (${n})`, curPage: n => `Page actuelle seulement (${n})`, chapterOpt: (n, t) => `Chapitre ${n}${t ? " — " + t : ""}`, rangeOpt: "Choisir une plage…",
    pvNote: (n, f, b) => `${n} page(s) au format <b>${f}</b>${b ? " avec fond perdu" : ""}. Aperçu des 3 premières.`,
    pvOver: n => `${n} page(s) avec trop de texte à ce format — voir « Problèmes ».`,
    hitOf: (a, b) => `${a} sur ${b}`, noPage: v => `La page « ${v} » n'existe pas.`, openerToc: "Ouverture du chapitre",
    laying: "Mise en page en cours…", missingImg: "Image manquante", noName: "(sans nom)", sizeIs: s => `Taille : ${s}. `,
    dropHere: "Glissez l'image ici ou cliquez pour la choisir.", saveWithName: "Enregistrez l'image sous ce nom dans le dossier du livre.",
    imgSaved: p => `Image enregistrée dans <b>${p}</b>`, imgFail: m => `Impossible d'enregistrer l'image : ${m}`, dropOnSlot: "Déposez l'image sur un emplacement « Image manquante ».",
    noProblems: "Aucun problème détecté. 🎉", missingImgKind: "IMAGE MANQUANTE", promptIs: p => `Prompt : ${p}`, noPrompt: "Aucun prompt d'image dans data.md.",
    copied: "Rapport copié. Collez-le dans la conversation avec votre IA, avec data.md.", copiedShort: "Rapport copié.",
    needChrome: "Pour enregistrer des fichiers depuis la visionneuse, utilisez Google Chrome ou Microsoft Edge. Vous pouvez aussi enregistrer le fichier directement dans le dossier du livre.",
    pickFolder: r => `${r}\n\nLe navigateur vous demandera de choisir le dossier du livre (celui qui contient ce index.html) et d'autoriser la modification. Ce n'est nécessaire qu'une fois.`,
    noDataInFolder: n => `Le dossier « ${n} » ne contient pas de fichier data.md. Choisissez le dossier du livre (le même que celui de index.html).`,
    whyImg: "Pour enregistrer l'image dans le dossier du livre, la visionneuse a besoin de l'autorisation d'y écrire.",
    whyData: "Pour remplacer le data.md du livre par le fichier choisi, la visionneuse a besoin de l'autorisation d'écrire dans le dossier du livre.",
    whyCss: "Pour remplacer le style.css du livre par le fichier choisi, la visionneuse a besoin de l'autorisation d'écrire dans le dossier du livre.",
    cssReplaced: s => `style.css remplacé. La version précédente a été conservée dans <b>versions/style-${s}.css</b>.`,
    dataReplaced: s => `data.md remplacé. La version précédente a été conservée dans <b>versions/data-${s}.md</b>.`,
    saveFail: m => `Impossible d'enregistrer : ${m}`, notABook: n => `« ${n} » ne ressemble pas au data.md d'un livre (aucun chapitre "# 1: Titre" trouvé). L'utiliser quand même ?`,
    showingOnly: n => `« ${n} » est affiché dans cette fenêtre uniquement. Pour le conserver, remplacez le data.md du dossier du livre par ce fichier.`,
    reloaded: "Livre rechargé.", updated: "data.md mis à jour.", layoutUpdated: "layout.html mis à jour.",
    noDataTitle: "data.md introuvable",
    noDataBody: `<p>Cette visionneuse cherche un fichier nommé <b>data.md</b> dans le même dossier que ce <b>index.html</b>, et ne l'a pas trouvé.</p>
      <p>Vérifiez que le fichier existe et que son nom est exactement <b>data.md</b> (les téléchargements deviennent parfois « data (1).md » ou « data.md.txt »).</p>`,
    retry: "Réessayer", brokenTitle: "Le début ou la fin de data.md est endommagé",
    brokenBody: (top, end) => `<p>Le livre se trouve dans data.md, mais les lignes fixes du début ou de la fin du fichier manquent (ou le texte contient les caractères <b>*/</b>, qui ne sont pas autorisés).</p>
      <p>Le fichier doit <b>commencer</b> par ces 3 lignes :</p><pre class="code">${top}</pre>
      <p>et <b>se terminer</b> par ces 3 :</p><pre class="code">${end}</pre>
      <p class="muted">Astuce : utilisez le bouton ci-dessous pour choisir le data.md — la visionneuse répare ces lignes d'elle-même.</p>`,
    fixBtn: "Choisir data.md et réparer",
    open: "Ouvrir", openTitle: "Ouvrir votre livre : les fichiers fournis par votre IA (data.md, style.css, images), un zip ou un dossier",
    settings: "Paramètres", language: "Langue", askAi: "Demandez cette image à votre IA, exactement sous ce nom.",
    appTitle: "Ouvrez votre livre", appIntro: "Déposez ici ce que votre IA vous a fourni : <b>data.md</b>, <b>style.css</b> et les <b>images</b> — ou un <b>.zip</b> contenant le tout, ou le dossier du livre. Tout reste sur votre ordinateur : rien n'est envoyé.",
    chooseFiles: "Choisir des fichiers ou un zip", chooseFolder: "Choisir un dossier", folderLive: "Avec un dossier, l'aperçu se met à jour tout seul chaque fois que votre IA enregistre un fichier.",
    orSample: "Pas encore de livre ? Voici un exemple :", sampleEn: "The Art of Lorem Ipsum (en anglais)", home: "Retour à la page d'accueil",
    zipError: "Impossible de lire ce zip.", tooBig: "Un fichier de ce livre est trop volumineux pour être ouvert (jusqu'à 150 Mo par image et 20 Mo par fichier texte).",
    noMd: "Aucun data.md trouvé dans ce que vous avez ouvert.", opened: n => `Ouvert : ${n}.`
  },
  de: {
    contents: "Inhalt", prevPage: "Vorherige Seite (←)", nextPage: "Nächste Seite (→)", pageField: "Seitenzahl eingeben und Enter drücken",
    zoomOut: "Verkleinern", zoomIn: "Vergrößern", fit: "Einpassen", fitTitle: "Ganze Seite anzeigen", search: "Im Buch suchen…  (Ctrl+F)",
    prevHit: "Vorheriger Treffer (Shift+Enter)", nextHit: "Nächster Treffer (Enter)", problems: "Probleme", problemsTitle: "Gefundene Probleme im Layout und in data.md",
    reload: "Neu laden", reloadTitle: "data.md neu einlesen", import: "Importieren", importTitle: "data.md, style.css oder ein Bild durch eine Datei ersetzen (z. B. die, die Ihre KI geschickt hat)",
    print: "Drucken / PDF", printTitle: "Drucken oder als PDF speichern (Ctrl+P)", problemsHead: "Probleme und offene Punkte", copyForAi: "Für die KI kopieren",
    copyForAiTitle: "Kopiert einen fertigen Bericht zum Einfügen in den Chat mit Ihrer KI", close: "Schließen", openBook: "Buch öffnen",
    printHead: "Drucken oder als PDF speichern", printIntro: "Wählen Sie das Seitenformat. Das Buch wird sofort für dieses Format neu umbrochen — prüfen Sie vor dem Drucken die Vorschau.",
    pageSize: "1. Seitenformat", printSettings: "2. Einstellungen", bleed: "Beschnittzugabe hinzufügen",
    bleedHelp: "Zusätzliche 3 mm rund um die Seite, die die Druckerei abschneidet. Von Druckereien und Amazon KDP (0,125 in = 3,2 mm) verlangt, wenn Farbe oder Bilder bis an den Rand reichen. Nicht für den Druck zu Hause verwenden.",
    colors: "Farben", asInBook: "Wie im Buch festgelegt", darkBg: "Dunkler Hintergrund", lightBg: "Heller Hintergrund (spart Tinte)",
    pages: "Seiten", from: "von", to: "bis", preview: "Vorschau", howtoHead: "3. Im Druckfenster, das sich öffnet:",
    howto1: "Wählen Sie unter <b>Ziel</b> die Option <b>Als PDF speichern</b>, um die Datei zu erstellen — oder wählen Sie Ihren Drucker.",
    howto2: "Öffnen Sie <b>Weitere Einstellungen</b>: Ränder = <b>Keine</b>, Skalieren = <b>Standard</b>, und aktivieren Sie <b>Hintergrundgrafiken</b>.",
    howto3: "Für den Druck zu Hause wählen Sie <b>A4</b> oder <b>Letter</b>. Für eine Druckerei oder einen Print-on-Demand-Dienst senden Sie das PDF und prüfen deren Vorgaben (Mindestränder, Seitenzahl, Umschlag).",
    printGo: "Drucken / PDF speichern", book: "Buch",
    fmtGroups: {book: "Von diesem Buch festgelegt", screen: "Bildschirm", office: "Drucker für Zuhause und Büro", trade: "Buchformate in Zoll (Print-on-Demand: Amazon KDP, IngramSpark, Lulu…)", metric: "Buchformate in Zentimetern (Druckereien)"},
    fmtDesc: {original: "Kompakte Seite zum Lesen am Bildschirm.", a4: "Standardpapier fast überall auf der Welt. Große, gut lesbare Schrift.", letter: "Standardpapier in Nordamerika.",
      a5: "Ein halbes A4-Blatt. Handouts, Notizhefte, kleine Ratgeber.", "5x8in": "Romane und kurze Sachbücher.", "5.5x8.5in": "Memoiren, Ratgeber, Lyrik.",
      "6x9in": "Das häufigste Taschenbuchformat für Sachbücher.", "7x10in": "Handbücher, Lehrbücher und Arbeitshefte.", "8x10in": "Bild- und Kinderbücher.",
      "8.5x11in": "Größtes gängiges Format: Arbeitshefte und visuelle Bücher im Infografik-Stil.", "14x21cm": "In vielen Ländern gängiges Taschenbuchformat.",
      "15.6x23.4cm": "\"Royal\"-Format: Sachbücher und Biografien.", "16x23cm": "Fach- und Sachbücher.", "17x24cm": "Lehrbücher und Kurse.", b5: "Größere Lehrbücher und Zeitschriften."},
    letter: "Letter", screenName: "Bildschirm", custom: "Eigenes Format", setInData: "Von diesem Buch festgelegt", bookDefault: "Standard des Buchs",
    allPages: n => `Alle (${n})`, curPage: n => `Nur aktuelle Seite (${n})`, chapterOpt: (n, t) => `Kapitel ${n}${t ? " — " + t : ""}`, rangeOpt: "Bereich wählen…",
    pvNote: (n, f, b) => `${n} Seite(n) im Format <b>${f}</b>${b ? " mit Beschnittzugabe" : ""}. Vorschau der ersten 3.`,
    pvOver: n => `${n} Seite(n) mit zu viel Text in diesem Format — siehe „Probleme“.`,
    hitOf: (a, b) => `${a} von ${b}`, noPage: v => `Seite „${v}“ existiert nicht.`, openerToc: "Kapitelauftakt",
    laying: "Seiten werden umbrochen…", missingImg: "Bild fehlt", noName: "(ohne Namen)", sizeIs: s => `Größe: ${s}. `,
    dropHere: "Bild hierher ziehen oder klicken, um es auszuwählen.", saveWithName: "Speichern Sie das Bild unter diesem Namen im Buchordner.",
    imgSaved: p => `Bild gespeichert unter <b>${p}</b>`, imgFail: m => `Das Bild konnte nicht gespeichert werden: ${m}`, dropOnSlot: "Legen Sie das Bild auf einem Platzhalter „Bild fehlt“ ab.",
    noProblems: "Keine Probleme gefunden. 🎉", missingImgKind: "BILD FEHLT", promptIs: p => `Prompt: ${p}`, noPrompt: "Kein Bild-Prompt in data.md.",
    copied: "Bericht kopiert. Fügen Sie ihn zusammen mit data.md in den Chat mit Ihrer KI ein.", copiedShort: "Bericht kopiert.",
    needChrome: "Um Dateien aus dem Viewer zu speichern, verwenden Sie Google Chrome oder Microsoft Edge. Sie können die Datei auch direkt im Buchordner speichern.",
    pickFolder: r => `${r}\n\nDer Browser bittet Sie, den Buchordner (den mit dieser index.html) auszuwählen und das Bearbeiten zu erlauben. Das ist nur einmal nötig.`,
    noDataInFolder: n => `Der Ordner „${n}“ enthält keine data.md. Wählen Sie den Buchordner (denselben, in dem index.html liegt).`,
    whyImg: "Um das Bild im Buchordner zu speichern, braucht der Viewer die Berechtigung, dort zu schreiben.",
    whyData: "Um die data.md des Buchs durch die gewählte Datei zu ersetzen, braucht der Viewer Schreibrechte für den Buchordner.",
    whyCss: "Um die style.css des Buchs durch die gewählte Datei zu ersetzen, braucht der Viewer Schreibrechte für den Buchordner.",
    cssReplaced: s => `style.css ersetzt. Die vorherige Version wurde unter <b>versions/style-${s}.css</b> aufbewahrt.`,
    dataReplaced: s => `data.md ersetzt. Die vorherige Version wurde unter <b>versions/data-${s}.md</b> aufbewahrt.`,
    saveFail: m => `Speichern fehlgeschlagen: ${m}`, notABook: n => `„${n}“ sieht nicht wie die data.md eines Buchs aus (kein Kapitel "# 1: Titel" gefunden). Trotzdem verwenden?`,
    showingOnly: n => `„${n}“ wird nur in diesem Fenster angezeigt. Um die Datei zu behalten, ersetzen Sie die data.md im Buchordner durch diese Datei.`,
    reloaded: "Buch neu geladen.", updated: "data.md aktualisiert.", layoutUpdated: "layout.html aktualisiert.",
    noDataTitle: "data.md nicht gefunden",
    noDataBody: `<p>Dieser Viewer sucht eine Datei namens <b>data.md</b> im selben Ordner wie diese <b>index.html</b> und hat sie nicht gefunden.</p>
      <p>Prüfen Sie, ob die Datei existiert und genau <b>data.md</b> heißt (Downloads heißen manchmal „data (1).md“ oder „data.md.txt“).</p>`,
    retry: "Erneut versuchen", brokenTitle: "Anfang oder Ende von data.md ist beschädigt",
    brokenBody: (top, end) => `<p>Das Buch steht in data.md, aber die festen Zeilen am Anfang oder am Ende der Datei fehlen (oder der Text enthält die Zeichen <b>*/</b>, die nicht erlaubt sind).</p>
      <p>Die Datei muss mit diesen 3 Zeilen <b>beginnen</b>:</p><pre class="code">${top}</pre>
      <p>und mit diesen 3 <b>enden</b>:</p><pre class="code">${end}</pre>
      <p class="muted">Tipp: Wählen Sie die data.md über die Schaltfläche unten aus — der Viewer repariert diese Zeilen selbst.</p>`,
    fixBtn: "data.md wählen und reparieren",
    open: "Öffnen", openTitle: "Ihr Buch öffnen: die Dateien von Ihrer KI (data.md, style.css, Bilder), ein Zip oder ein Ordner",
    settings: "Einstellungen", language: "Sprache", askAi: "Bitten Sie Ihre KI um dieses Bild, genau mit diesem Namen.",
    appTitle: "Buch öffnen", appIntro: "Legen Sie hier ab, was Ihre KI Ihnen gegeben hat: <b>data.md</b>, <b>style.css</b> und die <b>Bilder</b> — oder eine <b>.zip</b>-Datei mit allem, oder den Buchordner. Alles bleibt auf Ihrem Computer: Nichts wird hochgeladen.",
    chooseFiles: "Dateien oder Zip wählen", chooseFolder: "Ordner wählen", folderLive: "Mit einem Ordner aktualisiert sich die Vorschau von selbst, sobald Ihre KI eine Datei speichert.",
    orSample: "Noch kein Buch? Sehen Sie sich ein Beispiel an:", sampleEn: "The Art of Lorem Ipsum (auf Englisch)", home: "Zurück zur Startseite",
    zipError: "Diese Zip-Datei konnte nicht gelesen werden.", tooBig: "Eine Datei dieses Buchs ist zu groß zum Öffnen (bis zu 150 MB pro Bild und 20 MB pro Textdatei).",
    noMd: "In dem, was Sie geöffnet haben, wurde keine data.md gefunden.", opened: n => `Geöffnet: ${n}.`
  }
};
const T = (() => {
  const own = STRINGS[UI_LANG] || {}, en = STRINGS.en;
  return {...en, ...own, fmtGroups: {...en.fmtGroups, ...own.fmtGroups}, fmtDesc: {...en.fmtDesc, ...own.fmtDesc}};
})();

/* Problem messages: shown in the interface language, always copied for the AI in English */
const PROBLEMS = {
  en: {
    "fm-line": a => `line not understood in the book header: "${a.text}"`,
    "fm-key": a => `unknown property in the book header: "${a.key}". Accepted: ${a.list}`,
    "old-key": a => `"${a.key}:" is from the old Portuguese format — use "${a.repl}:" (book_tools.py migrate converts the whole file)`,
    "h4-early": () => "sub-heading (####) before any chapter — ignored",
    "text-early": a => `text before the first chapter (#) was ignored: "${a.text}"`,
    typo: a => `"${a.key}:" looks like a typo of "${a.near}:" — treated as text`,
    "unknown-prop": a => `unknown property "${a.key}:" — accepted here: ${a.list}`,
    icon: a => `icon "${a.name}" does not exist (line ${a.line}). Use one of: ${a.list}`,
    "card-icon": a => `card with icon "${a.name}" that does not exist (line ${a.line}). Use: ${a.list}`,
    color: a => `"${a.key}: ${a.name}" is not a valid name (line ${a.line}). Use letters, digits and "-" only, starting with a letter`,
    width: a => `width "${a.name}" does not exist (line ${a.line}). Use: 1/4, 1/3, 1/2, 2/3, 3/4 or full`,
    "img-box": a => `box "${a.title}" is an image box but has no "image:" (line ${a.line})`,
    "cover-missing": a => `"cover: ${a.value}" names no page of the book. Use the number of the cover page (e.g. 0.1), or "none" only if the author asked for a book without a cover`,
    "cover-unset": a => `no "cover:" in the header: the first page (${a.title}) is used as the cover. Add a cover page and set "cover: <its number>", or "cover: none" only if the author asked for a book without a cover`,
    type: a => `type "${a.name}" does not exist (line ${a.line}). Use: text, image or cards`,
    dup: a => `page "${a.num}" appears twice (line ${a.line})`,
    empty: a => `page "${a.num} ${a.title}" has no box (###) (line ${a.line})`,
    "no-chapters": () => "no chapter found. Each chapter starts with a line \"# 1: Title\".",
    overflow: a => `page ${a.n} (${a.label} ${a.title}): the text does not fit even at the smallest font size — it is ${a.pct}% too long. Cut about ${a.cut} words, remove list items or change box widths.`,
    font: a => `at this size (${a.fmt}) the page text is between ${a.min} and ${a.max} pt. For print, ${a.warn} pt or more is ideal: choose a bigger size (A4, Letter or 8.5 × 11 in) or shorten the text.`,
    "layout-missing": () => "layout.html not found: the book has no layout of its own, so a plain fallback is shown. Copy layout.html and style.css from the sample book and adapt them.",
    "layout-broken": () => "the first 3 or the last 3 lines of layout.html are damaged (or it contains */). It must start with \"<!-- BOOK LAYOUT\", \"layout(function(){/*\", \"-->\" and end with \"<!--\", \"*/});\", \"-->\".",
    "layout-none": a => `layout.html has no <template id="${a.id}">, which is the default for ${a.kind}. A plain fallback is used.`,
    "layout-unknown": a => `"layout: ${a.name}" (line ${a.line}): layout.html has no <template id="${a.name}">. Templates found: ${a.list}`,
    "layout-strip": a => `layout.html, template "${a.id}": removed ${a.what} (allowed: plain structural HTML and simple SVG, no scripts, links, forms or url())`,
    "layout-fit": a => `layout.html, template "${a.id}": data-fit="${a.spec}" is not valid. Use data-fit="--name MIN MAX [shrink%]" with MIN and MAX in pt or u (1% of the page width), e.g. data-fit="--fs 4.5pt 13pt"`,
    format: a => `"format: ${a.value}" is not a known size nor "W x H mm|cm|in" between ${a.min} and ${a.max} mm per side; using the screen size. Known sizes: ${FORMATS.map(f => f.id).join(", ")}`,
    "style-drop": a => `style.css: ${a.n} rule(s) or declaration(s) ignored. Every selector must start at .book (or .theme-NAME) and values cannot use url(), @import or expression() (url() only in @font-face, for files in fonts/). First ones: ${a.list}`,
    "font-file": a => `style.css: font file(s) not loaded: ${a.list}. Put the font in the book's fonts/ folder (lowercase name, .woff2, .woff, .ttf or .otf) with the exact name used in @font-face, and check that it is a real font file.`
  },
  pt: {
    "fm-line": a => `linha não entendida no cabeçalho do livro: "${a.text}"`,
    "fm-key": a => `propriedade desconhecida no cabeçalho do livro: "${a.key}". Aceitas: ${a.list}`,
    "old-key": a => `"${a.key}:" é do formato antigo em português — use "${a.repl}:" (o comando book_tools.py migrate converte o arquivo inteiro)`,
    "h4-early": () => "subtítulo (####) antes de qualquer capítulo — ignorado",
    "text-early": a => `texto antes do primeiro capítulo (#) foi ignorado: "${a.text}"`,
    typo: a => `"${a.key}:" parece um erro de digitação de "${a.near}:" — foi tratado como texto`,
    "unknown-prop": a => `propriedade desconhecida "${a.key}:" — aceitas aqui: ${a.list}`,
    icon: a => `ícone "${a.name}" não existe (linha ${a.line}). Use um destes: ${a.list}`,
    "card-icon": a => `cartão com ícone "${a.name}" que não existe (linha ${a.line}). Use: ${a.list}`,
    color: a => `"${a.key}: ${a.name}" não é um nome válido (linha ${a.line}). Use só letras, números e "-", começando com letra`,
    width: a => `largura "${a.name}" não existe (linha ${a.line}). Use: 1/4, 1/3, 1/2, 2/3, 3/4 ou full`,
    "img-box": a => `a caixa "${a.title}" é do tipo imagem mas não tem "image:" (linha ${a.line})`,
    "cover-missing": a => `"cover: ${a.value}" não aponta para nenhuma página do livro. Use o número da página de capa (ex.: 0.1), ou "none" só se o autor pediu um livro sem capa`,
    "cover-unset": a => `sem "cover:" no cabeçalho: a primeira página (${a.title}) é usada como capa. Crie uma página de capa e defina "cover: <número dela>", ou "cover: none" só se o autor pediu um livro sem capa`,
    type: a => `tipo "${a.name}" não existe (linha ${a.line}). Use: text, image ou cards`,
    dup: a => `a página "${a.num}" aparece duas vezes (linha ${a.line})`,
    empty: a => `a página "${a.num} ${a.title}" não tem nenhuma caixa (###) (linha ${a.line})`,
    "no-chapters": () => "nenhum capítulo encontrado. Cada capítulo começa com uma linha \"# 1: Título\".",
    overflow: a => `página ${a.n} (${a.label} ${a.title}): o texto não cabe nem com a letra mínima — passa ${a.pct}% do espaço. Corte cerca de ${a.cut} palavras, remova itens de listas ou mude larguras das caixas.`,
    font: a => `neste formato (${a.fmt}) a letra das páginas fica entre ${a.min} e ${a.max} pt. Para impressão o ideal é a partir de ${a.warn} pt: escolha um formato maior (A4 ou 8,5 × 11 pol.) ou reduza o texto.`,
    "layout-missing": () => "não encontrei o layout.html: o livro não tem diagramação própria, então aparece uma versão simples de reserva. Copie o layout.html e o style.css do livro de exemplo e adapte.",
    "layout-broken": () => "as 3 primeiras ou as 3 últimas linhas do layout.html estão estragadas (ou ele contém */). Ele precisa começar com \"<!-- BOOK LAYOUT\", \"layout(function(){/*\", \"-->\" e terminar com \"<!--\", \"*/});\", \"-->\".",
    "layout-none": a => `o layout.html não tem <template id="${a.id}">, que é o padrão para ${a.kind}. Foi usada uma versão simples de reserva.`,
    "layout-unknown": a => `"layout: ${a.name}" (linha ${a.line}): o layout.html não tem <template id="${a.name}">. Templates encontrados: ${a.list}`,
    "layout-strip": a => `layout.html, template "${a.id}": removi ${a.what} (permitido: HTML estrutural simples e SVG simples, sem scripts, links, formulários ou url())`,
    "layout-fit": a => `layout.html, template "${a.id}": data-fit="${a.spec}" não é válido. Use data-fit="--nome MIN MAX [redução%]" com MIN e MAX em pt ou u (1% da largura da página), ex.: data-fit="--fs 4.5pt 13pt"`,
    format: a => `"format: ${a.value}" não é um tamanho conhecido nem "L x A mm|cm|in" entre ${a.min} e ${a.max} mm por lado; usando o tamanho de tela. Tamanhos conhecidos: ${FORMATS.map(f => f.id).join(", ")}`,
    "style-drop": a => `style.css: ${a.n} regra(s) ou declaração(ões) ignoradas. Todo seletor precisa começar em .book (ou .theme-NOME) e os valores não podem usar url(), @import ou expression() (url() só em @font-face, para arquivos de fonts/). Primeiras: ${a.list}`,
    "font-file": a => `style.css: fonte(s) não carregada(s): ${a.list}. Coloque a fonte na pasta fonts/ do livro (nome em minúsculas, .woff2, .woff, .ttf ou .otf) com o mesmo nome usado no @font-face e confira se é um arquivo de fonte de verdade.`
  },
  es: {
    "fm-line": a => `línea no reconocida en el encabezado del libro: "${a.text}"`,
    "fm-key": a => `propiedad desconocida en el encabezado del libro: "${a.key}". Se admiten: ${a.list}`,
    "old-key": a => `"${a.key}:" es del formato antiguo en portugués — usa "${a.repl}:" (book_tools.py migrate convierte todo el archivo)`,
    "h4-early": () => "subtítulo (####) antes de cualquier capítulo — ignorado",
    "text-early": a => `se ignoró el texto anterior al primer capítulo (#): "${a.text}"`,
    typo: a => `"${a.key}:" parece una errata de "${a.near}:" — se trató como texto`,
    "unknown-prop": a => `propiedad desconocida "${a.key}:" — aquí se admiten: ${a.list}`,
    icon: a => `el icono "${a.name}" no existe (línea ${a.line}). Usa uno de estos: ${a.list}`,
    "card-icon": a => `tarjeta con un icono "${a.name}" que no existe (línea ${a.line}). Usa: ${a.list}`,
    color: a => `"${a.key}: ${a.name}" no es un nombre válido (línea ${a.line}). Usa solo letras, números y "-", empezando por una letra`,
    width: a => `el ancho "${a.name}" no existe (línea ${a.line}). Usa: 1/4, 1/3, 1/2, 2/3, 3/4 o full`,
    "img-box": a => `el recuadro "${a.title}" es de imagen pero no tiene "image:" (línea ${a.line})`,
    "cover-missing": a => `"cover: ${a.value}" no corresponde a ninguna página del libro. Usa el número de la página de portada (p. ej. 0.1), o "none" solo si el autor pidió un libro sin portada`,
    "cover-unset": a => `no hay "cover:" en la cabecera: la primera página (${a.title}) se usa como portada. Añade una página de portada y define "cover: <su número>", o "cover: none" solo si el autor pidió un libro sin portada`,
    type: a => `el tipo "${a.name}" no existe (línea ${a.line}). Usa: text, image o cards`,
    dup: a => `la página "${a.num}" aparece dos veces (línea ${a.line})`,
    empty: a => `la página "${a.num} ${a.title}" no tiene ningún recuadro (###) (línea ${a.line})`,
    "no-chapters": () => "no se encontró ningún capítulo. Cada capítulo empieza con una línea \"# 1: Título\".",
    overflow: a => `página ${a.n} (${a.label} ${a.title}): el texto no cabe ni con la letra más pequeña — sobra un ${a.pct}%. Recorta unas ${a.cut} palabras, quita elementos de listas o cambia el ancho de los recuadros.`,
    font: a => `en este tamaño (${a.fmt}) el texto de las páginas queda entre ${a.min} y ${a.max} pt. Para imprimir, lo ideal es ${a.warn} pt o más: elige un tamaño mayor (A4, Carta u 8,5 × 11 in) o acorta el texto.`,
    "layout-missing": () => "no se encontró layout.html: el libro no tiene maquetación propia, así que se muestra una versión sencilla de reserva. Copia layout.html y style.css del libro de ejemplo y adáptalos.",
    "layout-broken": () => "las 3 primeras o las 3 últimas líneas de layout.html están dañadas (o contiene */). Debe empezar con \"<!-- BOOK LAYOUT\", \"layout(function(){/*\", \"-->\" y terminar con \"<!--\", \"*/});\", \"-->\".",
    "layout-none": a => `layout.html no tiene <template id="${a.id}">, que es el predeterminado para ${a.kind}. Se usa una versión sencilla de reserva.`,
    "layout-unknown": a => `"layout: ${a.name}" (línea ${a.line}): layout.html no tiene <template id="${a.name}">. Plantillas encontradas: ${a.list}`,
    "layout-strip": a => `layout.html, plantilla "${a.id}": se eliminó ${a.what} (se permite: HTML estructural sencillo y SVG simple, sin scripts, enlaces, formularios ni url())`,
    "layout-fit": a => `layout.html, plantilla "${a.id}": data-fit="${a.spec}" no es válido. Usa data-fit="--name MIN MAX [shrink%]" con MIN y MAX en pt o u (1% del ancho de la página), p. ej. data-fit="--fs 4.5pt 13pt"`,
    format: a => `"format: ${a.value}" no es un tamaño conocido ni "W x H mm|cm|in" entre ${a.min} y ${a.max} mm por lado; se usa el tamaño de pantalla. Tamaños conocidos: ${FORMATS.map(f => f.id).join(", ")}`,
    "style-drop": a => `style.css: se ignoraron ${a.n} regla(s) o declaración(es). Todo selector debe empezar por .book (o .theme-NAME) y los valores no pueden usar url(), @import ni expression() (url() solo en @font-face, para archivos de fonts/). Primeras: ${a.list}`,
    "font-file": a => `style.css: fuente(s) no cargada(s): ${a.list}. Pon la fuente en la carpeta fonts/ del libro (nombre en minúsculas, .woff2, .woff, .ttf u .otf) con el mismo nombre usado en @font-face y comprueba que sea un archivo de fuente real.`
  },
  fr: {
    "fm-line": a => `ligne non comprise dans l'en-tête du livre : "${a.text}"`,
    "fm-key": a => `propriété inconnue dans l'en-tête du livre : "${a.key}". Acceptées : ${a.list}`,
    "old-key": a => `"${a.key}:" vient de l'ancien format en portugais — utilisez "${a.repl}:" (book_tools.py migrate convertit tout le fichier)`,
    "h4-early": () => "sous-titre (####) avant tout chapitre — ignoré",
    "text-early": a => `texte avant le premier chapitre (#) ignoré : "${a.text}"`,
    typo: a => `"${a.key}:" ressemble à une faute de frappe pour "${a.near}:" — traité comme du texte`,
    "unknown-prop": a => `propriété inconnue "${a.key}:" — acceptées ici : ${a.list}`,
    icon: a => `l'icône "${a.name}" n'existe pas (ligne ${a.line}). Utilisez l'une de celles-ci : ${a.list}`,
    "card-icon": a => `carte avec une icône "${a.name}" qui n'existe pas (ligne ${a.line}). Utilisez : ${a.list}`,
    color: a => `"${a.key}: ${a.name}" n'est pas un nom valide (ligne ${a.line}). Utilisez uniquement des lettres, des chiffres et "-", en commençant par une lettre`,
    width: a => `la largeur "${a.name}" n'existe pas (ligne ${a.line}). Utilisez : 1/4, 1/3, 1/2, 2/3, 3/4 ou full`,
    "img-box": a => `l'encadré "${a.title}" est un encadré d'image mais n'a pas de "image:" (ligne ${a.line})`,
    "cover-missing": a => `"cover: ${a.value}" ne désigne aucune page du livre. Indiquez le numéro de la page de couverture (ex. 0.1), ou "none" seulement si l'auteur a demandé un livre sans couverture`,
    "cover-unset": a => `pas de "cover:" dans l'en-tête : la première page (${a.title}) sert de couverture. Ajoutez une page de couverture et indiquez "cover: <son numéro>", ou "cover: none" seulement si l'auteur a demandé un livre sans couverture`,
    type: a => `le type "${a.name}" n'existe pas (ligne ${a.line}). Utilisez : text, image ou cards`,
    dup: a => `la page "${a.num}" apparaît deux fois (ligne ${a.line})`,
    empty: a => `la page "${a.num} ${a.title}" n'a aucun encadré (###) (ligne ${a.line})`,
    "no-chapters": () => "aucun chapitre trouvé. Chaque chapitre commence par une ligne \"# 1: Titre\".",
    overflow: a => `page ${a.n} (${a.label} ${a.title}) : le texte ne tient pas, même avec la plus petite taille de police — il déborde de ${a.pct} %. Supprimez environ ${a.cut} mots, retirez des éléments de liste ou modifiez la largeur des encadrés.`,
    font: a => `à ce format (${a.fmt}), le texte des pages fait entre ${a.min} et ${a.max} pt. Pour l'impression, l'idéal est ${a.warn} pt ou plus : choisissez un format plus grand (A4, Lettre US ou 8,5 × 11 in) ou raccourcissez le texte.`,
    "layout-missing": () => "layout.html introuvable : le livre n'a pas de mise en page propre, une version simple de secours est donc affichée. Copiez layout.html et style.css du livre d'exemple et adaptez-les.",
    "layout-broken": () => "les 3 premières ou les 3 dernières lignes de layout.html sont endommagées (ou il contient */). Il doit commencer par \"<!-- BOOK LAYOUT\", \"layout(function(){/*\", \"-->\" et se terminer par \"<!--\", \"*/});\", \"-->\".",
    "layout-none": a => `layout.html n'a pas de <template id="${a.id}">, qui est le modèle par défaut pour ${a.kind}. Une version simple de secours est utilisée.`,
    "layout-unknown": a => `"layout: ${a.name}" (ligne ${a.line}) : layout.html n'a pas de <template id="${a.name}">. Modèles trouvés : ${a.list}`,
    "layout-strip": a => `layout.html, modèle "${a.id}" : suppression de ${a.what} (autorisé : HTML structurel simple et SVG simple, sans scripts, liens, formulaires ni url())`,
    "layout-fit": a => `layout.html, modèle "${a.id}" : data-fit="${a.spec}" n'est pas valide. Utilisez data-fit="--name MIN MAX [shrink%]" avec MIN et MAX en pt ou en u (1 % de la largeur de la page), p. ex. data-fit="--fs 4.5pt 13pt"`,
    format: a => `"format: ${a.value}" n'est ni un format connu ni "W x H mm|cm|in" entre ${a.min} et ${a.max} mm par côté ; le format écran est utilisé. Formats connus : ${FORMATS.map(f => f.id).join(", ")}`,
    "style-drop": a => `style.css : ${a.n} règle(s) ou déclaration(s) ignorée(s). Chaque sélecteur doit commencer par .book (ou .theme-NAME) et les valeurs ne peuvent pas utiliser url(), @import ni expression() (url() seulement dans @font-face, pour les fichiers de fonts/). Premières : ${a.list}`,
    "font-file": a => `style.css : police(s) non chargée(s) : ${a.list}. Placez la police dans le dossier fonts/ du livre (nom en minuscules, .woff2, .woff, .ttf ou .otf) avec le nom exact utilisé dans @font-face, et vérifiez que c'est un vrai fichier de police.`
  },
  de: {
    "fm-line": a => `Zeile im Buchkopf nicht verstanden: "${a.text}"`,
    "fm-key": a => `unbekannte Eigenschaft im Buchkopf: "${a.key}". Erlaubt: ${a.list}`,
    "old-key": a => `"${a.key}:" stammt aus dem alten portugiesischen Format — verwenden Sie "${a.repl}:" (book_tools.py migrate konvertiert die ganze Datei)`,
    "h4-early": () => "Unterüberschrift (####) vor dem ersten Kapitel — ignoriert",
    "text-early": a => `Text vor dem ersten Kapitel (#) wurde ignoriert: "${a.text}"`,
    typo: a => `"${a.key}:" sieht nach einem Tippfehler für "${a.near}:" aus — als Text behandelt`,
    "unknown-prop": a => `unbekannte Eigenschaft "${a.key}:" — hier erlaubt: ${a.list}`,
    icon: a => `Symbol "${a.name}" existiert nicht (Zeile ${a.line}). Verwenden Sie eines davon: ${a.list}`,
    "card-icon": a => `Karte mit Symbol "${a.name}", das nicht existiert (Zeile ${a.line}). Verwenden Sie: ${a.list}`,
    color: a => `"${a.key}: ${a.name}" ist kein gültiger Name (Zeile ${a.line}). Nur Buchstaben, Ziffern und "-" verwenden, beginnend mit einem Buchstaben`,
    width: a => `Breite "${a.name}" existiert nicht (Zeile ${a.line}). Verwenden Sie: 1/4, 1/3, 1/2, 2/3, 3/4 oder full`,
    "img-box": a => `Kasten "${a.title}" ist ein Bildkasten, hat aber kein "image:" (Zeile ${a.line})`,
    "cover-missing": a => `"cover: ${a.value}" bezeichnet keine Seite des Buchs. Geben Sie die Nummer der Umschlagseite an (z. B. 0.1), oder "none" nur, wenn der Autor ein Buch ohne Umschlag wünscht`,
    "cover-unset": a => `kein "cover:" im Kopf: die erste Seite (${a.title}) dient als Umschlag. Fügen Sie eine Umschlagseite hinzu und setzen Sie "cover: <ihre Nummer>", oder "cover: none" nur, wenn der Autor ein Buch ohne Umschlag wünscht`,
    type: a => `Typ "${a.name}" existiert nicht (Zeile ${a.line}). Verwenden Sie: text, image oder cards`,
    dup: a => `Seite "${a.num}" kommt doppelt vor (Zeile ${a.line})`,
    empty: a => `Seite "${a.num} ${a.title}" hat keinen Kasten (###) (Zeile ${a.line})`,
    "no-chapters": () => "kein Kapitel gefunden. Jedes Kapitel beginnt mit einer Zeile \"# 1: Titel\".",
    overflow: a => `Seite ${a.n} (${a.label} ${a.title}): Der Text passt selbst mit der kleinsten Schriftgröße nicht — er ist ${a.pct} % zu lang. Kürzen Sie etwa ${a.cut} Wörter, entfernen Sie Listenpunkte oder ändern Sie die Kastenbreiten.`,
    font: a => `in diesem Format (${a.fmt}) liegt die Schriftgröße der Seiten zwischen ${a.min} und ${a.max} pt. Für den Druck sind ${a.warn} pt oder mehr ideal: Wählen Sie ein größeres Format (A4, Letter oder 8,5 × 11 in) oder kürzen Sie den Text.`,
    "layout-missing": () => "layout.html nicht gefunden: Das Buch hat kein eigenes Layout, daher wird eine einfache Ersatzdarstellung gezeigt. Kopieren Sie layout.html und style.css aus dem Beispielbuch und passen Sie sie an.",
    "layout-broken": () => "die ersten 3 oder die letzten 3 Zeilen von layout.html sind beschädigt (oder die Datei enthält */). Sie muss mit \"<!-- BOOK LAYOUT\", \"layout(function(){/*\", \"-->\" beginnen und mit \"<!--\", \"*/});\", \"-->\" enden.",
    "layout-none": a => `layout.html hat kein <template id="${a.id}">, die Standardvorlage für ${a.kind}. Eine einfache Ersatzdarstellung wird verwendet.`,
    "layout-unknown": a => `"layout: ${a.name}" (Zeile ${a.line}): layout.html hat kein <template id="${a.name}">. Gefundene Vorlagen: ${a.list}`,
    "layout-strip": a => `layout.html, Vorlage "${a.id}": ${a.what} entfernt (erlaubt: einfaches strukturelles HTML und einfaches SVG, ohne Skripte, Links, Formulare oder url())`,
    "layout-fit": a => `layout.html, Vorlage "${a.id}": data-fit="${a.spec}" ist ungültig. Verwenden Sie data-fit="--name MIN MAX [shrink%]" mit MIN und MAX in pt oder u (1 % der Seitenbreite), z. B. data-fit="--fs 4.5pt 13pt"`,
    format: a => `"format: ${a.value}" ist weder ein bekanntes Format noch "W x H mm|cm|in" mit ${a.min} bis ${a.max} mm pro Seite; die Bildschirmgröße wird verwendet. Bekannte Formate: ${FORMATS.map(f => f.id).join(", ")}`,
    "style-drop": a => `style.css: ${a.n} Regel(n) oder Deklaration(en) ignoriert. Jeder Selektor muss mit .book (oder .theme-NAME) beginnen, und Werte dürfen kein url(), @import oder expression() enthalten (url() nur in @font-face, für Dateien in fonts/). Die ersten: ${a.list}`,
    "font-file": a => `style.css: Schrift(en) nicht geladen: ${a.list}. Legen Sie die Schrift in den Ordner fonts/ des Buches (Name in Kleinbuchstaben, .woff2, .woff, .ttf oder .otf) mit genau dem Namen aus @font-face und prüfen Sie, ob es eine echte Schriftdatei ist.`
  }
};
/* short labels shown in front of each problem */
const KIND_LABEL = {
  en: {cover: "COVER", data: "DATA.MD", icon: "ICON", color: "NAME", width: "WIDTH", image: "IMAGE", type: "TYPE", number: "NUMBER", empty: "EMPTY", overflow: "OVERFLOW", font: "FONT SIZE", layout: "LAYOUT", style: "STYLE", format: "PAGE SIZE"},
  pt: {cover: "CAPA", data: "DATA.MD", icon: "ÍCONE", color: "NOME", width: "LARGURA", image: "IMAGEM", type: "TIPO", number: "NÚMERO", empty: "VAZIA", overflow: "ESTOURO", font: "LETRA", layout: "LAYOUT", style: "ESTILO", format: "TAMANHO"},
  es: {cover: "PORTADA", data: "DATA.MD", icon: "ICONO", color: "NOMBRE", width: "ANCHO", image: "IMAGEN", type: "TIPO", number: "NÚMERO", empty: "VACÍA", overflow: "DESBORDE", font: "LETRA", layout: "LAYOUT", style: "ESTILO", format: "TAMAÑO"},
  fr: {cover: "COUVERTURE", data: "DATA.MD", icon: "ICÔNE", color: "NOM", width: "LARGEUR", image: "IMAGE", type: "TYPE", number: "NUMÉRO", empty: "VIDE", overflow: "DÉBORDEMENT", font: "TAILLE DU TEXTE", layout: "LAYOUT", style: "STYLE", format: "FORMAT"},
  de: {cover: "UMSCHLAG", data: "DATA.MD", icon: "SYMBOL", color: "NAME", width: "BREITE", image: "BILD", type: "TYP", number: "NUMMER", empty: "LEER", overflow: "ÜBERLAUF", font: "SCHRIFTGRÖSSE", layout: "LAYOUT", style: "STIL", format: "FORMAT"}
};

/* Labels printed inside the book, by the book's "language:" */
const BOOK_LABELS = {
  en: {chapter: "Chapter", inChapter: "In this chapter", opener: n => `Chapter ${n} opener`},
  pt: {chapter: "Capítulo", inChapter: "Neste capítulo", opener: n => `Abertura do capítulo ${n}`},
  es: {chapter: "Capítulo", inChapter: "En este capítulo", opener: n => `Apertura del capítulo ${n}`},
  fr: {chapter: "Chapitre", inChapter: "Dans ce chapitre", opener: n => `Ouverture du chapitre ${n}`},
  de: {chapter: "Kapitel", inChapter: "In diesem Kapitel", opener: n => `Auftakt zu Kapitel ${n}`}
};
const bookLang = () => { const l = norm(state.book?.meta.language || "en").slice(0, 2); return BOOK_LABELS[l] ? l : "en"; };
const BL = () => BOOK_LABELS[bookLang()];

/* =====================================================================
   SCREEN
   ===================================================================== */
document.getElementById("engine-missing")?.remove();
document.documentElement.lang = UI_LANG === "pt" ? "pt-BR" : "en";
document.body.insertAdjacentHTML("afterbegin", `
<div id="bar">
  <button class="tb" id="b-toc" title="${T.contents}"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span class="lbl">${T.contents}</span></button>
  <span class="title" id="booktitle">${T.book}</span>
  <span class="sep"></span>
  <button class="tb" id="b-prev" title="${T.prevPage}"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
  <div class="field" title="${T.pageField}"><input id="pgin" value="1"><span class="count" id="pgtot">/ 0</span></div>
  <button class="tb" id="b-next" title="${T.nextPage}"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>
  <span class="sep"></span>
  <button class="tb" id="b-zout" title="${T.zoomOut}"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
  <span id="zoomval">100%</span>
  <button class="tb" id="b-zin" title="${T.zoomIn}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
  <button class="tb" id="b-zfit" title="${T.fitTitle}"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span class="lbl">${T.fit}</span></button>
  <span class="sep"></span>
  <div class="field search">
    <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></svg>
    <input id="q" placeholder="${T.search}">
    <span class="count" id="qcount"></span>
    <button class="mini" id="q-prev" title="${T.prevHit}"><svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg></button>
    <button class="mini" id="q-next" title="${T.nextHit}"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
  </div>
  <span class="grow"></span>
  <button class="tb" id="b-probs" title="${T.problemsTitle}"><svg viewBox="0 0 24 24"><path d="M12 3L2 21h20z M12 10v5 M12 18h.01"/></svg><span class="lbl">${T.problems}</span><span class="badge" id="pbadge">0</span></button>
  <button class="tb" id="b-reload" title="${T.reloadTitle}"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg><span class="lbl">${T.reload}</span></button>
  ${EDITING ? `<button class="tb" id="b-import" title="${T.importTitle}"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg><span class="lbl">${T.import}</span></button>` : ""}
  <div class="setwrap">
    <button class="tb" id="b-set" title="${T.settings}" aria-haspopup="dialog" aria-expanded="false"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>
    <div class="setpop" id="setpop" role="dialog" aria-label="${T.settings}" hidden>
      <div class="setrow"><span class="setlbl">${T.language}</span>
        ${UI_LANGS.map(l => `<button class="chip${UI_LANG === l ? " on" : ""}" data-lang="${l}" aria-pressed="${UI_LANG === l}">${l.toUpperCase()}</button>`).join("")}
      </div>
    </div>
  </div>
  <button class="tb primary" id="b-print" title="${T.printTitle}"><svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg><span class="lbl">${T.print}</span></button>
  <input type="file" id="f-import" accept=".md,.txt,.css,text/markdown,text/plain,text/css" hidden>
  <input type="file" id="f-img" accept="image/png,image/jpeg,image/webp" hidden>
  <input type="file" id="f-open" accept=".md,.css,.zip,.png,.jpg,.jpeg,.webp" multiple hidden>
  <input type="file" id="f-dir" webkitdirectory hidden>
</div>

<nav id="toc"></nav>
<main id="view"><div id="doc" class="book theme-dark"></div></main>

<aside id="probs" hidden>
  <header>
    <h2>${T.problemsHead}</h2>
    <button class="btn" id="b-copyrep" title="${T.copyForAiTitle}">${T.copyForAi}</button>
    <button class="tb" id="b-closeprobs" title="${T.close}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </header>
  <div class="list" id="plist"></div>
</aside>

<div id="status" hidden></div>

<div class="overlay" id="splash" hidden>
  <div class="card">
    <h1 id="sp-title">${T.openBook}</h1>
    <div id="sp-body"></div>
  </div>
</div>

<div class="overlay" id="printdlg" hidden>
  <div class="card">
    <h2>${T.printHead}</h2>
    <p class="muted">${T.printIntro}</p>
    <div class="cols">
      <div>
        <h3>${T.pageSize}</h3>
        <div id="fmtlist"></div>
      </div>
      <div>
        <h3>${T.printSettings}</h3>
        <div class="opt"><label><input type="checkbox" id="o-bleed"> ${T.bleed}</label>
          <small>${T.bleedHelp}</small></div>
        <div class="opt"><label>${T.colors}
          <select id="o-theme"><option value="">${T.asInBook}</option><option value="dark">${T.darkBg}</option><option value="light">${T.lightBg}</option></select></label></div>
        <div class="opt"><label>${T.pages}
          <select id="o-range"></select></label>
          <span id="o-custom" hidden>${T.from} <input type="number" id="o-from" min="1"> ${T.to} <input type="number" id="o-to" min="1"></span></div>
        <h3>${T.preview}</h3>
        <div id="pv"></div>
        <p class="muted" id="pvnote"></p>
      </div>
    </div>
    <div class="howto">
      <b>${T.howtoHead}</b>
      <ol><li>${T.howto1}</li><li>${T.howto2}</li><li>${T.howto3}</li></ol>
    </div>
    <div class="actions">
      <button class="btn" id="p-close">${T.close}</button>
      <button class="btn primary" id="p-go"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>${T.printGo}</button>
    </div>
  </div>
</div>
`);
document.head.insertAdjacentHTML("beforeend", '<style id="pagesize"></style>');

/* =====================================================================
   FIXED SETTINGS
   ===================================================================== */
const VIEWER_VERSION = "2.0";

/* Print sizes, in mm. A book picks its default with "format:" in data.md: one of these ids,
   or a custom "W x H mm|cm|in". Old ids are still accepted (FORMAT_ALIAS). */
const FORMATS = [
  {id:"original", g:"screen", w:134, h:189.4},
  {id:"a4", g:"office", w:210, h:297, name:"A4"},
  {id:"letter", g:"office", w:215.9, h:279.4},
  {id:"a5", g:"office", w:148, h:210, name:"A5"},
  {id:"5x8in", g:"trade", w:127, h:203.2},
  {id:"5.5x8.5in", g:"trade", w:139.7, h:215.9},
  {id:"6x9in", g:"trade", w:152.4, h:228.6},
  {id:"7x10in", g:"trade", w:177.8, h:254},
  {id:"8x10in", g:"trade", w:203.2, h:254},
  {id:"8.5x11in", g:"trade", w:215.9, h:279.4},
  {id:"14x21cm", g:"metric", w:140, h:210},
  {id:"15.6x23.4cm", g:"metric", w:156, h:234},
  {id:"16x23cm", g:"metric", w:160, h:230},
  {id:"17x24cm", g:"metric", w:170, h:240},
  {id:"b5", g:"metric", w:176, h:250, name:"B5"}
];
const FORMAT_ALIAS = {"14x21": "14x21cm", "16x23": "16x23cm", "17x24": "17x24cm", kdp6x9: "6x9in", kdp7x10: "7x10in",
  kdp8x10: "8x10in", kdp85x11: "8.5x11in", carta: "letter", "6x9": "6x9in", "8.5x11": "8.5x11in"};
const MM_MIN = 50, MM_MAX = 600;
/* "15 x 22 cm", "5.25x8in", "130×200" (mm) → {w, h} in mm, or null */
function parseSize(v) {
  const m = String(v || "").match(/^\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|in)?\s*$/i);
  if (!m) return null;
  const k = {mm: 1, cm: 10, in: 25.4}[(m[3] || "mm").toLowerCase()];
  const w = parseFloat(m[1].replace(",", ".")) * k, h = parseFloat(m[2].replace(",", ".")) * k;
  return w >= MM_MIN && h >= MM_MIN && w <= MM_MAX && h <= MM_MAX ? {w, h, unit: (m[3] || "mm").toLowerCase(), a: m[1], b: m[2]} : null;
}
function fmtLabel(f, lang = UI_LANG) {
  const n = v => new Intl.NumberFormat(lang, {maximumFractionDigits: 2}).format(v);
  const S = lang === UI_LANG ? T : {...STRINGS.en};
  const cm = `${n(f.w / 10)} × ${n(f.h / 10)} cm`;
  if (f.id === "custom") return `${S.custom} — ${f.unit === "in" ? `${n(+f.a.replace(",", "."))} × ${n(+f.b.replace(",", "."))} in (${cm})` : cm}`;
  if (f.id === "original") return `${S.screenName} — ${cm}`;
  if (f.g === "trade") return `${n(f.w / 25.4)} × ${n(f.h / 25.4)} in — ${cm}`;
  if (f.id === "letter") return `${S.letter} — ${n(8.5)} × 11 in (${cm})`;
  return f.name ? `${f.name} — ${cm}` : cm;
}
const fmtName = f => fmtLabel(f);
const fmtNameEn = f => fmtLabel(f, "en");
/* the size the book asks for: a known id or a custom size (null if the value is not usable) */
function bookFormat() {
  const raw = state.book?.meta.format;
  return raw ? formatFrom(raw) : FORMATS[0];
}
/* a known id (or old alias) or a custom "W x H unit" → format, or null */
function formatFrom(raw) {
  const id = FORMAT_ALIAS[norm(raw)] || norm(raw).replace(/\s+/g, "");
  const known = FORMATS.find(x => x.id === id);
  if (known) return known;
  const c = parseSize(raw);
  return c ? {id: "custom", g: "book", ...c} : null;
}

/* Properties accepted at each level of data.md */
const KEYS = {
  book:    ["title","author","chapters","footer","first-page","format","theme","language","cover"],
  chapter: ["subtitle","tags","image","image-prompt","opener","layout","class"],
  page:    ["subtitle","lede","logo","logo-prompt","image","image-prompt","layout","class"],
  box:     ["icon","color","width","height","type","columns","image","image-prompt","caption","title","layout","class","area"]
};
/* Old Portuguese keys, only to point people to the new name */
const OLD_KEYS = {livro:"title", autor:"author", "total-capitulos":"chapters", rodape:"footer", "pagina-inicial":"first-page", formato:"format", tema:"theme",
  subtitulo:"subtitle", destaques:"tags", imagem:"image", "prompt-imagem":"image-prompt", capa:"opener", selo:"lede", "prompt-logo":"logo-prompt",
  icone:"icon", cor:"color", largura:"width", altura:"height", tipo:"type", colunas:"columns", legenda:"caption", titulo:"title"};
const WIDTHS = {"1/4":3,"1/3":4,"1/2":6,"2/3":8,"3/4":9,"full":12,"100%":12};
const TYPES = ["text","image","cards"];
/* names the book uses as CSS classes or tokens (color, class, area, layout, theme) */
const TOKEN = /^[a-z][a-z0-9_-]*$/i;
/* Default image sizes (the ones image generators usually offer) */
const IMG_SIZE = {
  en: {logo:"1024 × 1024 (square)", page:"1024 × 1536 (portrait)", image:"1536 × 1024 (landscape)", opener:"1536 × 1024 (landscape)"},
  pt: {logo:"1024 × 1024 (quadrada)", page:"1024 × 1536 (vertical)", image:"1536 × 1024 (horizontal)", opener:"1536 × 1024 (horizontal)"},
  es: {logo:"1024 × 1024 (cuadrada)", page:"1024 × 1536 (vertical)", image:"1536 × 1024 (horizontal)", opener:"1536 × 1024 (horizontal)"},
  fr: {logo:"1024 × 1024 (carrée)", page:"1024 × 1536 (portrait)", image:"1536 × 1024 (paysage)", opener:"1536 × 1024 (paysage)"},
  de: {logo:"1024 × 1024 (quadratisch)", page:"1024 × 1536 (Hochformat)", image:"1536 × 1024 (Querformat)", opener:"1536 × 1024 (Querformat)"}
};

/* Icons (simple 24×24 line drawings) */
const C = (x,y,r) => `M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0`;
const ICONS = {
  question:"M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 18.5h.01",
  bulb:"M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V16h6v-.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5z",
  plus:"M12 5v14M5 12h14",
  at:C(12,12,4)+"M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8",
  gear:C(12,12,3)+"M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
  chart:"M3 21h18M6.5 17v-5M12 17V7M17.5 17v-8",
  document:"M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8zM14 2.5V8h5.5M8.5 13h7M8.5 17h7",
  star:"M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z",
  trophy:"M8 21h8M12 16.5V21M7 3.5h10V9a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
  clock:C(12,12,9)+"M12 7v5l3.5 2",
  people:C(9,8,3.2)+"M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5",
  check:C(12,12,9)+"M8 12.5l3 3 5-6",
  target:C(12,12,9)+C(12,12,5)+C(12,12,1),
  trend:"M3 17l6-6 4 4 8-8M15 7h6v6",
  search:C(11,11,7)+"M21 21l-5-5",
  bolt:"M13 2L4 14h7l-1 8 9-12h-7z",
  shield:"M12 2.5l8 3.5v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z",
  link:"M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  robot:"M5 8.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-8A1.5 1.5 0 0 1 5 8.5zM12 8.5v-4M9.5 4.5h5M9 13.5v1M15 13.5v1M1.5 13.5v2M22.5 13.5v2",
  table:"M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5zM3.5 9h17M3.5 15h17M9.5 3.5v17",
  money:"M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  chat:"M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z",
  calendar:"M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5zM3.5 10h17M8 3v4M16 3v4",
  pie:"M21 12.5A9 9 0 1 1 11.5 3v9.5zM15 3.3A9 9 0 0 1 20.7 9H15z",
  code:"M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16",
  cloud:"M7 19a5 5 0 1 1 .9-9.9A6.5 6.5 0 0 1 20 11a4 4 0 0 1-1 8z",
  alert:"M12 3L2 21h20zM12 10v5M12 18h.01",
  book:"M2.5 5h6.5a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2.5zM21.5 5H15a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7.5z",
  rocket:"M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 4.5-8.5 11-9.5.6 0 1 .4 1 1C17 10 13 13.5 9 15zM15 9h.01"
};
/* Icon guessed from the box title when "icon:" is missing (title keywords in EN and PT) */
const ICON_BY_TITLE = [
  ["overview","book"],["visao geral","book"],["introduc","book"],["what is","question"],["o que e","question"],["question","question"],["pergunta","question"],
  ["key idea","bulb"],["idea","bulb"],["ideia","bulb"],["tip","bulb"],["dica","bulb"],["how it works","gear"],["como funciona","gear"],["how to","gear"],
  ["step","check"],["passo","check"],["checklist","check"],["example","document"],["exemplo","document"],["watch out","alert"],["warning","alert"],
  ["cuidado","alert"],["atenc","alert"],["mistake","alert"],["erro","alert"],["in numbers","chart"],["numero","chart"],["data","chart"],["dados","chart"],
  ["result","trend"],["resultado","trend"],["goal","target"],["objetivo","target"],["meta","target"],["time","clock"],["tempo","clock"],
  ["people","people"],["pessoas","people"],["cost","money"],["price","money"],["custo","money"],["preco","money"],["code","code"],["codigo","code"],
  ["security","shield"],["seguranca","shield"],["resource","star"],["recurso","star"],["link","link"],
  ["takeaway","trophy"],["summary","trophy"],["resumo","trophy"],["conclus","trophy"]];

/* =====================================================================
   UTILITIES
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icon = (name, cls = "") => `<svg viewBox="0 0 24 24" class="${cls}"><path d="${ICONS[name] || ICONS.star}"/></svg>`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function lev(a, b) {
  const d = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[a.length][b.length];
}
const PREF_KEY = "book-prefs:" + location.pathname;
function prefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; } }
function savePref(k, v) { try { const p = prefs(); if (v === undefined || v === null || v === "") delete p[k]; else p[k] = v; localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {} }

let statusTimer;
function status(msg, ms = 3500) {
  const el = $("#status");
  if (!msg) { el.hidden = true; return; }
  el.innerHTML = msg; el.hidden = false;
  clearTimeout(statusTimer);
  if (ms) statusTimer = setTimeout(() => el.hidden = true, ms);
}

/* Minimal IndexedDB, to remember the book folder */
function idb() {
  return new Promise((ok, fail) => {
    const r = indexedDB.open("book-viewer", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("h");
    r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
  });
}
async function idbGet(k) { const db = await idb(); return new Promise(ok => { const q = db.transaction("h").objectStore("h").get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); }
async function idbSet(k, v) { const db = await idb(); return new Promise(ok => { const t = db.transaction("h", "readwrite"); t.objectStore("h").put(v, k); t.oncomplete = ok; t.onerror = ok; }); }

/* =====================================================================
   PARSING data.md
   Parser warnings carry a message code + arguments, so they can be shown
   in the interface language and copied for the AI in English.
   ===================================================================== */
function parseBook(src) {
  const warn = [];
  const W = (line, code, args = {}) => warn.push({line, code, args});
  src = src.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  src = src.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ""));   // comments vanish but keep their line count
  const lines = src.split("\n");
  const book = {meta: {}, chapters: [], warn};
  let i = 0;

  while (i < lines.length && !lines[i].trim()) i++;
  if ((lines[i] || "").trim() === "---") {
    for (i++; i < lines.length && lines[i].trim() !== "---"; i++) {
      const t = lines[i].trim(); if (!t) continue;
      const m = t.match(/^([^:]+?)\s*:\s*(.*)$/);
      if (!m) { W(i + 1, "fm-line", {text: t}); continue; }
      const k = norm(m[1]);
      if (!KEYS.book.includes(k)) W(i + 1, OLD_KEYS[k] ? "old-key" : "fm-key", {key: m[1], repl: OLD_KEYS[k], list: KEYS.book.join(", ")});
      book.meta[k] = m[2].trim();
    }
    i++;
  }

  let ch = null, pg = null, bx = null, cur = null, inProps = false, last = null;
  const newChapter = (num, title, line) => { ch = {num, title, props: {}, blocks: [], pages: [], line}; book.chapters.push(ch); pg = bx = null; return ch; };
  const newPage = (num, title, line) => { if (!ch) newChapter("", "", line).front = true; pg = {num, title, props: {}, boxes: [], line, ch}; ch.pages.push(pg); bx = null; return pg; };
  const newBox = (title, line) => { if (!pg) newPage("", "", line); bx = {title, props: {}, blocks: [], line, pg}; pg.boxes.push(bx); return bx; };
  const target = () => {
    if (cur.level === "chapter") return ch.blocks;
    if (cur.level === "page") { const b = newBox("", cur.line); b.props.width = "full"; b.implicit = true; cur = {el: b, level: "box", line: cur.line}; return b.blocks; }
    return cur.el.blocks;
  };

  for (; i < lines.length; i++) {
    const raw = lines[i], t = raw.trim(), ln = i + 1;
    let m = t.match(/^(#{1,4})\s+(.+?)\s*#*$/);
    if (m) {
      const lvl = m[1].length, text = m[2].trim();
      last = null;
      if (lvl === 1) {
        const mm = text.match(/^(?:chapter|cap[ií]tulo)\s+([\w.\-]+)\s*[:\-–—|.]\s*(.*)$/i) || text.match(/^(\d+)\s*[:\-–—|.]\s+(.*)$/);
        const mm2 = !mm && text.match(/^(?:chapter|cap[ií]tulo)\s+([\w.\-]+)\s*$/i);
        newChapter(mm ? mm[1] : mm2 ? mm2[1] : "", mm ? mm[2].trim() : mm2 ? "" : text, ln);
        cur = {el: ch, level: "chapter", line: ln}; inProps = true; continue;
      }
      if (lvl === 2) {
        const mm = text.match(/^(\d+(?:[.\-]\d+)*)\s*[:\-–—|.)]?\s+(.+)$/);
        newPage(mm ? mm[1] : "", mm ? mm[2].trim() : text, ln);
        cur = {el: pg, level: "page", line: ln}; inProps = true; continue;
      }
      if (lvl === 3) { newBox(text, ln); cur = {el: bx, level: "box", line: ln}; inProps = true; continue; }
      if (!cur) { W(ln, "h4-early"); continue; }
      inProps = false; target().push({t: "h", text}); continue;
    }
    if (!cur) { if (t && t !== "---") W(ln, "text-early", {text: t.slice(0, 50)}); continue; }

    if (inProps) {
      if (!t) continue;
      const pm = t.match(/^([A-Za-zÀ-ÿ\-]+)\s*:\s*(.*)$/);
      if (pm) {
        const k = norm(pm[1]);
        if (KEYS[cur.level].includes(k)) { cur.el.props[k] = pm[2].trim(); continue; }
        if (OLD_KEYS[k] && KEYS[cur.level].includes(OLD_KEYS[k])) { W(ln, "old-key", {key: pm[1], repl: OLD_KEYS[k]}); continue; }
        const near = k.length > 3 && KEYS[cur.level].find(x => lev(x, k) <= 2);
        if (near) W(ln, "typo", {key: pm[1], near});
        else if (cur.level !== "box") W(ln, "unknown-prop", {key: pm[1], list: KEYS[cur.level].join(", ")});
      }
      inProps = false;
    }

    if (!t) { last = null; continue; }
    const blocks = target();
    let mm;
    if ((mm = raw.match(/^\s*[-*+]\s+(.*)$/))) {
      if (!(last && last.t === "ul")) { last = {t: "ul", items: []}; blocks.push(last); }
      last.items.push(mm[1]); continue;
    }
    if ((mm = raw.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (!(last && last.t === "ol")) { last = {t: "ol", items: []}; blocks.push(last); }
      last.items.push(mm[1]); continue;
    }
    if (last && (last.t === "ul" || last.t === "ol") && /^\s{2,}\S/.test(raw)) { last.items[last.items.length - 1] += " " + t; continue; }
    if ((mm = t.match(/^>\s?(.*)$/))) {
      if (!(last && last.t === "quote")) { last = {t: "quote", paras: [""]}; blocks.push(last); }
      if (!mm[1].trim()) last.paras.push(""); else { const p = last.paras; p[p.length - 1] += (p[p.length - 1] ? " " : "") + mm[1].trim(); }
      continue;
    }
    if ((mm = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { blocks.push({t: "img", alt: mm[1], src: mm[2]}); last = null; continue; }
    if (/^https:\/\/\S+$/.test(t)) { blocks.push({t: "link", url: t, text: t}); last = null; continue; }
    if ((mm = t.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/))) { blocks.push({t: "link", url: mm[2], text: mm[1]}); last = null; continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { blocks.push({t: "hr"}); last = null; continue; }
    if (last && last.t === "p") { last.text += " " + t; continue; }
    last = {t: "p", text: t}; blocks.push(last);
  }
  return book;
}

/* Inline text: **bold**, *italic*, `code` and links. Everything is escaped
   FIRST; only these few tags are added back, and links must be https. */
function inline(s) {
  const stash = [];
  const keep = h => "\u0000" + (stash.push(h) - 1) + "\u0000";
  let h = esc(s);
  h = h.replace(/\[([^\]]+)\]\((https:[^)\s]+)\)/g, (m, t, u) => keep(`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`));
  h = h.replace(/https:\/\/[^\s<\u0000]+[^\s<.,;:!?)\u0000]/g, u => keep(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`));
  h = h.replace(/`([^`]+)`/g, (m, c) => keep(`<code>${c}</code>`));
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/__(.+?)__/g, "<strong>$1</strong>");
  h = h.replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, "$1<em>$2</em>");
  return h.replace(/\u0000(\d+)\u0000/g, (m, n) => stash[n]);
}

/* Image paths stay inside the book folder: relative, no "..", no scheme */
const safePath = p => {
  const s = String(p || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  return s && !/^[a-z][\w+.-]*:/i.test(s) && !s.startsWith("/") && !s.split("/").includes("..") ? s : "";
};

/* =====================================================================
   BUILDING THE PAGES
   ===================================================================== */
const state = {
  text: null, book: null, pages: [], dir: null, src: null, blobs: new Map(),
  problems: [], missing: new Map(), imgBust: 0, zoom: null, cur: 0, hits: [], hit: -1, rendering: false,
  layout: {tpl: new Map(), notes: [], status: "missing"}, noTpl: new Set(), styleDropped: [], fontBlobs: new Map(), fontMissing: []
};

/* The size in use: the reader's choice in the print dialog (only while the book still asks for the
   same size it asked for when the choice was made), otherwise the book's own default. */
function currentFormat() {
  const p = prefs(), book = bookFormat() || FORMATS[0];
  if (EXPORT) return EXPORT.get("format") ? formatFrom(EXPORT.get("format")) || book : book;
  if (p.format && p.formatFor === (state.book?.meta.format || "")) {
    const f = FORMATS.find(x => x.id === p.format);
    if (f) return f;
  }
  return book;
}
function currentTheme() {
  const t = norm((EXPORT ? EXPORT.get("theme") : prefs().theme) || state.book?.meta.theme || "dark");
  return TOKEN.test(t) ? t : "dark";   // .theme-NAME in the book's style.css
}
function bleedOn() { return EXPORT ? EXPORT.get("bleed") === "1" : !!prefs().bleed; }
const bleedMm = f => bleedOn() ? (f.g === "trade" ? 3.2 : 3) : 0;

/* An image frame is any element with class "img" and data-path; hydrateOne puts
   the <img> (or a "missing image" placeholder) inside it. */
function setImg(el, path, kind, prompt, label) {
  el.classList.add("img");
  el.dataset.path = safePath(path); el.dataset.kind = kind;
  el.dataset.prompt = prompt || ""; el.dataset.label = label || "";
}
function imgEl(path, kind, prompt, label) {
  return `<div class="img" data-path="${esc(safePath(path))}" data-kind="${kind}" data-prompt="${esc(prompt || "")}" data-label="${esc(label || "")}"></div>`;
}

/* A name the book's CSS will use (color, class, area): letters, digits, "-" and "_" */
function bookToken(key, value, line, pg) {
  const v = String(value || "").trim();
  if (!v) return "";
  const parts = v.split(/\s+/);
  if (parts.every(x => TOKEN.test(x))) return parts.join(" ");
  addProblem("warn", "color", "color", {key, name: v, line}, pg);
  return parts.filter(x => TOKEN.test(x)).join(" ");
}

function boxIconName(bx) {
  let name = norm(bx.props.icon || "");
  if (name && !ICONS[name]) { addProblem("warn", "icon", "icon", {name: bx.props.icon, line: bx.line, list: Object.keys(ICONS).join(", ")}, bx.pg); name = ""; }
  if (!name) { const t = norm(bx.title); name = (ICON_BY_TITLE.find(([k]) => t.includes(k)) || [0, "book"])[1]; }
  return name;
}

function renderBlocks(blocks, bx) {
  const colN = parseInt(bx?.props.columns || "1", 10);
  const colCls = colN === 2 ? " class=\"cols2\"" : colN >= 3 ? " class=\"cols3\"" : "";
  return blocks.map(b => {
    switch (b.t) {
      case "p": return `<p>${inline(b.text)}</p>`;
      case "h": return `<h4>${inline(b.text)}</h4>`;
      case "ul": return `<ul${colCls}>${b.items.map(x => `<li>${inline(x)}</li>`).join("")}</ul>`;
      case "ol": return `<ol${colCls}>${b.items.map(x => `<li>${inline(x)}</li>`).join("")}</ol>`;
      case "quote": return `<div class="callout">${b.paras.filter(Boolean).map(p => `<p>${inline(p)}</p>`).join("")}</div>`;
      case "link": return `<a class="linkbtn" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.text)}</a>`;
      case "img": return `<div class="inline-img">${imgEl(b.src, "image", b.alt, b.alt)}</div>`;
      case "hr": return "<hr>";
    }
    return "";
  }).join("");
}

function renderCards(bx) {
  const items = bx.blocks.filter(b => b.t === "ul" || b.t === "ol").flatMap(b => b.items);
  const cards = items.map(it => {
    const m = it.match(/^([A-Za-zÀ-ÿ]+)\s*:\s*(.*)$/);
    let ic = "check", text = it;
    if (m && ICONS[norm(m[1])]) { ic = norm(m[1]); text = m[2]; }
    else if (m && m[1].length < 14 && !/\s/.test(m[1]) && /^[a-z]/.test(m[1])) addProblem("warn", "icon", "card-icon", {name: m[1], line: bx.line, list: Object.keys(ICONS).join(", ")}, bx.pg);
    return `<div class="cardi">${icon(ic)}<div>${inline(text)}</div></div>`;
  }).join("");
  const n = Math.max(1, Math.min(items.length, 5));
  const rest = bx.blocks.filter(b => !(b.t === "ul" || b.t === "ol"));
  return `${renderBlocks(rest, bx)}<div class="cards" style="--n:${n}">${cards}</div>`;
}

/* =====================================================================
   BOOK LAYOUT (layout.html)
   The layout belongs to the book. layout.html holds <template id="...">
   elements, style.css styles them, and the engine only fills them in:
     {{path}}                 a value (in text, or in class / data-* attributes)
     data-if="path"           keeps the element only if the value is not empty ("!path": only if empty)
     data-each="path"         repeats the element for each item of a list ({{item.x}} inside)
     data-slot="name"         the engine fills the element (boxes, body, icon, image, logo, intro)
     data-image="images/x"    a fixed image from the book folder
     data-fit="--v MIN MAX [shrink%]"   the engine fits the CSS variable --v so the content fits
   Templates are sanitized: structural HTML and simple SVG only, no scripts,
   links, forms, ids or url().
   ===================================================================== */
const LAYOUT_TAGS = new Set(("div span section header footer aside article nav main figure figcaption h1 h2 h3 h4 h5 h6 " +
  "p b i em strong small sup sub br hr ul ol li blockquote svg g path circle ellipse rect line polyline polygon").split(" "));
const LAYOUT_ATTRS = new Set(("class style viewbox d cx cy r rx ry x y x1 y1 x2 y2 width height points fill stroke stroke-width " +
  "stroke-linecap stroke-linejoin stroke-dasharray opacity fill-opacity stroke-opacity transform preserveaspectratio aria-hidden").split(" "));
/* CSS escapes are decoded before checking, so "u\72l(" is caught too */
const cssDecode = s => String(s).replace(/\\([0-9a-f]{1,6})\s?/gi, (m, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff) || 0xfffd)).replace(/\\(.)/g, "$1");
const BAD_CSS = /url\s*\(|image-set\s*\(|src\s*\(|expression\s*\(|javascript:|vbscript:|@import|-moz-binding|behavior\s*:/i;
const badCss = s => BAD_CSS.test(cssDecode(s));
/* Custom fonts: the only url() a book may use, inside @font-face src, naming a file in its fonts/ folder */
const FONT_PATH = /^fonts\/[a-z0-9][a-z0-9-]*\.(woff2|woff|ttf|otf)$/;
const FONT_SRC = /^(?:local\(\s*(?:"[^"\\]*"|'[^'\\]*'|[\w -]+)\s*\)|url\(\s*(["']?)([^"'()\s\\]+)\1\s*\)(?:\s+format\(\s*(["']?)(woff2|woff|truetype|opentype)\3\s*\))?)$/i;
/* default template for each kind of thing the engine lays out */
const DEFAULT_TPL = {page: "page", opener: "opener", box: "box", image: "image-box"};
const KIND_NAME = {page: "pages", opener: "chapter openers", box: "boxes", image: "image boxes"};

function parseFit(spec) {
  const m = String(spec || "").trim().match(/^(--[a-z0-9-]+)\s+(\d+(?:\.\d+)?)(pt|u)\s+(\d+(?:\.\d+)?)(pt|u)(?:\s+(\d+(?:\.\d+)?)%)?$/i);
  if (!m || m[3].toLowerCase() !== m[5].toLowerCase() || +m[2] > +m[4]) return null;
  return {prop: m[1], lo: +m[2], hi: +m[4], unit: m[3].toLowerCase(), shrink: Math.min(50, +m[6] || 0) / 100};
}

function cleanTemplate(root, id, removed, notes) {
  for (const n of [...root.childNodes]) {
    if (n.nodeType === 3) continue;
    if (n.nodeType !== 1) { n.remove(); continue; }
    const tag = n.localName.toLowerCase();
    if (!LAYOUT_TAGS.has(tag)) { removed.add(`<${tag}>`); n.remove(); continue; }
    for (const a of [...n.attributes]) {
      const name = a.name.toLowerCase();
      const ok = (name.startsWith("data-") ? /^data-[a-z0-9-]+$/.test(name) : LAYOUT_ATTRS.has(name)) && !badCss(a.value);
      if (!ok) { removed.add(`${name}="…"`); n.removeAttribute(a.name); }
    }
    if (n.hasAttribute("data-fit") && !parseFit(n.getAttribute("data-fit"))) {
      notes.push({code: "layout-fit", args: {id, spec: n.getAttribute("data-fit")}});
      n.removeAttribute("data-fit");
    }
    cleanTemplate(n, id, removed, notes);
  }
}

/* text: layout.html without the wrapper. Returns the templates and the notes about them */
function parseLayout(text) {
  const tpl = new Map(), notes = [];
  const doc = new DOMParser().parseFromString(String(text || ""), "text/html");   // inert: nothing runs
  for (const t of doc.querySelectorAll("template[id]")) {
    const id = t.id.trim();
    if (!TOKEN.test(id) || tpl.has(id)) continue;
    const removed = new Set();
    cleanTemplate(t.content, id, removed, notes);
    if (removed.size) notes.push({code: "layout-strip", args: {id, what: [...removed].slice(0, 8).join(", ")}});
    tpl.set(id, t.content);
  }
  return {tpl, notes};
}

/* Used only while the book has no layout.html (or lacks a default template) */
const FALLBACK = parseLayout(`
<template id="page"><div class="fb-head"><b>{{page.num}}</b> {{page.title}}</div><p class="fb-sub" data-if="page.subtitle">{{page.subtitle}}</p>
  <div class="fb-body" data-fit="--fs 4.5pt 12pt"><div class="fb-boxes" data-slot="boxes"></div></div><div class="fb-foot">{{page.number}}</div></template>
<template id="opener"><div class="fb-opener"><div class="fb-sub">{{chapter.label}}</div><h1>{{chapter.title}}</h1><p class="fb-sub" data-if="chapter.subtitle">{{chapter.subtitle}}</p>
  <div class="fb-img" data-if="chapter.image"><div data-slot="image"></div></div></div></template>
<template id="box"><section class="fb-box"><h3 data-if="box.title">{{box.title}}</h3><div data-slot="body"></div></section></template>
<template id="image-box"><section class="fb-box"><div class="fb-img"><div data-slot="image"></div></div><p class="fb-sub" data-if="box.caption">{{box.caption}}</p></section></template>`).tpl;

function setLayout(text) {   // text: string, null = no layout.html, undefined = damaged wrapper
  const parsed = typeof text === "string" ? parseLayout(text) : {tpl: new Map(), notes: []};
  state.layout = {...parsed, status: typeof text === "string" ? "ok" : text === null ? "missing" : "broken", text};
}

/* values: own properties only, so a template cannot reach anything but the book's data */
function lookup(ctx, path) {
  let v = ctx;
  for (const k of String(path).trim().split(".")) {
    if (v == null || typeof v !== "object" || !Object.prototype.hasOwnProperty.call(v, k)) return "";
    v = v[k];
  }
  return v == null ? "" : v;
}
const filled = v => Array.isArray(v) ? v.length > 0 : typeof v === "object" ? false : String(v).trim() !== "";
const PH = /\{\{\s*([\w.-]+)\s*\}\}/g;
const plain = v => Array.isArray(v) || typeof v === "object" ? "" : String(v);

function fillText(node, ctx) {
  const src = node.nodeValue;
  let html = "", last = 0;
  for (const m of src.matchAll(PH)) {
    html += esc(src.slice(last, m.index)) + inline(plain(lookup(ctx, m[1])));
    last = m.index + m[0].length;
  }
  const t = document.createElement("template");
  t.innerHTML = html + esc(src.slice(last));
  node.replaceWith(t.content);
}
function fillEl(n, ctx, slots) {
  const cond = n.getAttribute("data-if");
  if (cond != null) {
    n.removeAttribute("data-if");
    const neg = cond.trim().startsWith("!");
    if (filled(lookup(ctx, cond.trim().replace(/^!\s*/, ""))) === neg) { n.remove(); return; }
  }
  for (const a of [...n.attributes]) {
    if (!a.value.includes("{{")) continue;
    const name = a.name.toLowerCase();
    if (name === "class") n.setAttribute("class", a.value.replace(PH, (m, p) => plain(lookup(ctx, p)).split(/\s+/).filter(x => TOKEN.test(x)).join(" ")).replace(/\s+/g, " ").trim());
    else if (name.startsWith("data-")) n.setAttribute(a.name, a.value.replace(PH, (m, p) => plain(lookup(ctx, p))));
  }
  const slot = n.getAttribute("data-slot");
  if (slot != null) {
    n.removeAttribute("data-slot");
    const f = slots[slot.trim()];
    if (f) { n.replaceChildren(); f(n); return; }
  }
  const img = n.getAttribute("data-image");
  if (img != null) { n.removeAttribute("data-image"); setImg(n, img, "image", "", ""); return; }
  fillTree(n, ctx, slots);
}
function fillTree(root, ctx, slots) {
  for (const n of [...root.childNodes]) {
    if (n.nodeType === 3) { if (n.nodeValue.includes("{{")) fillText(n, ctx); continue; }
    if (n.nodeType !== 1) continue;
    const each = n.getAttribute("data-each");
    if (each == null) { fillEl(n, ctx, slots); continue; }
    n.removeAttribute("data-each");
    const list = lookup(ctx, each);
    for (const item of Array.isArray(list) ? list : []) { const c = n.cloneNode(true); n.before(c); fillEl(c, {...ctx, item}, slots); }
    n.remove();
  }
}

/* Picks the template ("layout:" in data.md, else the default for the kind) and fills it */
function instantiate(kind, name, ctx, slots, line, pg) {
  const L = state.layout;
  let id = String(name || "").trim();
  if (id && !L.tpl.has(id)) {
    if (L.status === "ok") addProblem("warn", "layout", "layout-unknown", {name: id, line, list: [...L.tpl.keys()].join(", ") || "(none)"}, pg);
    id = "";
  }
  id = id || DEFAULT_TPL[kind];
  let src = L.tpl.get(id), fallback = false;
  if (!src) {
    src = FALLBACK.get(DEFAULT_TPL[kind]); fallback = true;
    if (L.status === "ok" && !state.noTpl.has(kind)) { state.noTpl.add(kind); addProblem("err", "layout", "layout-none", {id, kind: KIND_NAME[kind]}); }
  }
  const frag = document.importNode(src, true);
  fillTree(frag, ctx, slots);
  return {frag, id, fallback};
}

/* What templates can read */
function bookCtx() {
  const m = state.book.meta, b = {};
  for (const k of Object.keys(m)) b[k] = m[k];
  b.footer = m.footer || m.author || "";
  return {book: b, label: {chapter: BL().chapter, inChapter: BL().inChapter}};
}
function chapterCtx(ch, n) {
  return {
    num: ch.num || "", title: ch.title || "", subtitle: ch.props.subtitle || "",
    label: ch.num ? `${BL().chapter} ${ch.num}` : "",
    tags: (ch.props.tags || "").split(/[,;]/).map(s => s.trim().replace(/^[A-Za-zÀ-ÿ]+\s*:\s*/, "")).filter(Boolean).slice(0, 8).map(text => ({text})),
    pages: ch.pages.filter(p => p.title).map((p, k) => ({num: p.num || "", title: p.title, page: String(n + 1 + k)})),
    image: ch.props.image || "", intro: ch.blocks.length ? "yes" : "",
    class: bookToken("class", ch.props.class, ch.line)
  };
}

function renderBox(bx) {
  let span = 4;
  const lw = norm(bx.props.width || "1/3").replace(/\s/g, "");
  if (WIDTHS[lw]) span = WIDTHS[lw];
  else if (/^\d+$/.test(lw) && +lw >= 1 && +lw <= 12) span = +lw;
  else addProblem("warn", "width", "width", {name: bx.props.width, line: bx.line}, bx.pg);
  const rows = Math.max(1, Math.min(6, parseInt(bx.props.height || "1", 10) || 1));
  const type = norm(bx.props.type || (bx.props.image ? "image" : "text"));
  if (!TYPES.includes(type)) addProblem("warn", "type", "type", {name: bx.props.type, line: bx.line}, bx.pg);
  const hideTitle = norm(bx.props.title || "") === "hidden" || !bx.title;
  const isImg = type === "image", path = bx.props.image || "";
  if (isImg && !path) addProblem("err", "image", "img-box", {title: bx.title, line: bx.line}, bx.pg);
  const iconName = isImg ? "" : boxIconName(bx);
  const area = bookToken("area", bx.props.area, bx.line, bx.pg).split(" ")[0] || "";
  const box = {
    title: hideTitle ? "" : bx.title, name: bx.title, icon: iconName, type: TYPES.includes(type) ? type : "text",
    color: bookToken("color", bx.props.color || "primary", bx.line, bx.pg), width: lw, span: String(span), rows: String(rows),
    area, caption: bx.props.caption || "", image: path, class: bookToken("class", bx.props.class, bx.line, bx.pg)
  };
  const slots = {
    icon: el => { if (iconName) el.innerHTML = icon(iconName); },
    body: el => { el.innerHTML = type === "cards" ? renderCards(bx) : renderBlocks(bx.blocks, bx); },
    image: el => { if (path) setImg(el, path, "image", bx.props["image-prompt"], bx.title); }
  };
  const {frag} = instantiate(isImg ? "image" : "box", bx.props.layout, {...bookCtx(), page: bx.pg.ctx, chapter: bx.pg.ch.ctx, box}, slots, bx.line, bx.pg);
  const root = frag.firstElementChild;
  if (root) {
    root.style.setProperty("--span", span); root.style.setProperty("--rows", rows);
    if (area) { root.style.setProperty("--area", area); root.dataset.area = area; }
  }
  return frag;
}

function pageShell(n, id, fallback, cls) {
  const el = document.createElement("section");
  el.className = ["page", n % 2 ? "odd" : "even", cls].filter(Boolean).join(" ");
  el.dataset.n = n; el.dataset.layout = id;
  if (fallback) el.dataset.fallback = "";
  return el;
}

function renderPage(pg, n, cover = false) {
  const ch = pg.ch;
  pg.ctx = {
    num: pg.num || "", title: pg.title || "", subtitle: pg.props.subtitle || "", lede: pg.props.lede || "",
    logo: pg.props.logo || "", image: pg.props.image || "", number: cover ? "" : String(n), side: cover || n % 2 ? "odd" : "even", class: bookToken("class", pg.props.class, pg.line, pg)
  };
  const slots = {
    boxes: el => { for (const bx of pg.boxes) el.append(renderBox(bx)); },
    logo: el => { if (pg.props.logo) setImg(el, pg.props.logo, "logo", pg.props["logo-prompt"], pg.title); },
    image: el => { if (pg.props.image) setImg(el, pg.props.image, "page", pg.props["image-prompt"], pg.title); }
  };
  const {frag, id, fallback} = instantiate("page", pg.props.layout, {...bookCtx(), chapter: ch.ctx, page: pg.ctx}, slots, pg.line, pg);
  const el = pageShell(cover ? n - 1 : n, id, fallback, [ch.ctx.class, pg.ctx.class, cover ? "cover" : ""].filter(Boolean).join(" "));
  if (cover) el.classList.replace("even", "odd");
  el.append(frag);
  return el;
}

function renderOpener(ch, n) {
  const slots = {
    image: el => { if (ch.props.image) setImg(el, ch.props.image, "opener", ch.props["image-prompt"], BL().opener(ch.num)); },
    intro: el => { el.innerHTML = renderBlocks(ch.blocks); }
  };
  const page = {num: "", title: ch.title || "", number: String(n), side: n % 2 ? "odd" : "even", class: ""};
  const {frag, id, fallback} = instantiate("opener", ch.props.layout, {...bookCtx(), chapter: ch.ctx, page}, slots, ch.line);
  const el = pageShell(n, id, fallback, ch.ctx.class);
  el.append(frag);
  return el;
}

/* level: err | warn | info; kind: short label key; code + args: message */
function addProblem(level, kind, code, args, pg) {
  state.problems.push({level, kind, code, args: args || {}, pageRef: pg});
}
const problemText = (p, lang = UI_LANG) => (PROBLEMS[lang]?.[p.code] || PROBLEMS.en[p.code])(p.args);
const kindText = (k, lang = UI_LANG) => KIND_LABEL[lang]?.[k] || KIND_LABEL.en[k] || k.toUpperCase();

async function render(keepPlace = true) {
  if (!state.book) return;
  state.rendering = true;
  const keep = keepPlace ? state.cur : 0;
  state.problems = []; state.missing = new Map(); state.noTpl = new Set();
  const book = state.book, meta = book.meta;
  for (const w of book.warn) addProblem("err", "data", "data", {line: w.line, code: w.code, args: w.args});
  if (!book.chapters.length) addProblem("err", "data", "no-chapters");
  const L = state.layout;
  if (L.status === "missing") addProblem("err", "layout", "layout-missing");
  if (L.status === "broken") addProblem("err", "layout", "layout-broken");
  for (const x of L.notes) addProblem("warn", "layout", x.code, x.args);
  if (state.styleDropped.length) addProblem("warn", "style", "style-drop", {n: state.styleDropped.length, list: state.styleDropped.slice(0, 4).join(" | ")});

  if (meta.format && !bookFormat()) addProblem("warn", "format", "format", {value: meta.format, min: MM_MIN, max: MM_MAX});
  const f = currentFormat(), bl = bleedMm(f);
  const doc = $("#doc");
  doc.className = `book theme-${currentTheme()}`;
  doc.style.setProperty("--pw", f.w); doc.style.setProperty("--ph", f.h); doc.style.setProperty("--bl", bl);
  $("#pagesize").textContent = `@page{size:${f.w + 2 * bl}mm ${f.h + 2 * bl}mm;margin:0}`;
  document.title = meta.title || T.book;
  $("#booktitle").textContent = meta.title || T.book;

  let n = parseInt(meta["first-page"] || "1", 10) || 1;
  const frag = document.createDocumentFragment(), list = [];
  const seen = new Set();
  /* the cover page takes no page number: the page after it is "first-page" (a right-hand page) */
  const coverNum = (meta.cover || "").trim(), noCover = norm(coverNum) === "none";
  for (const ch of book.chapters) {
    const hasOpener = !ch.front && norm(ch.props.opener || "yes") !== "no";   // front pages (before chapter 1) have none
    ch.ctx = chapterCtx(ch, hasOpener ? n : n - 1);
    if (hasOpener) {
      const el = renderOpener(ch, n); frag.append(el);
      list.push({type: "opener", ch, n, el, label: ch.num ? `${BL().chapter} ${ch.num}` : BL().chapter, title: ch.title}); n++;
    }
    for (const pg of ch.pages) {
      if (pg.num && seen.has(pg.num)) addProblem("err", "number", "dup", {num: pg.num, line: pg.line}, pg);
      seen.add(pg.num);
      if (!pg.boxes.length && !pg.props.layout) addProblem("warn", "empty", "empty", {num: pg.num, title: pg.title, line: pg.line}, pg);
      const cover = !noCover && (coverNum ? pg.num === coverNum : !list.length);
      const el = renderPage(pg, n, cover); frag.append(el);
      list.push({type: "sheet", pg, ch, n: cover ? n - 1 : n, el, label: pg.num, title: pg.title, cover});
      if (!cover) n++;
    }
  }
  doc.replaceChildren(frag);
  state.pages = list;
  state.cover = coverIndex();
  $("#pgtot").textContent = `/ ${state.pages.length ? state.pages[state.pages.length - 1].n : 0}`;

  if (state.zoom == null) state.zoom = prefs().zoom || "fit";
  doc.style.zoom = 1;          // always lay out at 100%, like printing
  await fontsReady(doc);
  await fitAll();
  applyZoom();
  buildToc();
  await hydrateImages(doc);
  updateProblems();
  if (keepPlace) goTo(Math.min(keep, state.pages.length - 1), false);
  if ($("#q").value.trim()) runSearch(false);
  state.rendering = false;
}
/* The cover page: "cover:" names a page number, "none" means no cover, nothing means the first page */
function coverIndex() {
  const v = (state.book.meta.cover || "").trim();
  if (!state.pages.length || norm(v) === "none") return -1;
  const k = state.pages.findIndex(p => p.cover);
  if (!v) { addProblem("warn", "cover", "cover-unset", {title: state.pages[0].title || state.pages[0].label || "1"}); return Math.max(k, 0); }
  if (k < 0) addProblem("err", "cover", "cover-missing", {value: v});
  return k;
}
/* parser warnings are stored as {line, code, args}; shown as "line N: message" */
PROBLEMS.en.data = a => `line ${a.line}: ${PROBLEMS.en[a.code](a.args)}`;
PROBLEMS.pt.data = a => `linha ${a.line}: ${PROBLEMS.pt[a.code](a.args)}`;

/* =====================================================================
   AUTOMATIC FITTING
   Every element with data-fit="--v MIN MAX [shrink%]" gets the biggest value
   of --v (between MIN and MAX) for which its content fits inside it. The
   layout decides what --v does (usually a font-size). MIN/MAX in pt, or in
   u = 1% of the page width. If it does not fit at MIN, the page is flagged.
   ===================================================================== */
const FS_WARN = 7;
/* Custom fonts start loading only when some text uses them: the text is fitted after they
   arrive (or fail). Faces that failed, and app-mode files that are not in the book, are reported. */
async function fontsReady(doc) {
  void doc.offsetHeight;
  await Promise.race([document.fonts.ready, sleep(8000)]);
  const bad = new Set(state.fontMissing);
  for (const f of document.fonts) if (f.status === "error") bad.add(f.family.replace(/^["']|["']$/g, ""));
  if (bad.size) addProblem("warn", "style", "font-file", {list: [...bad].slice(0, 6).join(", ")});
}
/* a face that finishes loading later (e.g. style.css saved again) lays the book out again */
document.fonts.addEventListener("loadingdone", () => { if (state.book && !state.rendering) render(true); });
function fitsBox(el) {
  // the real extent of the content (a child taller than the box, or overflowing it, counts)
  const kids = [...el.children];
  const cs = getComputedStyle(el);
  const room = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let top = Infinity, bottom = -Infinity;
  for (const k of kids) {
    const kc = getComputedStyle(k);
    if (kc.position === "absolute" || kc.position === "fixed") continue;
    const kr = k.getBoundingClientRect();
    top = Math.min(top, kr.top - parseFloat(kc.marginTop));
    bottom = Math.max(bottom, Math.max(kr.bottom, kr.top + k.scrollHeight) + parseFloat(kc.marginBottom));
  }
  const used = bottom > top ? bottom - top : 0;
  return {ok: used <= room * .985 - 1 && el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1, ratio: room > 0 ? used / room : 9};
}
function fitRegion(el, f, uPx) {
  const k = f.unit === "u" ? uPx : 1, unit = f.unit === "u" ? "px" : "pt";
  const set = v => el.style.setProperty(f.prop, +(v * k).toFixed(3) + unit);
  const ok = () => fitsBox(el).ok;
  let lo = f.lo, hi = f.hi;
  set(hi);
  if (!ok()) {
    set(lo);
    if (!ok()) return {v: lo, over: true, ratio: fitsBox(el).ratio, unit: f.unit};
    for (let j = 0; j < 9; j++) { const mid = (lo + hi) / 2; set(mid); if (ok()) lo = mid; else hi = mid; }
    hi = lo;
  }
  const v = Math.max(f.lo, hi * (1 - f.shrink));
  set(v);
  return {v, over: false, unit: f.unit};
}
function fitPage(p) {
  const uPx = parseFloat(getComputedStyle($("#doc")).getPropertyValue("--pw")) * .01 * 96 / 25.4;
  const res = [];
  for (const r of $$("[data-fit]", p.el)) {
    const f = parseFit(r.dataset.fit); if (!f) continue;
    res.push({...fitRegion(r, f, uPx), el: r});
  }
  p.el.classList.toggle("overflow", res.some(r => r.over));
  return res;
}

async function fitAll() {
  const many = state.pages.length > 40;
  if (many) status(T.laying, 0);
  const fsl = [];
  for (let k = 0; k < state.pages.length; k++) {
    const p = state.pages[k];
    for (const r of fitPage(p)) {
      if (r.unit === "pt") fsl.push(r.v);
      if (r.over) {
        const words = (r.el.innerText.match(/\S+/g) || []).length;
        const cut = Math.ceil(words * (1 - 1 / (r.ratio * r.ratio)) / 10) * 10;
        addProblem("err", "overflow", "overflow", {n: p.n, label: p.label, title: p.title, pct: Math.round((r.ratio - 1) * 100), cut: Math.max(10, cut)}, p.pg);
      }
    }
    if (many && k % 20 === 19) await sleep(0);
  }
  if (many) status("");
  if (fsl.length) {
    const mn = Math.min(...fsl), mx = Math.max(...fsl);
    if (mn < FS_WARN) addProblem("info", "font", "font", {fmt: fmtName(currentFormat()), fmtEn: fmtNameEn(currentFormat()), min: mn.toFixed(1), max: mx.toFixed(1), warn: FS_WARN});
  }
}

/* =====================================================================
   IMAGES (with a placeholder while they don't exist yet)
   ===================================================================== */
async function writeAt(path, blob) {
  const parts = path.replace(/^\.?\//, "").split("/").filter(Boolean);
  const name = parts.pop();
  let d = state.dir;
  for (const s of parts) d = await d.getDirectoryHandle(s, {create: true});
  const fh = await d.getFileHandle(name, {create: true});
  const w = await fh.createWritable(); await w.write(blob); await w.close();
}
function urlFor(path) {
  if (!path) return null;
  const src = state.src;
  if (src?.kind === "files") return state.blobs.get(path) || state.blobs.get(path.split("/").pop()) || null;
  return (src?.kind === "fetch" ? src.base : "") + encodeURI(path) + (state.imgBust ? "?v=" + state.imgBust : "");
}
function loadImage(url) {
  return new Promise(ok => { if (!url) return ok(null); const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url; });
}
function initials(s) { return (s || "?").split(/\s+/).filter(w => /^[A-Za-zÀ-ÿ0-9]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join(""); }

async function hydrateOne(el) {
  const path = el.dataset.path, kind = el.dataset.kind;
  const im = await loadImage(urlFor(path));
  if (im) {
    im.alt = el.dataset.label || "";
    el.classList.remove("missing", "can-drop");
    el.replaceChildren(im);
    state.missing.delete(path);
    return;
  }
  el.classList.add("missing");
  el.classList.toggle("can-drop", EDITING && "showDirectoryPicker" in window);
  const size = (IMG_SIZE[UI_LANG] || IMG_SIZE.en)[kind] || "";
  el.innerHTML = `<div class="ini">${esc(initials(el.dataset.label))}</div><div class="t1">${T.missingImg}</div><div class="t2">${esc(path || T.noName)}</div>`
    + `<div class="t3">${size ? T.sizeIs(size) : ""}${EDITING && "showDirectoryPicker" in window ? T.dropHere : APP ? T.askAi : T.saveWithName}</div>`;
  if (kind !== "logo") el.querySelector(".ini").remove();
  if (path && !state.missing.has(path)) state.missing.set(path, {path, kind, prompt: el.dataset.prompt, label: el.dataset.label, el});
}
async function hydrateImages(root) {
  await Promise.all($$(".img[data-path]", root).map(hydrateOne));
}

/* Only real raster images are accepted (checked by content, not by name) */
async function isRaster(file) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return png || jpg || webp;
}

async function saveImageFor(path, file) {
  path = safePath(path);
  if (!path || !(await isRaster(file))) { status(T.dropOnSlot); return; }
  if (!(await ensureDir(T.whyImg))) return;
  let blob = file;
  const wantPng = /\.png$/i.test(path), isPng = file.type === "image/png";
  const wantJpg = /\.jpe?g$/i.test(path), isJpg = file.type === "image/jpeg";
  if ((wantPng && !isPng) || (wantJpg && !isJpg)) {
    const bmp = await createImageBitmap(file);
    const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext("2d").drawImage(bmp, 0, 0);
    blob = await new Promise(ok => cv.toBlob(ok, wantPng ? "image/png" : "image/jpeg", .92));
  }
  try {
    await writeAt(path, blob);
    state.imgBust = Date.now();
    status(T.imgSaved(esc(path)));
    await Promise.all($$(".img[data-path]").filter(e => e.dataset.path === path).map(hydrateOne));
    updateProblems();
  } catch (e) { status(`<span class="err-msg">${T.imgFail(esc(e.message))}</span>`, 6000); }
}

/* drag and drop images onto the placeholders (hidden while EDITING is off) */
let pendingImgPath = null;
if (EDITING) {
document.addEventListener("dragover", e => {
  e.preventDefault();
  $$(".img.over").forEach(x => x.classList.remove("over"));
  const t = e.target.closest?.(".img.missing"); if (t) t.classList.add("over");
});
document.addEventListener("dragleave", e => { const t = e.target.closest?.(".img.missing"); if (t) t.classList.remove("over"); });
document.addEventListener("drop", async e => {
  e.preventDefault();
  $$(".img.over").forEach(x => x.classList.remove("over"));
  const file = e.dataTransfer.files[0]; if (!file) return;
  const t = e.target.closest?.(".img[data-path]");
  if (file.type.startsWith("image/") && t) return saveImageFor(t.dataset.path, file);
  if (/\.(md|txt|css)$/i.test(file.name)) return importText(await file.text(), file.name);
  if (file.type.startsWith("image/")) status(T.dropOnSlot);
});
document.addEventListener("click", e => {
  const t = e.target.closest?.(".img.missing.can-drop");
  if (!t) return;
  pendingImgPath = t.dataset.path; $("#f-img").value = ""; $("#f-img").click();
});
$("#f-img").addEventListener("change", e => { const f = e.target.files[0]; if (f && pendingImgPath) saveImageFor(pendingImgPath, f); });
}

/* =====================================================================
   PROBLEMS
   ===================================================================== */
function updateProblems() {
  const imgs = [...state.missing.values()];
  const errs = state.problems.filter(p => p.level === "err").length;
  const warns = state.problems.length - errs + imgs.length;
  const b = $("#pbadge");
  b.textContent = errs || warns;
  b.className = "badge" + (errs ? " err" : warns ? " warn" : "");
  const box = $("#plist");
  const order = {err: 0, warn: 1, info: 2};
  const items = [...state.problems].sort((a, b) => order[a.level] - order[b.level]).map(p =>
    `<div class="p ${p.level}" data-pk="${state.problems.indexOf(p)}"><b>${esc(kindText(p.kind))}</b>${esc(problemText(p))}</div>`);
  for (const im of imgs) items.push(`<div class="p warn" data-img="${esc(im.path)}"><b>${T.missingImgKind}</b>${esc(im.path)} — ${(IMG_SIZE[UI_LANG] || IMG_SIZE.en)[im.kind] || ""}<span class="prompt">${im.prompt ? esc(T.promptIs(im.prompt)) : T.noPrompt}</span></div>`);
  box.innerHTML = items.length ? items.join("") : `<div class="empty">${T.noProblems}</div>`;
}
$("#plist").addEventListener("click", e => {
  const d = e.target.closest(".p"); if (!d) return;
  if (d.dataset.img) { const im = state.missing.get(d.dataset.img); if (im) im.el.scrollIntoView({block: "center", behavior: "smooth"}); return; }
  const p = state.problems[+d.dataset.pk];
  if (p?.pageRef) { const k = state.pages.findIndex(x => x.pg === p.pageRef); if (k >= 0) goTo(k); }
});
/* The report for the AI is always in English (agent instructions are English) */
function reportText() {
  const f = currentFormat();
  const L = [`VIEWER REPORT — ${state.book?.meta.title || "book"} — page size: ${fmtNameEn(f)}`,
    "Fix the items below in data.md, layout.html or style.css following agent/AGENTS.md. Do not edit index.html.", ""];
  for (const p of state.problems) {
    const args = p.code === "font" ? {...p.args, fmt: p.args.fmtEn} : p.args;
    L.push(`[${kindText(p.kind, "en")}] ${PROBLEMS.en[p.code](args)}`);
  }
  for (const im of state.missing.values()) L.push(`[MISSING IMAGE] ${im.path} — size ${IMG_SIZE.en[im.kind] || "any"} — prompt: ${im.prompt || "(no prompt — write one)"}`);
  if (!state.problems.length && !state.missing.size) L.push("No problems.");
  return L.join("\n");
}
$("#b-copyrep").onclick = async () => {
  try { await navigator.clipboard.writeText(reportText()); status(T.copied); }
  catch { const t = document.createElement("textarea"); t.value = reportText(); document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); status(T.copiedShort); }
};
$("#b-probs").onclick = () => { $("#probs").hidden = !$("#probs").hidden; };
$("#b-closeprobs").onclick = () => { $("#probs").hidden = true; };

/* =====================================================================
   NAVIGATION, ZOOM, CONTENTS
   ===================================================================== */
function pxPage() { const bl = bleedOn() ? 6 : 0, k = 96 / 25.4, f = currentFormat(); return {w: (f.w + bl) * k, h: (f.h + bl) * k}; }
function applyZoom() {
  const view = $("#view");
  let z = state.zoom;
  if (z === "fit") { const pp = pxPage(); z = Math.max(.2, Math.min(3, (view.clientWidth - 48) / pp.w, (view.clientHeight - 40) / pp.h)); }
  $("#doc").style.zoom = z;
  $("#zoomval").textContent = Math.round(z * 100) + "%";
  return z;
}
function setZoom(z) {
  const k = state.cur;
  state.zoom = z; savePref("zoom", z);
  applyZoom(); goTo(k, false);
}
$("#b-zin").onclick = () => setZoom(Math.min(4, +(parseFloat($("#doc").style.zoom || 1) * 1.15).toFixed(2)));
$("#b-zout").onclick = () => setZoom(Math.max(.15, +(parseFloat($("#doc").style.zoom || 1) / 1.15).toFixed(2)));
$("#b-zfit").onclick = () => setZoom("fit");
window.addEventListener("resize", () => { if (state.zoom === "fit") { const k = state.cur; applyZoom(); goTo(k, false); } });

function goTo(k, smooth = true) {
  const p = state.pages[k]; if (!p) return;
  const view = $("#view"), z = parseFloat($("#doc").style.zoom || 1);
  const top = p.el.offsetTop * z - 16;
  view.scrollTo({top, behavior: smooth ? "smooth" : "auto"});
  setCur(k);
}
function setCur(k) {
  state.cur = k;
  const p = state.pages[k]; if (!p) return;
  if (document.activeElement !== $("#pgin")) $("#pgin").value = p.n;
  $$("#toc a.cur").forEach(a => a.classList.remove("cur"));
  const a = $(`#toc a[data-k="${k}"]`); if (a) { a.classList.add("cur"); }
}
let scrollRaf = 0;
$("#view").addEventListener("scroll", () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const mid = $("#view").getBoundingClientRect().top + $("#view").clientHeight * .35;
    let best = 0;
    for (let k = 0; k < state.pages.length; k++) { if (state.pages[k].el.getBoundingClientRect().top <= mid) best = k; else break; }
    if (best !== state.cur) setCur(best);
  });
});
$("#b-prev").onclick = () => goTo(Math.max(0, state.cur - 1));
$("#b-next").onclick = () => goTo(Math.min(state.pages.length - 1, state.cur + 1));
$("#pgin").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const v = e.target.value.trim();
  let k = state.pages.findIndex(p => String(p.n) === v);
  if (k < 0) k = state.pages.findIndex(p => p.label === v);
  if (k < 0) { status(T.noPage(esc(v))); return; }
  goTo(k); e.target.blur();
});
function buildToc() {
  const h = [];
  state.pages.forEach((p, k) => {
    if (p.type === "opener") h.push(`<div class="ch">${esc(p.label)}${p.title ? " · " + esc(p.title) : ""}</div><a href="#" data-k="${k}"><span class="n">⌂</span><span class="t">${T.openerToc}</span><span class="p">${p.n}</span></a>`);
    else h.push(`<a href="#" data-k="${k}"><span class="n">${esc(p.label || "")}</span><span class="t">${esc(p.title)}</span><span class="p">${p.n}</span></a>`);
  });
  $("#toc").innerHTML = h.join("");
}
$("#toc").addEventListener("click", e => { const a = e.target.closest("a"); if (!a) return; e.preventDefault(); goTo(+a.dataset.k); });
$("#b-toc").onclick = () => {
  document.body.classList.toggle("toc-open");
  savePref("toc", document.body.classList.contains("toc-open") ? 1 : "");
  setTimeout(() => { if (state.zoom === "fit") { const k = state.cur; applyZoom(); goTo(k, false); } }, 200);
};

/* =====================================================================
   SEARCH (ignores accents and case)
   ===================================================================== */
function clearHits() {
  for (const m of $$("mark.hit", $("#doc"))) { const t = document.createTextNode(m.textContent); m.replaceWith(t); t.parentNode.normalize(); }
  state.hits = []; state.hit = -1; $("#qcount").textContent = "";
}
function runSearch(jump = true) {
  clearHits();
  const q = norm($("#q").value);
  if (q.length < 2) return;
  const walker = document.createTreeWalker($("#doc"), NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const txt = node.nodeValue; if (txt.length < q.length) continue;
    const base = [...txt].map(c => c.normalize("NFD")[0].toLowerCase()).join("");
    if (base.length !== txt.length) continue;
    const pos = []; let from = 0, at;
    while ((at = base.indexOf(q, from)) >= 0) { pos.push(at); from = at + q.length; }
    for (let j = pos.length - 1; j >= 0; j--) {
      const mid = node.splitText(pos[j]); mid.splitText(q.length);
      const mk = document.createElement("mark"); mk.className = "hit"; mid.replaceWith(mk); mk.append(mid);
    }
  }
  state.hits = $$("mark.hit", $("#doc"));
  if (!state.hits.length) { $("#qcount").textContent = "0"; return; }
  if (jump) {
    const mid = $("#view").getBoundingClientRect().top;
    const k = state.hits.findIndex(m => m.getBoundingClientRect().top >= mid);
    showHit(k < 0 ? 0 : k);
  } else $("#qcount").textContent = `${state.hits.length}`;
}
function showHit(k) {
  if (!state.hits.length) return;
  state.hit = (k + state.hits.length) % state.hits.length;
  state.hits.forEach((m, j) => m.classList.toggle("cur", j === state.hit));
  state.hits[state.hit].scrollIntoView({block: "center"});
  $("#qcount").textContent = T.hitOf(state.hit + 1, state.hits.length);
}
let qTimer;
$("#q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(() => runSearch(true), 250); });
$("#q").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); if (state.hit < 0) runSearch(true); else showHit(state.hit + (e.shiftKey ? -1 : 1)); }
  if (e.key === "Escape") { $("#q").value = ""; clearHits(); $("#q").blur(); }
});
$("#q-next").onclick = () => showHit(state.hit + 1);
$("#q-prev").onclick = () => showHit(state.hit - 1);

document.addEventListener("keydown", e => {
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); $("#q").focus(); $("#q").select(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); openPrint(); return; }
  if (typing || !$("#printdlg").hidden) { if (e.key === "Escape" && !$("#printdlg").hidden) closePrint(); return; }
  if (["ArrowRight", "PageDown"].includes(e.key)) { e.preventDefault(); $("#b-next").click(); }
  if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); $("#b-prev").click(); }
  if (e.key === "Home") goTo(0);
  if (e.key === "End") goTo(state.pages.length - 1);
});

/* =====================================================================
   PRINTING
   ===================================================================== */
function openPrint() {
  if (!state.book) return;
  const f = currentFormat(), p = prefs();
  let groups = "", g = null;
  const book = bookFormat();
  const tag = x => book && x.id === book.id ? ` <span class="fmt-def">${esc(T.bookDefault)}</span>` : "";
  for (const x of FORMATS) {
    if (x.g !== g) { g = x.g; groups += `<div class="fmt-group">${esc(T.fmtGroups[g])}</div>`; }
    groups += `<label class="fmt${x.id === f.id ? " sel" : ""}"><input type="radio" name="fmt" value="${x.id}"${x.id === f.id ? " checked" : ""}><span><span class="nm">${esc(fmtName(x))}${tag(x)}</span><span class="rf">${esc(T.fmtDesc[x.id] || "")}</span></span></label>`;
  }
  /* a custom size sent by the book comes first and is the default */
  if (book?.id === "custom") groups = `<div class="fmt-group">${esc(T.fmtGroups.book)}</div><label class="fmt${f.id === "custom" ? " sel" : ""}"><input type="radio" name="fmt" value=""${f.id === "custom" ? " checked" : ""}><span><span class="nm">${esc(fmtName(book))} <span class="fmt-def">${esc(T.bookDefault)}</span></span><span class="rf">${esc(state.book.meta.format)}</span></span></label>` + groups;
  $("#fmtlist").innerHTML = groups;
  $("#o-bleed").checked = !!p.bleed;
  $("#o-theme").value = p.theme || "";
  const opts = [`<option value="all">${T.allPages(state.pages.length)}</option>`, `<option value="cur">${T.curPage(state.pages[state.cur]?.n)}</option>`];
  state.book.chapters.forEach((c, k) => opts.push(`<option value="ch:${k}">${T.chapterOpt(esc(c.num || k + 1), c.title ? esc(c.title) : "")}</option>`));
  opts.push(`<option value="custom">${T.rangeOpt}</option>`);
  $("#o-range").innerHTML = opts.join("");
  $("#o-from").value = state.pages[0]?.n; $("#o-to").value = state.pages[state.pages.length - 1]?.n;
  $("#o-custom").hidden = true;
  $("#printdlg").hidden = false;
  preview();
}
function closePrint() { $("#printdlg").hidden = true; $$(".page.skip").forEach(x => x.classList.remove("skip")); }
function selectedPages() {
  const v = $("#o-range").value;
  if (v === "cur") return [state.cur];
  if (v.startsWith("ch:")) { const c = state.book.chapters[+v.slice(3)]; return state.pages.map((p, k) => p.ch === c ? k : -1).filter(k => k >= 0); }
  if (v === "custom") { const a = +$("#o-from").value, b = +$("#o-to").value; return state.pages.map((p, k) => p.n >= a && p.n <= b ? k : -1).filter(k => k >= 0); }
  return state.pages.map((p, k) => k);
}
function preview() {
  const ks = selectedPages();
  const pv = $("#pv"), f = currentFormat();
  const doc = $("#doc");
  const wrap = document.createElement("div");
  wrap.className = doc.className + " pvz";
  for (const prop of ["--pw", "--ph", "--bl"]) { const v = doc.style.getPropertyValue(prop); if (v) wrap.style.setProperty(prop, v); }
  for (const k of ks.slice(0, 3)) wrap.append(state.pages[k].el.cloneNode(true));
  $$("mark.hit", wrap).forEach(m => m.replaceWith(m.textContent));
  pv.replaceChildren(wrap);
  const over = state.problems.filter(p => p.kind === "overflow").length;
  const fs = state.problems.find(p => p.kind === "font");
  $("#pvnote").innerHTML = T.pvNote(ks.length, esc(fmtName(f)), bleedOn())
    + (over ? `<br><span class="err-msg">${T.pvOver(over)}</span>` : "")
    + (fs ? `<br>${esc(problemText(fs))}` : "");
}
$("#fmtlist").addEventListener("change", async e => {
  if (e.target.name !== "fmt") return;
  $$(".fmt").forEach(l => l.classList.toggle("sel", l.contains(e.target)));
  savePref("format", e.target.value || null);
  savePref("formatFor", e.target.value ? state.book?.meta.format || "" : null);
  await render(); preview();
});
$("#o-bleed").onchange = async e => { savePref("bleed", e.target.checked ? 1 : ""); await render(); preview(); };
$("#o-theme").onchange = async e => { savePref("theme", e.target.value); await render(); preview(); };
$("#o-range").onchange = e => { $("#o-custom").hidden = e.target.value !== "custom"; preview(); };
$("#o-from").oninput = $("#o-to").oninput = preview;
$("#p-close").onclick = closePrint;
$("#printdlg").addEventListener("click", e => { if (e.target.id === "printdlg") closePrint(); });
$("#p-go").onclick = () => {
  const ks = new Set(selectedPages());
  state.pages.forEach((p, k) => p.el.classList.toggle("skip", !ks.has(k)));
  $("#printdlg").hidden = true;
  setTimeout(() => { window.print(); }, 50);
};
window.addEventListener("afterprint", () => $$(".page.skip").forEach(x => x.classList.remove("skip")));
$("#b-print").onclick = openPrint;

/* =====================================================================
   READING data.md AND layout.html — local mode
   Both are loaded as a <script>. That way the book opens with a double
   click on index.html, with no server and no browser permission.
   That's why they have 3 fixed lines at the start and 3 at the end
   (invisible to Markdown and HTML, read as code by the browser).
   Files with the old wrapper (livro(...)) still load.
   ===================================================================== */
const WRAP_TOP = "<!-- BOOK FILE: DO NOT DELETE THE FIRST 3 OR THE LAST 3 LINES\nbook(function(){/*\n-->\n";
const WRAP_END = "\n<!--\n*/});\n-->\n";
const unwrapBody = s => s.replace(/^[^\n]*\n?\s*-->[^\n]*\n/, "").replace(/\n?<!--\s*$/, "");
const isWrapped = t => /(?:^|\n)(?:book|livro)\(function\(\)\{\/\*/.test(t);
function wrapText(t) {
  t = t.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (isWrapped(t)) return t;
  return WRAP_TOP + "\n" + t.trim().replace(/\*\//g, "* /") + "\n" + WRAP_END;
}
const LAYOUT_TOP = "<!-- BOOK LAYOUT: DO NOT DELETE THE FIRST 3 OR THE LAST 3 LINES\nlayout(function(){/*\n-->\n";
const isLayoutWrapped = t => /(?:^|\n)layout\(function\(\)\{\/\*/.test(t);
/* plain HTML out of a layout.html that may or may not have the wrapper */
function unwrapLayout(t) {
  t = t.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!isLayoutWrapped(t)) return t;
  const a = t.indexOf("/*"), b = t.lastIndexOf("*/");
  return b > a ? unwrapBody(t.slice(a + 2, b)) : t;
}
/* plain Markdown out of a data.md that may or may not have the wrapper */
function unwrapText(t) {
  t = t.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!isWrapped(t)) return t;
  const a = t.indexOf("/*"), b = t.lastIndexOf("*/");
  return b > a ? unwrapBody(t.slice(a + 2, b)) : t;
}
window.addEventListener("error", e => { if (/(data\.md|layout\.html)/.test(e.filename || "")) e.preventDefault(); }, true);

/* resolves with the text, null (file does not exist) or undefined (fixed lines damaged) */
const readSeq = {};
function readScript(file = "data.md", names = ["book", "livro"]) {
  return new Promise(ok => {
    const id = readSeq[file] = (readSeq[file] || 0) + 1; let done = false;
    const s = document.createElement("script");
    const fin = v => { if (done) return; done = true; s.remove(); ok(v); };
    for (const nm of names) window[nm] = fn => {
      if (id !== readSeq[file]) return;
      const src = String(fn), a = src.indexOf("/*"), b = src.lastIndexOf("*/");
      fin(a >= 0 && b > a ? unwrapBody(src.slice(a + 2, b)) : undefined);
    };
    s.onload = () => setTimeout(() => fin(undefined), 0);   // loaded but the function was not called: fixed lines are damaged
    s.onerror = () => fin(null);                            // file does not exist
    s.src = file + "?v=" + Date.now();
    document.head.append(s);
  });
}
const readLayout = () => readScript("layout.html", ["layout"]);

async function load(text) {
  state.text = text;
  state.book = parseBook(text);
  $("#splash").hidden = true;
  await render(true);
}

/* =====================================================================
   BOOK STYLE
   style.css is the book's own stylesheet: any CSS, as long as it stays
   inside the book. In app mode it is rebuilt before use:
   - every selector must start at the book (.book or .theme-NAME, which are
     on the same element) and not jump out of it with "+" or "~";
   - no url(), image-set(), @import, expression() or other ways to load things
     or run code; @media, @supports, @container, @layer, @keyframes and
     @font-face are kept;
   - the one url() allowed is in @font-face src, naming a file of the book's
     fonts/ folder (fonts/name.woff2|woff|ttf|otf); it is rewritten to the
     address the viewer gives that file (a blob: URL after a byte check).
   What is dropped is listed in the Problems panel.
   ===================================================================== */
/* splits CSS into top-level items: {head, body} (body null for "@x ...;") */
function cssItems(src) {
  const out = [];
  let i = 0, start = 0;
  const n = src.length;
  const skipStr = j => { const q = src[j]; for (j++; j < n && src[j] !== q; j++) if (src[j] === "\\") j++; return j; };
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") { i = skipStr(i) + 1; continue; }
    if (c === ";") { out.push({head: src.slice(start, i), body: null}); start = ++i; continue; }
    if (c === "}") { start = ++i; continue; }               // stray closing brace
    if (c === "{") {
      let d = 1, j = i + 1;
      for (; j < n && d; j++) {
        const cj = src[j];
        if (cj === '"' || cj === "'") j = skipStr(j);
        else if (cj === "{") d++;
        else if (cj === "}") d--;
      }
      out.push({head: src.slice(start, i), body: src.slice(i + 1, j - 1)});
      start = i = j; continue;
    }
    i++;
  }
  if (src.slice(start).trim()) out.push({head: src.slice(start), body: null});
  return out;
}
/* splits on a separator that is not inside (), [] or a string */
function splitTop(s, sep) {
  const out = []; let d = 0, start = 0, q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === "(" || c === "[") d++;
    else if (c === ")" || c === "]") d--;
    else if (c === sep && !d) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}
function cssDecls(body, dropped) {
  const out = [];
  for (const d of splitTop(body, ";")) {
    if (!d.trim()) continue;
    const m = d.match(/^\s*(-{0,2}[a-z][a-z0-9-]*)\s*:([\s\S]*)$/i);
    if (!m || !m[2].trim() || badCss(m[2]) || /^(behavior|-moz-binding)$/i.test(m[1])) { dropped.push(d.trim().slice(0, 60)); continue; }
    out.push(`${m[1]}:${m[2].trim()}`);
  }
  return out.join(";");
}
/* the first compound must hold .book or .theme-NAME; the next combinator cannot be + or ~ */
function bookSelector(sel) {
  let d = 0, i = 0, top = "";
  for (; i < sel.length; i++) {
    const c = sel[i];
    if (c === "(" || c === "[") d++;
    else if (c === ")" || c === "]") d--;
    else if (!d && /[\s>+~]/.test(c)) break;
    if (!d && c !== ")" && c !== "]") top += c;
  }
  if (!/\.(book|theme-[a-z0-9_-]+)(?![\w-])/i.test(top)) return false;
  if (/^\s*[+~]/.test(sel.slice(i))) return false;
  return !badCss(sel);
}
/* @font-face: src keeps local() fonts and url()s of files in fonts/. fonts.url(path) gives the address to use,
   or null when the file is not in the book (listed in fonts.missing). */
function fontFace(body, dropped, fonts) {
  const rest = [], src = [];
  for (const d of splitTop(body, ";")) {
    const m = d.match(/^\s*src\s*:([\s\S]*)$/i);
    if (!m) { rest.push(d); continue; }
    for (const it of splitTop(m[1], ",")) {
      const x = it.trim(), u = x.match(FONT_SRC);
      if (!u || (u[2] && !FONT_PATH.test(u[2]))) { if (x) dropped.push(x.slice(0, 60)); continue; }
      if (!u[2]) { src.push(x); continue; }
      const url = fonts.url(u[2]);
      if (!url) { if (!fonts.missing.includes(u[2])) fonts.missing.push(u[2]); continue; }
      src.push(`url("${url}")` + (u[4] ? ` format("${u[4].toLowerCase()}")` : ""));
    }
  }
  const dd = cssDecls(rest.join(";"), dropped);
  return src.length ? (dd ? dd + ";" : "") + "src:" + src.join(",") : "";
}
function cssBlock(src, dropped, fonts) {
  const out = [];
  for (const it of cssItems(src)) {
    const head = it.head.trim();
    if (!head) continue;
    const short = head.replace(/\s+/g, " ").slice(0, 60);
    if (head[0] === "@") {
      const name = (head.match(/^@([\w-]+)/) || [])[1]?.toLowerCase() || "";
      if (it.body == null || badCss(head)) { dropped.push(short); continue; }
      if (["media", "supports", "container", "layer"].includes(name)) out.push(`${head}{${cssBlock(it.body, dropped, fonts)}}`);
      else if (/^(-webkit-)?keyframes$/.test(name)) {
        const frames = cssItems(it.body).filter(f => f.body != null && /^[\s\d.%,a-z]*$/i.test(f.head)).map(f => `${f.head.trim()}{${cssDecls(f.body, dropped)}}`);
        out.push(`${head}{${frames.join("")}}`);
      }
      else if (name === "font-face") { const dd = fontFace(it.body, dropped, fonts); if (dd) out.push(`@font-face{${dd}}`); }
      else dropped.push(short);
      continue;
    }
    if (it.body == null || /[{}]/.test(it.body.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, ""))) { dropped.push(short); continue; }   // stray text, or nested CSS
    const sels = splitTop(head, ",").map(x => x.trim()).filter(Boolean);
    const good = sels.filter(bookSelector);
    for (const x of sels) if (!good.includes(x)) dropped.push(x.slice(0, 60));
    const dd = good.length ? cssDecls(it.body, dropped) : "";
    if (dd) out.push(`${good.join(",")}{${dd}}`);
  }
  return out.join("\n");
}
/* fontUrl(path): the address of a font file; by default the path itself (for writing style.css back) */
function cleanCss(text, fontUrl = p => p) {
  const dropped = [], fonts = {url: fontUrl, missing: []};
  const css = cssBlock(String(text || "").replace(/\/\*[\s\S]*?\*\//g, ""), dropped, fonts);
  return {css, dropped, missingFonts: fonts.missing};
}
function applyStyleText(text, fontUrl) {
  let el = $("#book-style-inline");
  if (!el) { el = document.createElement("style"); el.id = "book-style-inline"; document.head.append(el); }
  const r = cleanCss(text, fontUrl);
  el.textContent = r.css;
  state.styleDropped = r.dropped;
  state.fontMissing = r.missingFonts;
}

/* local mode: the book's style.css is a <link> (its text cannot be read over file://).
   On focus it is reloaded; the book is laid out again if the computed style changed. */
const SIG_PROPS = ["display", "position", "width", "height", "margin", "padding", "font-family", "font-weight", "font-style", "letter-spacing",
  "line-height", "color", "background-color", "border-top", "grid-template-columns", "grid-template-areas", "grid-column", "grid-row", "flex-direction",
  "gap", "text-transform", "order", "inset"];
function styleSig() {
  const out = [document.styleSheets.length];
  const doc = $("#doc"), dc = getComputedStyle(doc);
  for (const v of ["--color-primary", "--color-accent", "--font-body", "--font-heading"]) out.push(dc.getPropertyValue(v));
  const seen = new Set();
  for (const p of state.pages) {
    const key = p.el.dataset.layout;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const e of [p.el, ...p.el.querySelectorAll("*")].slice(0, 300)) {
      const c = getComputedStyle(e);
      out.push(SIG_PROPS.map(x => c.getPropertyValue(x)).join(","));
    }
  }
  return out.join("|");
}
function reloadStyle() {
  return new Promise(ok => {
    const old = $("#book-style"); if (!old) return ok(false);
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.id = "book-style"; l.href = "style.css?v=" + Date.now();
    l.onload = () => { old.remove(); ok(true); };
    l.onerror = () => { l.remove(); ok(false); };
    old.after(l);
  });
}
async function refreshStyle() {
  const before = styleSig();
  await reloadStyle();
  if (styleSig() !== before && state.book) { await render(true); return true; }
  return false;
}

/* =====================================================================
   OPENING A BOOK — app mode
   Sources: a published sample (fetch), files or a zip (read once), or a
   folder (read again when its files change, so a local agent's edits show
   up by themselves). Images and fonts become blob: URLs after a byte check.
   ===================================================================== */
const SAMPLES = {en: "../samples/the-art-of-lorem-ipsum-en/"};
const BOOK_FILE = /\.(md|css|html|png|jpe?g|webp|woff2?|ttf|otf)$/i;
/* Size limits. Files opened from disk stay on disk (File objects are only references),
   so there is no limit on the whole book; only single files are capped:
   - an image (or any entry) above MAX_FILE is refused;
   - text files (data.md, style.css, layout.html) above MAX_TEXT are refused, since they are parsed in memory;
   - a zip entry that inflates far more than its declared size, or than MAX_RATIO × its packed size
     for big entries, is treated as a zip bomb. */
const MAX_FILE = 150e6, MAX_TEXT = 20e6, MAX_RATIO = 200;
const isText = name => /\.(md|css|html)$/i.test(name);
const tooBig = (name, size) => size > (isText(name) ? MAX_TEXT : MAX_FILE);
const MIME = {png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", css: "text/css", md: "text/markdown", html: "text/plain",
  woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf"};
const mimeOf = name => MIME[name.split(".").pop().toLowerCase()] || "application/octet-stream";

/* Minimal zip reader (stored or deflated entries). It reads the zip in slices and
   inflates one entry at a time with the browser's DecompressionStream, so even a
   zip of several GB never has to fit in memory at once. */
async function unzip(file) {
  const bytesAt = async (start, len) => new Uint8Array(await file.slice(start, start + len).arrayBuffer());
  const tailLen = Math.min(file.size, 65557);
  const tail = await bytesAt(file.size - tailLen, tailLen), tv = new DataView(tail.buffer);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip");
  const count = tv.getUint16(eocd + 10, true), cdSize = tv.getUint32(eocd + 12, true), cdStart = tv.getUint32(eocd + 16, true);
  if (cdStart + cdSize > file.size) throw new Error("zip");
  const cd = await bytesAt(cdStart, cdSize), dv = new DataView(cd.buffer);
  const out = new Map();
  let p = 0;
  for (let k = 0; k < count && k < 5000; k++) {
    if (p + 46 > cd.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error("zip");
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(cd.subarray(p + 46, p + 46 + nl)).replace(/\\/g, "/");
    p += 46 + nl + xl + cl;
    if (name.endsWith("/") || !BOOK_FILE.test(name) || name.split("/").includes("..") || name.startsWith("__MACOSX")) continue;
    if (tooBig(name, usize) || (usize > 10e6 && usize > csize * MAX_RATIO)) throw new Error("big");
    const lh = new DataView((await bytesAt(lho, 30)).buffer);
    if (lh.getUint32(0, true) !== 0x04034b50) throw new Error("zip");
    const start = lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const packed = file.slice(start, start + csize);
    let blob;
    if (method === 0) blob = packed;
    else if (method === 8) {
      let seen = 0;
      const guard = new TransformStream({transform(chunk, ctl) {
        seen += chunk.length;
        if (seen > usize + 16) ctl.error(new Error("big")); else ctl.enqueue(chunk);
      }});
      blob = await new Response(packed.stream().pipeThrough(new DecompressionStream("deflate-raw")).pipeThrough(guard)).blob();
    } else continue;
    out.set(name, new File([blob], name.split("/").pop(), {type: mimeOf(name)}));
  }
  return out;
}

/* Files from a dropped/picked folder handle (a few levels deep, book files only) */
async function readDirHandle(dir, prefix = "", out = new Map(), depth = 0) {
  if (depth > 3 || out.size > 2000) return out;
  for await (const [name, h] of dir.entries()) {
    if (name.startsWith(".") || name === "versions" || name === "node_modules") continue;
    if (h.kind === "file") { if (BOOK_FILE.test(name)) out.set(prefix + name, await h.getFile()); }
    else await readDirHandle(h, prefix + name + "/", out, depth + 1);
  }
  return out;
}
/* Files from <input webkitdirectory> or a plain multi-file pick; zips are expanded */
async function filesToMap(list) {
  const out = new Map();
  for (const f of list) {
    const rel = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
    if (/\.zip$/i.test(f.name)) { for (const [k, v] of await unzip(f)) out.set(k, v); continue; }
    if (BOOK_FILE.test(f.name)) out.set(rel, f);
  }
  return out;
}

/* Finds the book inside a set of files: the folder holding data.md becomes the root */
function pickBook(all) {
  const mds = [...all.keys()].filter(k => /(^|\/)data\.md$/i.test(k)).sort((a, b) => a.split("/").length - b.split("/").length);
  let mdKey = mds[0];
  if (!mdKey) { const any = [...all.keys()].filter(k => /\.md$/i.test(k)); if (any.length === 1) mdKey = any[0]; }
  if (!mdKey) return null;
  const root = mdKey.includes("/") ? mdKey.slice(0, mdKey.lastIndexOf("/") + 1) : "";
  const files = new Map();
  for (const [k, v] of all) {
    if (root && !k.startsWith(root)) continue;
    if (tooBig(k, v.size)) throw new Error("big");
    files.set(k.slice(root.length), v);
  }
  return {files, mdKey: mdKey.slice(root.length)};
}

function resetBlobs() {
  for (const u of [...state.blobs.values(), ...state.fontBlobs.values()]) URL.revokeObjectURL(u);
  state.blobs = new Map(); state.fontBlobs = new Map();
}
/* Only real font files are accepted (checked by content: WOFF2, WOFF, OpenType/CFF, TrueType) */
async function isFont(file) {
  const tag = String.fromCharCode(...new Uint8Array(await file.slice(0, 4).arrayBuffer()));
  return ["wOF2", "wOFF", "OTTO", "true", "\x00\x01\x00\x00"].includes(tag);
}

async function openFiles(all, label, dir = null) {
  const found = pickBook(all);
  if (!found) { status(`<span class="err-msg">${T.noMd}</span>`, 6000); return false; }
  resetBlobs();
  for (const [k, f] of found.files) {
    if (!/\.(png|jpe?g|webp)$/i.test(k) || !(await isRaster(f))) continue;
    const u = URL.createObjectURL(f);
    state.blobs.set(k, u);
    if (!state.blobs.has(k.split("/").pop())) state.blobs.set(k.split("/").pop(), u);
  }
  for (const [k, f] of found.files) {   // loose files (no folder) count as fonts/<name>, like images
    const key = k.includes("/") ? k : "fonts/" + k;
    if (FONT_PATH.test(key) && !state.fontBlobs.has(key) && await isFont(f)) state.fontBlobs.set(key, URL.createObjectURL(f));
  }
  const css = found.files.get("style.css");
  applyStyleText(css ? await css.text() : "", p => state.fontBlobs.get(p) || null);
  const lay = found.files.get("layout.html");
  setLayout(lay ? unwrapLayout(await lay.text()) : null);
  const md = found.files.get(found.mdKey);
  state.src = {kind: "files", dir, stamp: stampOf(found.files), label};
  await load(unwrapText(await md.text()));
  status(T.opened(esc(label)));
  return true;
}
const stampOf = files => [...files.entries()].map(([k, f]) => `${k}:${f.size}:${f.lastModified}`).join("|");

async function openDirHandle(dir) {
  try { return await openFiles(await readDirHandle(dir), dir.name, dir); }
  catch (e) { status(`<span class="err-msg">${e.message === "big" ? T.tooBig : T.zipError}</span>`, 6000); return false; }
}
async function openFileList(list) {
  try {
    const files = [...list];
    const label = files.length === 1 ? files[0].name : (files[0]?.webkitRelativePath || "").split("/")[0] || `${files.length} files`;
    return await openFiles(await filesToMap(files), label);
  } catch (e) { status(`<span class="err-msg">${e.message === "big" ? T.tooBig : T.zipError}</span>`, 6000); return false; }
}
async function openSample(lang) {
  const base = SAMPLES[lang]; if (!base) return false;
  try {
    const get = (f, none) => fetch(base + f).then(r => r.ok ? r.text() : none);
    const [md, css, lay] = await Promise.all([get("data.md", null), get("style.css", ""), get("layout.html", null)]);
    if (md == null) throw new Error("missing");
    resetBlobs();
    applyStyleText(css, p => base + p);
    setLayout(lay == null ? null : unwrapLayout(lay));
    state.src = {kind: "fetch", base, lang};
    await load(unwrapText(md));
    return true;
  } catch { appSplash(); return false; }
}

/* A folder opened in app mode is read again when any of its files changes */
async function pollDir() {
  const src = state.src;
  if (!src?.dir || state.rendering || !$("#printdlg").hidden) return;
  try {
    const all = await readDirHandle(src.dir);
    const found = pickBook(all);
    if (found && stampOf(found.files) !== src.stamp) { await openFiles(all, src.label, src.dir); status(T.updated); }
  } catch {}
}

function appSplash() {
  const body = $("#sp-body");
  $("#splash").hidden = false;
  $("#sp-title").textContent = T.appTitle;
  body.innerHTML = `<p>${T.appIntro}</p>
    <div class="drop" id="sp-drop">
      <button class="btn primary big" id="sp-files">${T.chooseFiles}</button>
      <button class="btn big" id="sp-dir">${T.chooseFolder}</button>
      <p class="muted">${T.folderLive}</p>
    </div>
    <p class="muted">${T.orSample} <a href="?sample=en">${T.sampleEn}</a></p>`;
  $("#sp-files").onclick = pickFiles;
  $("#sp-dir").onclick = pickDir;
}
function pickFiles() { $("#f-open").value = ""; $("#f-open").click(); }
async function pickDir() {
  if ("showDirectoryPicker" in window) {
    let h; try { h = await window.showDirectoryPicker({id: "book", mode: "read"}); } catch { return; }
    await openDirHandle(h);
  } else { $("#f-dir").value = ""; $("#f-dir").click(); }
}

/* =====================================================================
   WRITING INTO THE BOOK FOLDER — local mode, hidden while EDITING is off
   ===================================================================== */
async function ensureDir(reason) {
  if (state.dir) return state.dir;
  if (!("showDirectoryPicker" in window)) { status(T.needChrome, 8000); return null; }
  let h = null;
  try { h = await idbGet(location.pathname); } catch {}
  if (h) { try { if ((await h.requestPermission({mode: "readwrite"})) === "granted") return state.dir = h; } catch {} }
  if (!confirm(T.pickFolder(reason))) return null;
  try { h = await window.showDirectoryPicker({id: "book", mode: "readwrite"}); } catch { return null; }
  try { await h.getFileHandle("data.md"); }
  catch { alert(T.noDataInFolder(h.name)); return null; }
  state.dir = h;
  try { await idbSet(location.pathname, h); } catch {}
  return h;
}

async function importCss(text) {
  const dir = await ensureDir(T.whyCss);
  if (!dir) return;
  try {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    try { const f = await (await dir.getFileHandle("style.css")).getFile(); await writeAt(`versions/style-${stamp}.css`, f); } catch {}
    await writeAt("style.css", new Blob([cleanCss(text).css], {type: "text/css"}));
    await refreshStyle();
    status(T.cssReplaced(stamp), 6000);
  } catch (e) { status(`<span class="err-msg">${T.saveFail(esc(e.message))}</span>`, 6000); }
}

async function importText(text, name) {
  if (/\.css$/i.test(name)) return importCss(text);
  text = wrapText(text);
  const inner = unwrapText(text);
  const test = parseBook(inner);
  if (!test.chapters.length && !confirm(T.notABook(name))) return;
  const dir = await ensureDir(T.whyData);
  if (dir) {
    try {
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      if (state.text != null) await writeAt(`versions/data-${stamp}.md`, new Blob([wrapText(state.text)], {type: "text/markdown"}));
      await writeAt("data.md", new Blob([text], {type: "text/markdown"}));
      await load(inner);
      status(T.dataReplaced(stamp), 6000);
    } catch (e) { status(`<span class="err-msg">${T.saveFail(esc(e.message))}</span>`, 6000); }
    return;
  }
  await load(inner);
  status(T.showingOnly(esc(name)), 9000);
}
if (EDITING) {
  $("#b-import").onclick = () => { $("#f-import").value = ""; $("#f-import").click(); };
}
/* the splash "repair" button is the only way in when the wrapper is damaged */
$("#f-import").addEventListener("change", async e => { const f = e.target.files[0]; if (f) await importText(await f.text(), f.name); });

/* =====================================================================
   SPLASH (local mode)
   ===================================================================== */
function splash(kind) {
  const body = $("#sp-body");
  $("#splash").hidden = false;
  if (kind === "noData") {
    $("#sp-title").textContent = T.noDataTitle;
    body.innerHTML = `${T.noDataBody}<button class="btn primary big" id="sp-retry">${T.retry}</button>`;
  } else {
    $("#sp-title").textContent = T.brokenTitle;
    body.innerHTML = `${T.brokenBody(esc(WRAP_TOP.trim()), esc(WRAP_END.trim()))}
      <button class="btn primary big" id="sp-fix">${T.fixBtn}</button>
      <button class="btn big" id="sp-retry">${T.retry}</button>`;
  }
  $("#sp-retry")?.addEventListener("click", reload);
  $("#sp-fix")?.addEventListener("click", () => { $("#f-import").value = ""; $("#f-import").click(); });
}

/* =====================================================================
   TOOLBAR ACTIONS, LIVE UPDATES, START
   ===================================================================== */
async function reload() {
  if (APP) {
    const src = state.src;
    if (src?.kind === "fetch") await openSample(src.lang);
    else if (src?.dir) await openDirHandle(src.dir);
    else if (state.book) await render(true);
    status(T.reloaded);
    return;
  }
  await reloadStyle();
  const t = await readScript();
  if (t === null) return splash("noData");
  if (t === undefined) return splash("broken");
  setLayout(await readLayout());
  await load(t);
  status(T.reloaded);
}
$("#b-reload").onclick = reload;
/* settings popover under the gear: language chips */
const setPop = (open) => { $("#setpop").hidden = !open; $("#b-set").setAttribute("aria-expanded", open); };
$("#b-set").onclick = e => { e.stopPropagation(); setPop($("#setpop").hidden); };
$("#setpop").addEventListener("click", e => {
  e.stopPropagation();
  const c = e.target.closest(".chip[data-lang]"); if (!c) return;
  if (c.dataset.lang === UI_LANG) return setPop(false);
  try { localStorage.setItem(LANG_KEY, c.dataset.lang); } catch {}
  location.reload();
});
document.addEventListener("click", () => setPop(false));
document.addEventListener("keydown", e => { if (e.key === "Escape") setPop(false); });

if (APP) {
  $("#f-open").addEventListener("change", e => { if (e.target.files.length) openFileList(e.target.files); });
  $("#f-dir").addEventListener("change", e => { if (e.target.files.length) openFileList(e.target.files); });
  $("#splash").addEventListener("click", e => { if (e.target.id === "splash" && state.book) $("#splash").hidden = true; });
  document.addEventListener("dragover", e => { e.preventDefault(); document.body.classList.add("dropping"); });
  document.addEventListener("dragleave", e => { if (!e.relatedTarget) document.body.classList.remove("dropping"); });
  document.addEventListener("drop", async e => {
    e.preventDefault();
    document.body.classList.remove("dropping");
    const items = [...(e.dataTransfer.items || [])];
    if (items.length === 1 && items[0].getAsFileSystemHandle) {
      const h = await items[0].getAsFileSystemHandle();
      if (h?.kind === "directory") return openDirHandle(h);
    }
    if (e.dataTransfer.files.length) openFileList(e.dataTransfer.files);
  });
}

/* local mode: notices by itself when data.md is saved again */
async function poll() {
  if (APP) return pollDir();
  if (!state.book || state.rendering || !$("#printdlg").hidden) return;
  const t = await readScript();
  const lay = await readLayout();
  const layChanged = lay !== state.layout.text;
  if (layChanged) setLayout(lay);
  if (typeof t === "string" && t !== state.text) { await load(t); status(T.updated); }
  else if (layChanged) { await render(true); status(T.layoutUpdated); }
}
window.addEventListener("focus", async () => {
  if (!state.book || state.rendering) return;
  if (APP) return pollDir();
  if (state.missing.size) { state.imgBust = Date.now(); await Promise.all([...state.missing.values()].map(m => hydrateOne(m.el))); updateProblems(); }
  await refreshStyle();
  poll();
});

async function boot() {
  if (prefs().toc) document.body.classList.add("toc-open");
  if (APP) {
    const sample = new URLSearchParams(location.search).get("sample");
    if (!(sample && await openSample(sample))) appSplash();
  } else {
    const t = await readScript();
    if (t === null) splash("noData");
    else if (t === undefined) splash("broken");
    else { setLayout(await readLayout()); await load(t); }
  }
  if (EXPORT) return exportReport();
  setInterval(poll, 2500);
}

/* =====================================================================
   EXPORT REPORT — read by book_tools.py from the page's DOM
   Problems (in English), the size in use and the table of contents; for
   EPUB also every page as XHTML, images pointing at their book paths.
   ===================================================================== */
function exportReport() {
  const f = currentFormat(), doc = $("#doc"), meta = state.book?.meta || {};
  const rep = {engine: VIEWER_VERSION, ready: !!state.book, title: meta.title || "", author: meta.author || "",
    language: meta.language || "en", cls: doc.className, format: {id: f.id, w: f.w, h: f.h, name: fmtNameEn(f)},
    bleed: bleedMm(f), pages: state.pages.length, cover: state.cover >= 0 ? state.cover : null, toc: [], problems: [], xhtml: []};
  for (const p of state.problems) {
    const args = p.code === "font" ? {...p.args, fmt: p.args.fmtEn} : p.args;
    rep.problems.push({level: p.level, kind: kindText(p.kind, "en"), text: PROBLEMS.en[p.code](args)});
  }
  for (const im of state.missing.values()) rep.problems.push({level: "warn", kind: "MISSING IMAGE", text: im.path});
  for (const ch of state.book?.chapters || []) {
    if (ch.front) continue;
    const k = state.pages.findIndex(p => p.ch === ch);
    if (k >= 0) rep.toc.push({title: [ch.num, ch.title].filter(Boolean).join(". ") || BL().chapter, page: k});
  }
  /* pages per chapter number, for part=chapter:N */
  rep.chapters = {};
  for (const p of state.pages) if (p.ch && !p.ch.front && p.ch.num) rep.chapters[p.ch.num] = (rep.chapters[p.ch.num] || 0) + 1;
  /* part=cover prints only the cover page, part=interior every page but the cover, part=chapter:N only chapter N */
  const part = EXPORT.get("part") || "";
  if (part === "cover" || part === "interior") state.pages.forEach((p, k) => p.el.classList.toggle("skip", (k === state.cover) !== (part === "cover")));
  if (part.startsWith("chapter:")) state.pages.forEach(p => p.el.classList.toggle("skip", !p.ch || p.ch.front || p.ch.num !== part.slice(8)));
  if (EXPORT.get("export") === "epub") {
    const xs = new XMLSerializer();
    for (const p of state.pages) {
      const c = p.el.cloneNode(true);
      c.classList.remove("overflow");
      $$("mark.hit", c).forEach(m => m.replaceWith(m.textContent));
      for (const im of $$("img", c)) { const fr = im.closest(".img"); im.setAttribute("src", fr?.dataset.path ? encodeURI(fr.dataset.path) : ""); }
      rep.xhtml.push(xs.serializeToString(c));
    }
  }
  const s = document.createElement("script");
  s.type = "application/json"; s.id = "book-export";
  s.textContent = JSON.stringify(rep).replace(/</g, "\\u003c");
  document.body.append(s);
}
boot();
