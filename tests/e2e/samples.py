"""Sample documents used by the end-to-end tests."""

HEBREW = (
    "אתמול בערב, אחרי יום ארוך בעבודה, ישבתי ליד החלון וכתבתי מכתב לסבתא שלי. "
    "סיפרתי לה על הטיול לגליל: הנחלים, הפריחה והשקט (שכבר כמעט שכחתי). "
    "היא תמיד שואלת: \"מתי תבוא לבקר?\" – ואני עונה \"בקרוב!\"; אבל השנה זה באמת יקרה. "
    "בַּבֹּקֶר הַשֶּׁמֶשׁ זָרְחָה, והצה\"ל פרסם הודעה על תרגיל בצפון־הארץ... "
    "מה עוד אפשר לבקש? אולי רק עוד קצת זמן, עוד כוס קפה, ועוד שיחה ארוכה אחת."
)

MIXED = (
    "בשבוע 3 צריך 120 יחידות של A, ובשבוע 4 כבר 250 יחידות (עלייה של 108%). "
    "המחיר הוא 12.50 ₪ ליחידה לפי דוח Q3-2025 של Acme Ltd. "
    "תאריך היעד: 15/03/2025, טלפון 054-1234567. "
    "the deadline is Friday בשעה 17:30, ואז נשלח את הקובץ report_v2.pdf למנהל. "
    "קישור: https://example.com/projects/danayad/handwriting-output-check?id=123456789&lang=he"
)

# One line each; plain and scrambled rendering must read in the same visual order.
BIDI_LINES = [
    "(עלייה של 108%).",
    "המחיר הוא 12.50 ₪ ליחידה",
    "דוח Q3-2025 של Acme Ltd. תאריך",
    "טלפון 054-1234567, שעה 17:30",
    "the deadline is Friday בשעה",
    "₪12.5 ו-120 יחידות",
    "(Acme Ltd) הודיעה",
    "בַּבֹּקֶר צה\"ל: \"מתי?\"",
    "50% הנחה, 3 x 4 = 12",
]

RICH_HTML = (
    "<div><b>כותרת מודגשת</b> ו<i>טקסט נטוי</i> עם <a href=\"https://example.com\">קישור</a>.</div>"
    "<ol><li>לקנות חלב ולחם</li>"
    "<li>להתקשר לרופא בשעה 10:00, ולשאול על התוצאות של בדיקת הדם שעשיתי בשבוע שעבר "
    "ועל הצורך בבדיקה נוספת לפני הניתוח</li>"
    "<li>משימות משנה:<ul><li>לשלוח את דוח Q4</li><li>לסיים תרגיל 3</li></ul></li>"
    "<li>לנוח</li></ol>"
    "<table dir=\"rtl\"><tr><td>שבוע</td><td>יחידות</td><td>מחיר</td></tr>"
    "<tr><td>1</td><td>120</td><td>₪12.5</td></tr>"
    "<tr><td>2</td><td>250</td><td>₪11</td></tr></table><br>"
)

PASTED_LIST = "לקנות חלב\r\nלהתקשר לרופא\nלשלוח דוח\n\nאחרי שורה ריקה"


def long_document(paragraphs=28):
    """Long wrapping paragraphs, so page breaks must fall inside paragraphs."""
    body = [" ".join([HEBREW, MIXED.split("קישור:")[0]]) for _ in range(paragraphs)]
    return "\n\n".join(body)
