import numpy as np
import pandas as pd
from scipy import stats
import matplotlib.pyplot as plt

print("="*60)
print("פתרון עבודת בית - רגרסיה לינארית")
print("="*60)

# ============ תרגיל 1 ============
print("\n\n### תרגיל 1 ###\n")

# נתונים מתרגיל 1
x1 = np.array([4, 2, 2, 1, 4, 6, 3])
y1 = np.array([585, 412, 397, 303, 596, 814, 511])

print("נתונים:")
print(f"X: {x1}")
print(f"Y: {y1}")

# א. המשמעות הפיסיקלית
print("\nא. משמעות פיסיקלית:")
print("   β0 (חותך) - משקל הכלי עצמו (הטארה)")
print("   β1 (שיפוע) - משקל ממוצע של קובייה אחת")

# ב. חישוב OLS
n1 = len(x1)
x_mean1 = np.mean(x1)
y_mean1 = np.mean(y1)

numerator = np.sum((x1 - x_mean1) * (y1 - y_mean1))
denominator = np.sum((x1 - x_mean1) ** 2)

beta1_1 = numerator / denominator
beta0_1 = y_mean1 - beta1_1 * x_mean1

print(f"\nב. חישוב אומדי OLS:")
print(f"   β̂1 = {beta1_1:.4f}")
print(f"   β̂0 = {beta0_1:.4f}")

# ג. אמידה של שונות השגיאה
y_pred1 = beta0_1 + beta1_1 * x1
residuals1 = y1 - y_pred1
SSE1 = np.sum(residuals1 ** 2)
sigma_sq1 = SSE1 / (n1 - 2)  # n-2 לרגרסיה עם חותך

print(f"\nג. אמידת שונות השגיאה:")
print(f"   SSE = {SSE1:.2f}")
print(f"   σ̂² = {sigma_sq1:.2f}")
print(f"   σ̂ = {np.sqrt(sigma_sq1):.2f}")

# ד. בדיקת השערה: H0: β1=0
print(f"\nד. בדיקת השערה H0: β1=0 (ברמת מובהקות 5%):")

# חישוב SE של β1
Sxx1 = np.sum((x1 - x_mean1) ** 2)
SE_beta1_1 = np.sqrt(sigma_sq1 / Sxx1)
t_stat1 = beta1_1 / SE_beta1_1
p_value1 = 2 * (1 - stats.t.cdf(abs(t_stat1), n1 - 2))

print(f"   t-statistic = {t_stat1:.4f}")
print(f"   p-value = {p_value1:.6f}")
print(f"   דרגות חופש = {n1 - 2}")

t_critical = stats.t.ppf(0.975, n1 - 2)
print(f"   t_critical (α=0.05) = ±{t_critical:.4f}")

if abs(t_stat1) > t_critical:
    print(f"   ✓ דחייה של H0: קיים קשר בין X ו-Y")
else:
    print(f"   ✗ לא דחייה של H0")

# ============ תרגיל 2 ============
print("\n\n### תרגיל 2 ###\n")

x2 = np.array([0, 2, 4, 6, 1, 3, 5, 8, 4, 2])
y2 = np.array([110, 210, 409, 262, 162, 57, 310, 210, 106, 9])

# נתונים שניתנו
sum_x2 = 175  # לפי הנתון (למעשה זה סכום x²)
sum_y2 = 475260  # לפי הנתון (למעשה זה סכום y²)
sum_xy2 = 9117
x_mean2 = 3.5
y_mean2 = 185

n2 = len(x2)
Sxx2 = sum_x2 - n2 * x_mean2**2  # ∑(x_i - x̄)²
Syy2 = sum_y2 - n2 * y_mean2**2  # ∑(y_i - ȳ)²
Sxy2 = sum_xy2 - n2 * x_mean2 * y_mean2  # ∑(x_i - x̄)(y_i - ȳ)

print(f"נתונים שניתנו:")
print(f"n = {n2}, x̄ = {x_mean2}, ȳ = {y_mean2}")
print(f"∑x²_i = {sum_x2}, ∑y²_i = {sum_y2}, ∑x_i*y_i = {sum_xy2}")

# א. בדיקת השערה: H0: β1=0
print(f"\nא. בדיקת השערה H0: β1=0 (ברמת מובהקות 5%):")

beta1_2 = Sxy2 / Sxx2
beta0_2 = y_mean2 - beta1_2 * x_mean2

y_pred2 = beta0_2 + beta1_2 * x2
residuals2 = y2 - y_pred2
SSE2 = np.sum(residuals2 ** 2)
sigma_sq2 = SSE2 / (n2 - 2)

SE_beta1_2 = np.sqrt(sigma_sq2 / Sxx2)
t_stat2 = beta1_2 / SE_beta1_2
p_value2 = 2 * (1 - stats.t.cdf(abs(t_stat2), n2 - 2))

print(f"   β̂1 = {beta1_2:.4f}")
print(f"   σ̂² = {sigma_sq2:.2f}, SE(β̂1) = {SE_beta1_2:.4f}")
print(f"   t-statistic = {t_stat2:.4f}")
print(f"   p-value = {p_value2:.6f}")
t_critical2 = stats.t.ppf(0.975, n2 - 2)
if abs(t_stat2) > t_critical2:
    print(f"   ✓ דחייה של H0: קיים קשר מובהק בין מס' כוסות לזמן תגובה")
else:
    print(f"   ✗ לא דחייה של H0")

# ב. בדיקת השערה: H0: β0=0 (הישר עובר דרך ראשית הצירים)
print(f"\nב. בדיקת השערה H0: β0=0 (ברמת מובהקות 5%):")

SE_beta0_2 = np.sqrt(sigma_sq2 * (1/n2 + x_mean2**2 / Sxx2))
t_stat_intercept = beta0_2 / SE_beta0_2
p_value_intercept = 2 * (1 - stats.t.cdf(abs(t_stat_intercept), n2 - 2))

print(f"   β̂0 = {beta0_2:.4f}")
print(f"   SE(β̂0) = {SE_beta0_2:.4f}")
print(f"   t-statistic = {t_stat_intercept:.4f}")
print(f"   p-value = {p_value_intercept:.6f}")

if abs(t_stat_intercept) > t_critical2:
    print(f"   ✗ דחייה של H0: הישר לא עובר דרך ראשית הצירים")
    print(f"   משמעות: יש משקל בסיסי (טארה) שונה מ-0")
else:
    print(f"   ✓ לא דחייה של H0: ייתכן שהישר עובר דרך הראשית")

print(f"\n   הערה: בהקשר למחקר - אם הישר עובר דרך הראשית זה אומר")
print(f"   שכאשר מספר הכוסות = 0, הפער בזמן התגובה = 0")
print(f"   זה לא הגיוני - אנחנו מצפים לפער חיובי כבר בלי אלכוהול.")

