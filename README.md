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
- שלושה מחוונים לאפקט כתב היד (גל בסיס, רעד אותיות, רעד דיו) + "ערבוב" ברמת האות: כל מופע של אות מקבל צורה אחרת (12 גרסאות של גברת לווין עם קווי מתאר מעוותים, `fonts/GveretLevin-Var*.ttf`), הטיה, גודל ומיקום משלו; מרווחים בין מילים והזחות לא אחידים; קו הבסיס נודד לאט. הערבוב שומר על סדר הקריאה של מספרים ואנגלית, על הניקוד, על המבנה (רשימות, טבלאות, הדגשות) ועל מילים שלמות.
- שכבת דיו בייצוא (`js/handwriting/InkLayer.js`): עובי קו שמשתנה לאורך הכתיבה כמו לחץ עט, גוון לא אחיד בתוך האות, והכהיה בצמתים. קצוות הקו נשארים חדים (עט, לא עיפרון).
- ארכיטקטורת כתיבה בערבוב (`js/handwriting/WritingLayout.js`): שורות "תווית: מספרים" הופכות לטבלה משורטטת (מטריצות), רצף משוואות מתפצל לשורה למשוואה, "שאלה N" ו"סעיף N" מקבלות קו מתחת, ⊗ לפני "הוכחה"/"בדיקה", חץ מצויר לפני שורת תוצאה ("לכן", "→"), מרווח אנכי לא אחיד, ושורה נגמרת אחרי פסיק או נקודה כשהגיעה ל-55–85% מהרוחב במקום בשוליים. הכול הפיך ב-↺.
- נוסחאות בכתב יד (`js/handwriting/Formulas.js`): `x_j`, `x^2`, `sum_{i=0}^{n}`, `frac{a}{b}`, `sqrt{x}`. שורה בלי עברית שנראית כמו נוסחה נכתבת משמאל לימין; בתוך משפט עברי כל משתנה (`D_t`, `P^2`) הוא יחידה נפרדת, כך שהאינדקס תמיד בצד הנכון. ≤ ≥ ≠ מגיעים מגופן שנבנה מהקווים של גברת לווין (`tools/make_math_font.py`).
- טבלאות תכנון: שורות `תווית: ערך, ערך, ...` הופכות לטבלה משורטטת; `-` הוא תא ריק, התווית יכולה להיות נוסחה (`V_t = Q_t`), וטבלה לא נחצית בין עמודים.
- קצות משיכה: בשכבת הדיו הקו מתדקק ומבהיר במקום שבו העט נוחת או מתרומם (נמדד לפי הסטת מרכז הכובד של הדיו בסביבת הפיקסל).
- ארבעה רקעי דף: נייר, משורטט, מנוקד, חלק.
- עיצוב: מודגש / נטוי / קו תחתון, יישור, רשימות, טבלאות, לוח סמלים (מתמטיקה, חצים, יוונית, שונות).
- חמישה צבעי עט (חום, כחול-שחור, כחול, אדום, ירוק) ומרקר צהוב, כמו בעבודה כתובה ביד: כותרת בכחול, סימון באדום, תוצאה סופית במרקר. קווי הטבלאות בצבע העט.
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
| `js/handwriting/InkLayer.js` | שכבת הדיו על שכבת הטקסט (שני מסלולי הייצוא) |
| `js/handwriting/WritingLayout.js` | ארכיטקטורת כתיבה: טבלאות למטריצות, משוואה לשורה, כותרות, שבירת שורות לפי מחשבה |
| `js/pagination/PaginationEngine.js` | מעברי עמוד לפי כל שורות התצוגה (גם בתוך פסקה), מודעי-כותרות; שורת טבלה לא נחצית |
| `js/drawing/DrawingCanvas.js` · `DrawingTools.js` · `RulerTool.js` | קנבס ציור, צבעים/מחק/היסטוריה, סרגל |
| `js/export/PdfExporter.js` | ייצוא PDF: הכנת הגיליון, חיתוך בתפר, הרכבת עמודים (משותף לדפדפן ולשרת); השרת מזוהה לפי `Server-Timing` בלי בקשה נוספת |
| `js/utils/dom.js` | גישה לאלמנטי העורך |
| `css/` | קובץ לכל תחום: משתנים, פריסה, סרגל צד, סרגל כלים, עורך, ציור, אפקטים, חלונות, רספונסיבי |
| `backend/` | FastAPI אופציונלי: צילום הדף ב-Chromium (Playwright) עם הפילטר האמיתי — ראו `backend/README.md` |
| `fonts/GveretLevin-Alt*.ttf`, `tools/make_alt_fonts.py` | תת-גופנים עם הצורות החלופיות (ss01/ss02) של גברת לווין, ממופות לתווים רגילים |
| `js/handwriting/Formulas.js` | נוסחאות: אינדקסים, חזקות, Σ, שברים, שורשים; כיוון שורות נוסחה |
| `fonts/GveretLevin-Math.ttf`, `tools/make_math_font.py` | ≤ ≥ ≠ שהורכבו מהקווים של גברת לווין |
| `tools/render_text.py` | קובץ טקסט → PDF בכתב יד דרך האפליקציה (שרת מקומי + Chromium), לבדיקות ולדוגמאות |
| `fonts/GveretLevin-Var1..12.ttf`, `tools/make_variant_fonts.py` | 12 גרסאות של גברת לווין עם קווי מתאר מעוותים (שדה עיוות חלק, הטיה ומתיחה), לשוני בין מופעים של אותה אות |
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

## איך הכתב נבנה

1. **צורה:** בערבוב (🎲) כל אות מקבלת אחד מ-12 גופני הגרסאות (`tools/make_variant_fonts.py` מעוות את קווי המתאר של גברת לווין בשדה חלק, בלי לקמט קווים), או צורה חלופית לפי הקשר (`ss01`/`ss02` של הגופן). בנוסף הטיה, גודל ומיקום אנכי אקראיים לכל אות.
2. **פריסה:** מרווח אקראי לפני כל מילה, הזחה אקראית בתחילת פסקה, וקו בסיס שנודד בצעדים קטנים ממילה למילה.
3. **פילטר SVG** (`#ink-tremor`, על הטקסט בלבד, לא על הנייר): גל בסיס איטי לשורה, ורעד עדין. ברירות המחדל נמוכות; ערכים גבוהים משייפים את הקצוות.
4. **שכבת דיו** (ייצוא בלבד): שכבת הטקסט נלכדת לבד על רקע שקוף; סף הכיסוי זז לפי שדה רעש איטי (עובי משתנה), הגוון משתנה בתוך האות, וצמתים מתכהים. הקצוות נשארים חדים.
5. **חיתוך לעמודים** בתפר שמתחמק מהדיו, ואז הרכבה מעל הנייר הישר.

## פריסה

Netlify, ישירות מהריפו: `netlify.toml` מגדיר `publish = "."`, fallback ל-`index.html` וכותרות אבטחה בסיסיות. אין שלב build.

## מגבלות ידועות ומפת דרכים

- ייצוא בדפדפן: html2canvas מצייר את הטקסט כ-1–2 פיקסלים נמוך יותר וקצת עבה יותר מהמסך, וגבולות טבלה כפולים בעובי. ה-backend תואם למסך כמעט פיקסל לפיקסל.
- שכבת הדיו קיימת רק בייצוא; התצוגה במסך מראה את הפילטר בלבד, ולכן הקו ב-PDF מעט שונה ממה שרואים.
- אין חיבור בין אותיות סמוכות ואין סגנון של אדם מסוים: הכתב נראה טבעי אבל כללי. לזה צריך סריקה של כתב יד אמיתי.
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
