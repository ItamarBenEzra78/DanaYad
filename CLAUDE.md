# DanaYad: אפליקציית ווב שהופכת טקסט מוקלד לכתב יד ריאליסטי

## מה זה
אפליקציית ווב בעברית שהופכת טקסט מוקלד לכתב יד ריאליסטי, עם ייצוא ל-PDF בפורמט A4.
פיצ'רים: אפקטי כתב יד, Scramble ו-Line Drift, מערכת פונטים, רקעים, נוסחאות LaTeX (MathJax) ואימות משתמשים (Supabase).
טכנולוגיות: HTML/CSS/JavaScript בלי פריימוורק, html2canvas + jsPDF, MathJax, Supabase, אירוח ב-Netlify, ו-backend ב-FastAPI.

## תלויות
אין

## איפה הדברים
| נתיב | מה זה |
|---|---|
| `README.md` | תיאור הפרויקט, פיצ'רים וטכנולוגיות |
| `index.html` | האפליקציה הראשית: עורך כתב היד |
| `landing.html` | דף נחיתה שיווקי |
| `css/` | קובצי עיצוב לפי תחום (variables, layout, sidebar, toolbar, editor, drawing, modals, print, responsive, handwriting) |
| `js/app.js` | נקודת הכניסה של ה-JavaScript |
| `js/config.js` | הגדרות: Supabase, Stripe, גובה עמוד, רשימת הפונטים |
| `js/<תחום>/` | מודולים: auth, controls, drawing, editor, export, font, handwriting, pagination, utils |
| `fonts/` | פונטים מקומיים (גברת לווין, Playpen Sans Hebrew) |
| `backend/server.py` | שרת FastAPI: רינדור SVG עם שונות לכל תו, PDF דרך Playwright, והגשת ה-frontend |
| `backend/glyph_engine.py` | מנוע הגליפים של כתב היד |
| `backend/requirements.txt` | תלויות Python של ה-backend |
| `backend/*.ttf`, `backend/rubik.zip` | פונטים של ה-backend |
| `supabase-setup.sql` | סכמת מסד הנתונים (מריצים ב-SQL Editor של Supabase) |
| `_redirects` | ניתוב SPA ב-Netlify |
| `.netlify/` | הגדרות Netlify (`netlify.toml`, `state.json` עם מזהה האתר) |
| `sitemap.xml` | מפת אתר |
| `google9e6320d7159a86c6.html` | אימות Google |
| `test-filter.html`, `test_output.svg`, `backend/test_output.svg` | קבצי בדיקה |
| `generated-pdfs/` | קובצי PDF שנוצרו (כ-985MB), לא נכנסים ל-git |
| `stock-research/` | תיקייה ריקה עם `.git` פנימי, לא חלק מהאפליקציה |
| `HOMEWORK_SOLUTIONS*.html`, `homework-*.html`, `homework_svg_test.svg`, `scheduling-course.html`, `solution*.py`, `solution_part6*.R`, `Exc*.csv`, `*.pdf` בשורש, `COMPLETE_SOLUTIONS.md`, `SOLUTIONS_SUMMARY.txt`, `handwriting_content.txt` | קבצי שיעורי בית ותרגולים בשורש (לא חלק מהאפליקציה) |
| `STATUS.md` | המצב עכשיו והצעד הבא |

## תחילת סשן
1. לקרוא את `STATUS.md`.
2. כשהעבודה נוגעת במבנה האפליקציה או בפיצ'רים: לקרוא גם את `README.md`.

## סוף סשן
1. לעדכן את `STATUS.md`.
2. commit ו-push.

## כללים של הפרויקט
אין כללים מיוחדים מעבר לבסיס.
