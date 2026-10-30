# DanaYad — עורך כתב יד

**TL;DR (English).** DanaYad is a Hebrew, RTL web app that turns typed text into realistic handwriting and exports it as an A4 PDF, entirely in the browser.
Live: **https://danayad.netlify.app** · Stack: vanilla HTML/CSS/JS (ES modules, no framework, no build step) · optional FastAPI + Playwright backend · Netlify.

Technical highlights:
1. **SVG displacement-filter handwriting** — three stacked `feTurbulence` + `feDisplacementMap` layers (baseline wobble, per-character jitter, ink micro-tremor) driven live by sliders, so the effect costs no DOM manipulation.
2. **Heading-aware A4 pagination engine** — measures real line boxes with `Range.getClientRects()`, budgets 983 px of text per page, and pulls headings/separators to the next page instead of orphaning them.
3. **Client-side PDF export that keeps the handwriting** — html2canvas captures the sheet, a canvas port of the SVG filter (spec-exact `feTurbulence` noise + `feDisplacementMap`) re-applies the ink effect, and each page is cut along a seam found by dynamic programming, so no letter is split between pages. The optional backend uses the same pagination and composer on a real Chrome render.

Solo project · 70+ commits · started April 2026 · MIT.

---

## מה האפליקציה עושה

- המרת טקסט מוקלד לכתב יד: 25 גופנים (2 מצורפים, השאר נטענים מ-Google Fonts לפי דרישה), סינון לפי קטגוריה.
- שליטה בגודל גופן, גובה שורה, ריווח אותיות והטיית שורות (מתאפסת בכל עמוד, כמו דף חדש).
- שלושה מחוונים לאפקט כתב היד (גל בסיס, רעד אותיות, רעד דיו) + "ערבוב" אקראי ברמת התו, ששומר על סדר קריאה של מספרים ואנגלית, על הניקוד, על המבנה (רשימות, טבלאות, הדגשות) ועל מילים שלמות, ומוסיף צורות חלופיות של ל, נ, ף, ץ ו-₪ מתוך הגופן.
- ארבעה רקעי דף: נייר, משורטט, מנוקד, חלק.
- עיצוב: מודגש / נטוי / קו תחתון, יישור, רשימות, טבלאות, לוח סמלים (מתמטיקה, חצים, יוונית, שונות).
- ציור חופשי על הדף: צבעים, מחק, סרגל לקווים ישרים (Shift מצמיד ל-45°), ביטול.
- מחיקת טקסט לפי מילים, מחוון "עמוד X מתוך Y" וסימוני מעבר עמוד על המסך.
- ייצוא PDF בפורמט A4 בדפדפן, כולל שכבת הציור.

## ארכיטקטורה

