# DanaYad — עורך כתב יד חכם

אפליקציית ווב בעברית שהופכת טקסט מוקלד לכתב יד ריאליסטי, עם ייצוא ל-PDF.

## מבנה הפרויקט

```
├── index.html              # האפליקציה הראשית — עורך כתב היד (CSS + JS מוטמעים)
├── landing.html            # דף נחיתה שיווקי
├── supabase-setup.sql      # סכמת מסד נתונים (Supabase)
├── _redirects              # ניתוב SPA ב-Netlify
├── sitemap.xml             # מפת אתר
└── google9e6320d7159a86c6.html  # אימות Google
```

## פיצ'רים

- **אפקטי כתב יד** — סיבוב מילים, שונות בגודל, הסטת baseline, רעד דיו, שונות באטימות
- **Scramble** — ג'יטר ברמת תו בודד לדמיית כתיבה אנושית
- **Line Drift** — הטיית שורות לדמיית כתיבה לא ישרה
- **מערכת פונטים** — סינון לפי קטגוריות (עברית, כתב יד, תצוגה)
- **רקעים** — דף חלק, משורטט, מנוקד, טקסטורת נייר
- **ייצוא PDF** — פורמט A4, חלוקה לעמודים
- **תמיכה במתמטיקה** — MathJax לנוסחאות LaTeX
- **אימות משתמשים** — Supabase OAuth

## טכנולוגיות

- HTML / CSS / JavaScript (ללא פריימוורק)
- [html2canvas](https://html2canvas.hertzen.com/) + [jsPDF](https://github.com/parallax/jsPDF) — ייצוא PDF
- [MathJax](https://www.mathjax.org/) — רינדור נוסחאות
- [Supabase](https://supabase.com/) — אימות משתמשים ומסד נתונים
- [Netlify](https://www.netlify.com/) — אירוח
