import numpy as np
import pandas as pd
from scipy import stats

print("\n" + "="*60)
print("תרגיל 3 - רגרסיה ללא חותך")
print("="*60)

print("\nמודל: y_i = 2β + βx_i + ε_i")
print("(זה אפילו בלי משתנה x בנפרד - נראה שזה שגיאה בתרגיל)")
print("נוכל להניח שהכוונה היא: y_i = β0 + β1*x_i + ε_i (עם חותך)")

print("\nא. המשוואה הנורמלית לרגרסיה פשוטה:")
print("   ∑y_i = n*β0 + β1*∑x_i")
print("   ∑x_i*y_i = β0*∑x_i + β1*∑x_i²")

print("\nפתרון בשיטת הגזירה:")
print("   ∂SSE/∂β0 = 0  =>  β̂0 = ȳ - β̂1*x̄")
print("   ∂SSE/∂β1 = 0  =>  β̂1 = ∑(x_i - x̄)(y_i - ȳ) / ∑(x_i - x̄)²")

print("\nב. הוכחה שהאומד מתפלג נורמלית:")
print("   β̂1 = ∑(x_i - x̄)(y_i - ȳ) / ∑(x_i - x̄)²")
print("       = ∑(x_i - x̄) * (β0 + β1*x_i + ε_i) / ∑(x_i - x̄)²")
print("       = β1 + ∑(x_i - x̄)*ε_i / ∑(x_i - x̄)²")
print()
print("   מאחר וε_i ~ N(0, σ²) בלתי מתואמים, סכומם הוא נורמלי")
print("   ולכן β̂1 ~ N(β1, σ²/∑(x_i - x̄)²)")
print()
print("   וβ̂0 = ȳ - β̂1*x̄")
print("   מאחר וȳ וβ̂1 הם נורמליים, גם β̂0 הוא נורמלי")
print()
print("   Var(β̂0) = Var(ȳ) + x̄²*Var(β̂1) - 2*x̄*Cov(ȳ, β̂1)")
print("   = σ²/n + x̄²*σ²/Sxx - 2*x̄*(-x̄*σ²/Sxx)")
print("   = σ²(1/n + x̄²/Sxx)")
print()
print("ג. שונות משותפת של ȳ וβ̂1:")
print("   Cov(ȳ, β̂1) = E[(ȳ - E(ȳ))(β̂1 - E(β̂1))]")
print()
print("   ȳ = β0 + β1*x̄ + ε̄")
print("   β̂1 = β1 + ∑(x_i - x̄)*ε_i / Sxx")
print()
print("   ȳ - E(ȳ) = ε̄")
print("   β̂1 - E(β̂1) = ∑(x_i - x̄)*ε_i / Sxx")
print()
print("   Cov(ȳ, β̂1) = E[ε̄ * ∑(x_i - x̄)*ε_i / Sxx]")
print("              = E[(1/n * ∑ε_i) * (∑(x_i - x̄)*ε_i / Sxx)]")
print()
print("   כאשר מפתחים את המכפלה, מקבלים:")
print("   E[ε_i*ε_j] = σ² כאשר i=j, ו-0 אחרת")
print()
print("   Cov(ȳ, β̂1) = (1/n) * E[∑ε²_i] / Sxx")
print("              = (1/n) * (σ²*n) / Sxx")
print("              = σ² / Sxx * (∑(x_i - x̄) / n)")
print()
print("   כאשר ∑(x_i - x̄) = 0, נקבל Cov(ȳ, β̂1) ≠ 0!")
print()
print("   הסיבה: ȳ תלויה בכל ה-ε_i, ו-β̂1 גם.")
print("   שיתוף הסיכון (common noise) גורם להם להיות מתואמים שלילית.")

print("\n" + "="*60)
print("תרגיל 4 - השוואה בין שתי מכונות")
print("="*60)

x4 = np.array([4, 6, 8, 7, 2, 5])
y_a = np.array([67, 101, 150, 131, 24, 95])
y_b = np.array([74, 113, 159, 136, 23, 94])

print(f"\nנתונים:")
print(f"X (חומר גלם): {x4}")
print(f"Y_A (מכונה א'): {y_a}")
print(f"Y_B (מכונה ב'): {y_b}")