| מודול | תפקיד |
|---|---|
| `js/app.js` | נקודת כניסה: חיבור המודולים ל-`window` עבור ה-handlers ב-HTML ואתחול |
| `js/config.js` | קבועי גאומטריית עמוד (A4 ב-96dpi), `API_URL`, קטלוג הגופנים |
| `js/controls/StyleControls.js` | גודל גופן, גובה שורה, ריווח אותיות, רקע |
| `js/editor/FormattingToolbar.js` | עיצוב טקסט דרך `execCommand` וסנכרון מצב הכפתורים |
| `js/editor/TextEraser.js` | מצב מחיקה לפי מילה עם Backspace/Delete |
| `js/editor/TableManager.js` | הוספת טבלה במיקום הסמן |
| `js/editor/PasteHandler.js` | הדבקת טקסט: כל שורה הופכת לפסקה (`<div>`) |
| `js/editor/SymbolInserter.js` | לוח הסמלים |
| `js/font/FontManager.js` | רשת הגופנים, טעינה עצלה מ-Google Fonts, בדיקת הגופנים המצורפים |
| `js/handwriting/HandwritingEngine.js` | מחוונים → פרמטרי `scale` של פילטר ה-SVG |
| `js/handwriting/LineDrift.js` | הטיית שורות פר-עמוד |
| `js/handwriting/ScrambleEngine.js` | ג'יטר לכל גרפים (אות + ניקוד) במקום, בלי לשבור מבנה; רצפי LTR מבודדים; צורות חלופיות; זרע קבוע לשחזור |
| `js/handwriting/InkDisplacement.js` | הפילטר `#ink-tremor` על קנבס, לייצוא בדפדפן |
| `js/pagination/PaginationEngine.js` | מעברי עמוד לפי כל שורות התצוגה (גם בתוך פסקה), מודעי-כותרות; שורת טבלה לא נחצית |
| `js/drawing/DrawingCanvas.js` · `DrawingTools.js` · `RulerTool.js` | קנבס ציור, צבעים/מחק/היסטוריה, סרגל |
| `js/export/PdfExporter.js` | ייצוא PDF: הכנת הגיליון, חיתוך בתפר, הרכבת עמודים (משותף לדפדפן ולשרת); השרת מזוהה לפי `Server-Timing` בלי בקשה נוספת |
| `js/utils/dom.js` | גישה לאלמנטי העורך |
| `css/` | קובץ לכל תחום: משתנים, פריסה, סרגל צד, סרגל כלים, עורך, ציור, אפקטים, חלונות, רספונסיבי |
| `backend/` | FastAPI אופציונלי: צילום הדף ב-Chromium (Playwright) עם הפילטר האמיתי — ראו `backend/README.md` |
| `fonts/GveretLevin-Alt*.ttf`, `tools/make_alt_fonts.py` | תת-גופנים עם הצורות החלופיות (ss01/ss02) של גברת לווין, ממופות לתווים רגילים |
| `tests/e2e/` | בדיקות קצה-לקצה (pytest + Playwright) לשני מסלולי הייצוא |

## הרצה מקומית

```bash
# Frontend — כל שרת סטטי מספיק
python3 -m http.server 8080      # ואז http://localhost:8080

# Backend (אופציונלי, PDF באיכות מלאה)
cd backend && pip install -r requirements.txt && playwright install chromium
uvicorn server:app --port 8000   # מגיש גם את ה-frontend
```

## בדיקות

```bash
pip install -r tests/requirements.txt -r backend/requirements.txt && playwright install chromium
python3 -m pytest tests/e2e      # מרים שרת סטטי ו-backend בעצמו; הראיות נשמרות ב-test-output/after
```

## פריסה

Netlify, ישירות מהריפו: `netlify.toml` מגדיר `publish = "."`, fallback ל-`index.html` וכותרות אבטחה בסיסיות. אין שלב build.

## מגבלות ידועות ומפת דרכים

- ייצוא בדפדפן: html2canvas מצייר את הטקסט כ-1–2 פיקסלים נמוך יותר וקצת עבה יותר מהמסך, וגבולות טבלה כפולים בעובי. ה-backend תואם למסך כמעט פיקסל לפיקסל.
- ה-PDF הוא רסטר (JPEG לכל עמוד, 192 DPI), לא טקסט וקטורי. נבדק עד 30 עמודים בייצוא בדפדפן.
- הטיית שורות (Line Drift) מסובבת את כל המסמך כיחידה אחת, כך שבמסמך ארוך ההיסט מצטבר.
- ה-backend לא כולל את שכבת הציור.
- היוריסטיקת הכותרות בחלוקה לעמודים מכוונת לעברית ("תרגיל", "א.", נקודתיים בסוף שורה).
- במסכים צרים מ-768px סרגל הצד מוסתר ואין כפתור לפתיחתו.
- אין שמירת מסמכים; רענון הדף מאפס את התוכן.

מפת דרכים: כפתור סרגל צד במובייל, שמירה מקומית של המסמך, PDF עם טקסט וקטורי וגופן משובץ.

## רישיון וקרדיטים

הקוד ברישיון MIT (ראו `LICENSE`). הגופנים המצורפים ב-`fonts/` ברישיון SIL Open Font License 1.1:
**Gveret Levin** (AlefAlefAlef) ו-**Playpen Sans Hebrew** (TypeTogether). שאר הגופנים נטענים מ-Google Fonts.
