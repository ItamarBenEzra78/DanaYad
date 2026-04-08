# תרגיל 6 - ניתוח ב-R

# טעינת הנתונים
data <- read.csv("Exc1.csv")

print(paste(rep("=", 60), collapse=""))
print("תרגיל 6 - ניתוח ב-R")
print(paste(rep("=", 60), collapse=""))

# הצגת הנתונים
print("\nראשונות שורות הנתונים:")
print(head(data))

print("\nסטטיסטיקה תיאורית:")
print(summary(data))

# 1. חציון של X2
print("\n1. חציון של עמודה X2:")
median_x2 <- median(data\)
print(paste("חציון X2 =", median_x2))

# 2. קורלציה בין X3 ו-Y
print("\n2. מקדם המתאם (קורלציה) בין X3 ו-Y:")
correlation_x3_y <- cor(data\, data\)
print(paste("cor(X3, Y) =", round(correlation_x3_y, 4)))

# 3. הוספת עמודה X5 = X1 + X3
print("\n3. הוספת עמודה X5 = X1 + X3:")
data\ <- data\ + data\
print(paste("X5 נוסף (ראשונות 5 ערכים):", paste(data\[1:5], collapse=", ")))

# 4. BoxPlot של X5
print("\n4. BoxPlot של X5:")
pdf("boxplot_x5.pdf")
boxplot(data\, main="BoxPlot של X5", ylab="ערך")
dev.off()
print("BoxPlot נשמר ב: boxplot_x5.pdf")

# 5. עקומת צפיפות של X4
print("\n5. עקומת צפיפות של X4:")
pdf("density_x4.pdf")
plot(density(data\), main="עקומת צפיפות של X4", xlab="X4", ylab="צפיפות")
dev.off()
print("עקומת צפיפות נשמרה ב: density_x4.pdf")

# 6. מודל רגרסיה פשוטה: Y ~ X1
print("\n6. מודל רגרסיה פשוטה: Y ~ X1")
model <- lm(Y ~ X1, data=data)
print("\nתוצאות הרגרסיה:")
print(summary(model))

print("\n   משוואת הרגרסיה:")
print(paste("Ŷ =", round(coef(model)[1], 4), "+", round(coef(model)[2], 4), "* X1"))

# 7. עלילה של קו הרגרסיה
print("\n7. עלילה של קו הרגרסיה:")
pdf("regression_plot.pdf")
plot(data\, data\, main="רגרסיה: Y ~ X1", xlab="X1", ylab="Y")
abline(model, col="red", lwd=2)
legend("topleft", legend="קו הרגרסיה", col="red", lwd=2)
dev.off()
print("עלילה נשמרה ב: regression_plot.pdf")

# סיכום המקדמים וסטטיסטיקה
print("\nסיכום המקדמים:")
coeffs <- coef(model)
print(paste("β̂0 (intercept) =", round(coeffs[1], 4)))
print(paste("β̂1 (X1) =", round(coeffs[2], 4)))

# סטטיסטיקה t
model_summary <- summary(model)
print("\nסטטיסטיקה t:")
print(paste("t-value עבור β0 =", round(model_summary\[1, 3], 4)))
print(paste("t-value עבור β1 =", round(model_summary\[2, 3], 4)))

print("\np-values:")
print(paste("p-value עבור β0 =", format(model_summary\[1, 4], scientific=TRUE)))
print(paste("p-value עבור β1 =", format(model_summary\[2, 4], scientific=TRUE)))

# R² ו-adjusted R²
print("\nמדדי טיב הסגר:")
print(paste("R²=", round(model_summary\.squared, 4)))
print(paste("Adjusted R²=", round(model_summary\.r.squared, 4)))

print(paste(rep("=", 60), collapse=""))
print("סיום ניתוח - כל הקבצים נשמרו")
print(paste(rep("=", 60), collapse=""))