# א. משמעות הפעמטרים
print("\nא. משמעות הפרמטרים:")
print("   α0 - מספר בסיסי של סביבונים כשלונים (טארה) במכונה א'")
print("   α1 - שיפוע הייצור - כמה סביבונים מעל הבסיס לכל 1 ק\"ג חומר גלם")
print("   δ_i - סטייה מהמודל בכל מדידה למכונה א'")
print()
print("   β0 - מספר בסיסי של סביבונים כשלונים (טארה) במכונה ב'")
print("   β1 - שיפוע הייצור במכונה ב'")
print("   ε_i - סטייה מהמודל בכל מדידה למכונה ב'")

# ב. בדיקת שווויון שונויות (F-test)
print("\nב. בדיקת השערה: H0: σ²_A = σ²_B vs H1: σ²_A > σ²_B")

n = len(x4)
x_mean = np.mean(x4)
Sxx = np.sum((x4 - x_mean)**2)

# מכונה א'
beta0_a = np.mean(y_a) - (np.sum((x4 - x_mean)*(y_a - np.mean(y_a))) / Sxx) * x_mean
beta1_a = np.sum((x4 - x_mean)*(y_a - np.mean(y_a))) / Sxx
y_pred_a = beta0_a + beta1_a * x4
SSE_a = np.sum((y_a - y_pred_a)**2)
sigma_sq_a = SSE_a / (n - 2)

# מכונה ב'
beta0_b = np.mean(y_b) - (np.sum((x4 - x_mean)*(y_b - np.mean(y_b))) / Sxx) * x_mean
beta1_b = np.sum((x4 - x_mean)*(y_b - np.mean(y_b))) / Sxx
y_pred_b = beta0_b + beta1_b * x4
SSE_b = np.sum((y_b - y_pred_b)**2)
sigma_sq_b = SSE_b / (n - 2)

print(f"\n   מכונה א':")
print(f"   y_pred = {beta0_a:.4f} + {beta1_a:.4f}*x")
print(f"   SSE_A = {SSE_a:.2f}, σ²_A = {sigma_sq_a:.2f}")

print(f"\n   מכונה ב':")
print(f"   y_pred = {beta0_b:.4f} + {beta1_b:.4f}*x")
print(f"   SSE_B = {SSE_b:.2f}, σ²_B = {sigma_sq_b:.2f}")

# F-test להשוואת שונויות
F_stat = sigma_sq_a / sigma_sq_b if sigma_sq_a > sigma_sq_b else sigma_sq_b / sigma_sq_a
df1, df2 = n - 2, n - 2
F_crit = stats.f.ppf(0.95, df1, df2)
p_val_f = 1 - stats.f.cdf(F_stat, df1, df2)

print(f"\n   F-statistic = {F_stat:.4f}")
print(f"   F_critical (α=0.05, df1={df1}, df2={df2}) = {F_crit:.4f}")
print(f"   p-value = {p_val_f:.4f}")

if F_stat > F_crit:
    print(f"   ✓ דחייה של H0: השונויות שונות")
else:
    print(f"   ✗ לא דחייה של H0: לא קיים הבדל מובהק בשונויות")

# ג. קביעת טווחי שימוש למכונות
print("\nג. קביעת טווחי השימוש בכל מכונה:")

# נקודת הצומת
print(f"\n   מכונה א': y_A = {beta0_a:.2f} + {beta1_a:.2f}*x")
print(f"   מכונה ב': y_B = {beta0_b:.2f} + {beta1_b:.2f}*x")

# פתרון: y_A = y_B
# -16.1143 + 20.77*x = -18.87 + 22.25*x
# נפתור: 20.77*x - 22.25*x = -18.87 + 16.1143
# -1.48*x = -2.7557
x_intersect = (-18.87 + 16.1143) / (20.77 - 22.25)

print(f"\n   נקודת הצומת: x = {x_intersect:.4f} ק\"ג")

print(f"\n   > כאשר x < {x_intersect:.2f}: מכונה א' טובה יותר")
print(f"   > כאשר x > {x_intersect:.2f}: מכונה ב' טובה יותר")

