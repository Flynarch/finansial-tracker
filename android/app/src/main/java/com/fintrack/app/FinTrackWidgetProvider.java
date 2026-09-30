package com.fintrack.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Locale;

public class FinTrackWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_WIDGET = "com.fintrack.app.ACTION_UPDATE_WIDGET";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
        updateAppWidget(context, appWidgetManager, appWidgetId);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE_WIDGET.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, FinTrackWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            if (appWidgetIds != null && appWidgetIds.length > 0) {
                onUpdate(context, appWidgetManager, appWidgetIds);
            }
        }
    }

    private static String getSafeString(SharedPreferences prefs, String key, String defaultVal) {
        try {
            if (!prefs.contains(key)) return defaultVal;
            Object val = prefs.getAll().get(key);
            if (val == null) return defaultVal;
            if (val instanceof Number) {
                long lVal = ((Number) val).longValue();
                return String.format(Locale.getDefault(), "Rp %,d", lVal).replace(',', '.');
            }
            return String.valueOf(val);
        } catch (Exception e) {
            return defaultVal;
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

        String balance = getSafeString(prefs, "fintrack_widget_balance", null);
        if (balance == null || balance.trim().isEmpty() || "Rp 0".equals(balance)) {
            String fallback = getSafeString(prefs, "total_net_worth", null);
            if (fallback == null || fallback.trim().isEmpty()) {
                fallback = getSafeString(prefs, "wallet_balance", "Rp 0");
            }
            if (fallback != null && !fallback.trim().isEmpty()) {
                balance = fallback;
            }
        }
        if (balance == null || balance.trim().isEmpty()) {
            balance = "Rp 0";
        }

        String income = getSafeString(prefs, "fintrack_widget_income", null);
        if (income == null || income.trim().isEmpty() || "Masuk: Rp 0".equals(income)) {
            String fallback = getSafeString(prefs, "month_income", null);
            if (fallback == null || fallback.trim().isEmpty()) {
                fallback = getSafeString(prefs, "income", "Masuk: Rp 0");
            }
            if (fallback != null && !fallback.trim().isEmpty()) {
                income = fallback;
            }
        }
        if (income == null || income.trim().isEmpty()) {
            income = "Masuk: Rp 0";
        }

        String expense = getSafeString(prefs, "fintrack_widget_expense", null);
        if (expense == null || expense.trim().isEmpty() || "Keluar: Rp 0".equals(expense)) {
            String fallback = getSafeString(prefs, "month_expense", null);
            if (fallback == null || fallback.trim().isEmpty()) {
                fallback = getSafeString(prefs, "expense", "Keluar: Rp 0");
            }
            if (fallback != null && !fallback.trim().isEmpty()) {
                expense = fallback;
            }
        }
        if (expense == null || expense.trim().isEmpty()) {
            expense = "Keluar: Rp 0";
        }

        String period = getSafeString(prefs, "fintrack_widget_period", null);
        if (period == null || period.trim().isEmpty()) {
            period = getSafeString(prefs, "period", "(Bulan Ini)");
        }

        String sparklineJson = getSafeString(prefs, "fintrack_widget_sparkline", null);
        if (sparklineJson == null || sparklineJson.trim().isEmpty() || "[]".equals(sparklineJson)) {
            sparklineJson = getSafeString(prefs, "sparklineData", "[]");
        }

        String sparklineIncomeJson = getSafeString(prefs, "fintrack_widget_sparkline_income", "[]");
        String sparklineExpenseJson = getSafeString(prefs, "fintrack_widget_sparkline_expense", "[]");
        String topCategoriesJson = getSafeString(prefs, "fintrack_widget_top_categories", "[]");

        String btnText = getSafeString(prefs, "fintrack_widget_btn_text", "Catat Baru");
        String balanceLabel = getSafeString(prefs, "fintrack_widget_balance_label", "Kekayaan Bersih");
        String dateText = getSafeString(prefs, "fintrack_widget_date", null);
        if (dateText == null || dateText.trim().isEmpty()) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("EEEE, d MMM", new Locale("id", "ID"));
            dateText = sdf.format(new java.util.Date());
        }

        String sparklineDatesJson = getSafeString(prefs, "fintrack_widget_sparkline_dates", null);
        String todayNet = getSafeString(prefs, "fintrack_widget_today_net", null);
        float todayNetVal = prefs.getFloat("fintrack_widget_today_net_val", 0f);

        updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineJson,
                sparklineDatesJson, todayNet, todayNetVal, btnText, balanceLabel, dateText,
                sparklineIncomeJson, sparklineExpenseJson, topCategoriesJson);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                      String balance, String income, String expense, String period, String sparklineJson) {
        updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineJson, "Catat Baru", "Kekayaan Bersih");
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                      String balance, String income, String expense, String period, String sparklineJson,
                                      String btnText, String balanceLabel) {
        String dateText = getSafeString(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE), "fintrack_widget_date", null);
        if (dateText == null || dateText.trim().isEmpty()) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("EEEE, d MMM", new Locale("id", "ID"));
            dateText = sdf.format(new java.util.Date());
        }
        updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineJson, btnText, balanceLabel, dateText);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                      String balance, String income, String expense, String period, String sparklineJson,
                                      String btnText, String balanceLabel, String dateText) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String sparklineDatesJson = getSafeString(prefs, "fintrack_widget_sparkline_dates", null);
        String todayNet = getSafeString(prefs, "fintrack_widget_today_net", null);
        float todayNetVal = prefs.getFloat("fintrack_widget_today_net_val", 0f);
        String sparklineIncomeJson = getSafeString(prefs, "fintrack_widget_sparkline_income", "[]");
        String sparklineExpenseJson = getSafeString(prefs, "fintrack_widget_sparkline_expense", "[]");
        String topCategoriesJson = getSafeString(prefs, "fintrack_widget_top_categories", "[]");

        updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineJson,
                sparklineDatesJson, todayNet, todayNetVal, btnText, balanceLabel, dateText,
                sparklineIncomeJson, sparklineExpenseJson, topCategoriesJson);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                      String balance, String income, String expense, String period, String sparklineJson,
                                      String sparklineDatesJson, String todayNet, float todayNetVal,
                                      String btnText, String balanceLabel, String dateText) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String sparklineIncomeJson = getSafeString(prefs, "fintrack_widget_sparkline_income", "[]");
        String sparklineExpenseJson = getSafeString(prefs, "fintrack_widget_sparkline_expense", "[]");
        String topCategoriesJson = getSafeString(prefs, "fintrack_widget_top_categories", "[]");

        updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineJson,
                sparklineDatesJson, todayNet, todayNetVal, btnText, balanceLabel, dateText,
                sparklineIncomeJson, sparklineExpenseJson, topCategoriesJson);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                      String balance, String income, String expense, String period, String sparklineJson,
                                      String sparklineDatesJson, String todayNet, float todayNetVal,
                                      String btnText, String balanceLabel, String dateText,
                                      String sparklineIncomeJson, String sparklineExpenseJson, String topCategoriesJson) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_fintrack_balance);

        // 1. Hero Balance & Label
        views.setTextViewText(R.id.widget_total_balance, balance != null ? balance : "Rp 0");
        views.setTextViewText(R.id.widget_balance_label, balanceLabel != null ? balanceLabel : "Kekayaan Bersih");

        // 2. Inline Today Net Delta Pill
        if (todayNet != null && !todayNet.trim().isEmpty() && !"Rp 0".equals(todayNet.trim()) && !"+Rp 0".equals(todayNet.trim())) {
            String pillText = todayNet.trim();
            if (!pillText.startsWith("↑") && !pillText.startsWith("↓") && !pillText.startsWith("±")) {
                if (todayNetVal > 0 || pillText.startsWith("+")) {
                    pillText = "↑ " + pillText;
                } else if (todayNetVal < 0 || pillText.startsWith("-")) {
                    pillText = "↓ " + pillText;
                }
            }
            views.setTextViewText(R.id.widget_today_net, pillText);
            if (todayNetVal > 0 || pillText.contains("+")) {
                views.setTextColor(R.id.widget_today_net, Color.parseColor("#86EFAC")); // Soft emerald
                views.setInt(R.id.widget_today_net, "setBackgroundResource", R.drawable.widget_delta_pill_bg);
            } else if (todayNetVal < 0 || pillText.contains("-")) {
                views.setTextColor(R.id.widget_today_net, Color.parseColor("#FDA4AF")); // Soft rose
                views.setInt(R.id.widget_today_net, "setBackgroundResource", R.drawable.widget_delta_pill_negative_bg);
            } else {
                views.setTextColor(R.id.widget_today_net, Color.parseColor("#94A3B8"));
                views.setInt(R.id.widget_today_net, "setBackgroundResource", R.drawable.widget_delta_pill_bg);
            }
            views.setViewVisibility(R.id.widget_today_net, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_today_net, View.GONE);
        }

        // 3. Multi-Wave Sparkline Trend Chart
        Bitmap sparklineBitmap = createMultiWaveSparklineBitmap(sparklineJson, sparklineIncomeJson, sparklineExpenseJson, 200);
        if (sparklineBitmap != null) {
            views.setImageViewBitmap(R.id.widget_sparkline, sparklineBitmap);
            views.setViewVisibility(R.id.widget_sparkline, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_sparkline, View.GONE);
        }

        // 4. Middle Stat Row: Date & Range on Left
        if (dateText == null || dateText.trim().isEmpty()) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("EEEE, d MMM", new Locale("id", "ID"));
            dateText = sdf.format(new java.util.Date());
        }
        String periodText = period != null ? period : "Bulan Ini";
        if (!periodText.startsWith("(") && !periodText.endsWith(")")) {
            periodText = "(" + periodText + ")";
        }
        views.setTextViewText(R.id.widget_period_label, periodText);

        // 5. Middle Stat Row: Cashflow Chips on Right (strip "Masuk: " / "Keluar: " prefixes)
        String displayIncome = income != null ? income : "+Rp 0";
        if (displayIncome.startsWith("Masuk: ")) displayIncome = displayIncome.substring(7);
        else if (displayIncome.startsWith("In: ")) displayIncome = displayIncome.substring(4);
        views.setTextViewText(R.id.widget_income_text, displayIncome);

        String displayExpense = expense != null ? expense : "-Rp 0";
        if (displayExpense.startsWith("Keluar: ")) displayExpense = displayExpense.substring(8);
        else if (displayExpense.startsWith("Out: ")) displayExpense = displayExpense.substring(5);
        views.setTextViewText(R.id.widget_expense_text, displayExpense);

        // 6. Bottom Row: Semicircular Category Gauge
        Bitmap gaugeBitmap = createCategoryGaugeBitmap(topCategoriesJson);
        if (gaugeBitmap != null) {
            views.setImageViewBitmap(R.id.widget_category_gauge, gaugeBitmap);
            views.setViewVisibility(R.id.widget_category_gauge, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_category_gauge, View.GONE);
        }

        // 7. Bottom Row: Top 3 Category Legend
        try {
            JSONArray catArr = new JSONArray(topCategoriesJson != null ? topCategoriesJson : "[]");
            int catCount = catArr.length();
            int[] catViewIds = new int[] { R.id.widget_cat_1, R.id.widget_cat_2, R.id.widget_cat_3 };
            int[] catColors = new int[] { Color.parseColor("#2DD4BF"), Color.parseColor("#38BDF8"), Color.parseColor("#FB923C") };

            for (int c = 0; c < 3; c++) {
                if (c < catCount) {
                    JSONObject catObj = catArr.optJSONObject(c);
                    if (catObj != null) {
                        String catName = catObj.optString("name", "Kategori");
                        int pct = catObj.optInt("percentage", 0);
                        String colorHex = catObj.optString("color", null);
                        int textColor = catColors[c];
                        if (colorHex != null && colorHex.startsWith("#")) {
                            try { textColor = Color.parseColor(colorHex); } catch (Exception ignored) {}
                        }
                        String displayText = "• " + catName + (pct > 0 ? " " + pct + "%" : "");
                        views.setTextViewText(catViewIds[c], displayText);
                        views.setTextColor(catViewIds[c], textColor);
                        views.setViewVisibility(catViewIds[c], View.VISIBLE);
                    } else {
                        views.setViewVisibility(catViewIds[c], View.GONE);
                    }
                } else {
                    views.setViewVisibility(catViewIds[c], View.GONE);
                }
            }
        } catch (Exception e) {
            views.setTextViewText(R.id.widget_cat_1, "• Makan");
            views.setTextViewText(R.id.widget_cat_2, "• Transport");
            views.setTextViewText(R.id.widget_cat_3, "• Belanja");
        }

        // 8. Bottom Row: Action Button ("Catat Baru")
        String displayBtn = btnText != null ? btnText : "Catat Baru";
        if ("+ Catat".equals(displayBtn) || "Catat Baru".equals(displayBtn)) {
            displayBtn = "Catat Baru";
        } else if ("+ Add".equals(displayBtn) || "New Entry".equals(displayBtn)) {
            displayBtn = "New Entry";
        }
        views.setTextViewText(R.id.widget_btn_add, displayBtn);

        // Click on entire widget container opens the app
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingOpenIntent = PendingIntent.getActivity(
                context,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, pendingOpenIntent);

        // Click on Catat Baru button opens app directly with fintrack://quick-add
        Intent quickAddIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("fintrack://quick-add"));
        quickAddIntent.setClass(context, MainActivity.class);
        quickAddIntent.setPackage(context.getPackageName());
        quickAddIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingQuickAddIntent = PendingIntent.getActivity(
                context,
                1,
                quickAddIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_add, pendingQuickAddIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    /**
     * Generate an offscreen Bitmap containing a multi-wave sparkline trend chart.
     * Renders up to 3 overlapping Bezier wave curves (Net Worth with gradient fill, Income wave, Expense wave),
     * glowing milestone dots, horizontal baseline divider, and 30-day timeline markers.
     */
    public static Bitmap createMultiWaveSparklineBitmap(String sparklineJson, String sparklineIncomeJson, String sparklineExpenseJson, int targetHeight) {
        int width = 800;
        int height = targetHeight > 0 ? targetHeight : 200;
        float leftPadding = 25f;
        float rightPadding = 25f;
        float topPadding = 20f;
        float bottomPadding = 36f;
        float usableWidth = width - leftPadding - rightPadding;
        float usableHeight = height - topPadding - bottomPadding;
        float baselineY = topPadding + usableHeight;

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        float[] netPoints = parsePoints(sparklineJson);
        float[] incomePoints = parsePoints(sparklineIncomeJson);
        float[] expensePoints = parsePoints(sparklineExpenseJson);

        int len = netPoints != null ? netPoints.length : 0;
        if (len < 2 && incomePoints != null && incomePoints.length >= 2) {
            len = incomePoints.length;
        }
        if (len < 2) {
            drawPlaceholderWave(canvas, width, height, leftPadding, usableWidth, usableHeight, topPadding, baselineY);
            return bitmap;
        }

        float stepX = usableWidth / (len - 1);

        // 1. Draw Expense Wave (Soft Rose / Coral) first (background layer)
        if (expensePoints != null && expensePoints.length == len) {
            drawWaveCurve(canvas, expensePoints, len, leftPadding, stepX, topPadding, usableHeight, baselineY,
                    Color.argb(200, 251, 113, 133), // #FB7185
                    Color.argb(25, 251, 113, 133),
                    3.5f, false);
        }

        // 2. Draw Income Wave (Cyan / Teal) second
        if (incomePoints != null && incomePoints.length == len) {
            drawWaveCurve(canvas, incomePoints, len, leftPadding, stepX, topPadding, usableHeight, baselineY,
                    Color.argb(220, 45, 212, 191), // #2DD4BF
                    Color.argb(30, 45, 212, 191),
                    3.5f, false);
        }

        // 3. Draw Net Worth Wave (Emerald / Sage) third (hero foreground layer with gradient fill)
        if (netPoints != null && netPoints.length == len) {
            drawWaveCurve(canvas, netPoints, len, leftPadding, stepX, topPadding, usableHeight, baselineY,
                    Color.rgb(52, 211, 153), // #34D399 Vibrant emerald
                    Color.argb(40, 16, 185, 129), // Rich fill gradient
                    5.5f, true);

            // Glowing milestone dots on hero curve (indices: day 6, day 18, and day len-1)
            float[] pointsY = computeYCoordinates(netPoints, len, topPadding, usableHeight);
            int[] milestones = new int[] {
                    Math.min(len - 1, Math.max(1, len * 6 / 30)),
                    Math.min(len - 1, Math.max(1, len * 18 / 30)),
                    len - 1
            };
            for (int mIdx : milestones) {
                float mx = leftPadding + mIdx * stepX;
                float my = pointsY[mIdx];
                drawGlowDot(canvas, mx, my, Color.rgb(52, 211, 153));
            }
        }

        // 4. Baseline divider line
        Paint baselinePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        baselinePaint.setColor(Color.argb(25, 255, 255, 255)); // 10% white
        baselinePaint.setStrokeWidth(1.2f);
        canvas.drawLine(leftPadding, baselineY, width - rightPadding, baselineY, baselinePaint);

        // 5. Timeline markers at baseline (30h lalu, 6, 12, 15, 20, 25, Hari ini)
        drawTimelineMarkers(canvas, len, leftPadding, stepX, baselineY);

        return bitmap;
    }

    private static float[] parsePoints(String json) {
        if (json == null || json.trim().isEmpty() || "[]".equals(json.trim())) {
            return null;
        }
        try {
            JSONArray arr = new JSONArray(json);
            int len = arr.length();
            if (len == 0) return null;
            float[] points = new float[len];
            for (int i = 0; i < len; i++) {
                double d = arr.optDouble(i, 0.0);
                points[i] = (Double.isNaN(d) || Double.isInfinite(d)) ? 0f : (float) d;
            }
            return points;
        } catch (Exception e) {
            return null;
        }
    }

    private static float[] computeYCoordinates(float[] values, int len, float topPadding, float usableHeight) {
        float[] pointsY = new float[len];
        float minVal = Float.MAX_VALUE;
        float maxVal = -Float.MAX_VALUE;
        for (int i = 0; i < len; i++) {
            if (values[i] < minVal) minVal = values[i];
            if (values[i] > maxVal) maxVal = values[i];
        }
        float range = maxVal - minVal;
        for (int i = 0; i < len; i++) {
            if (range <= 0.0001f) {
                pointsY[i] = topPadding + usableHeight * 0.5f;
            } else {
                float normalized = (values[i] - minVal) / range;
                // Leave 15% breathing room at top and bottom so curves don't clip
                pointsY[i] = topPadding + (0.85f - normalized * 0.70f) * usableHeight;
            }
        }
        return pointsY;
    }

    private static void drawWaveCurve(Canvas canvas, float[] values, int len, float leftPadding, float stepX,
                                      float topPadding, float usableHeight, float baselineY,
                                      int strokeColor, int fillColor, float strokeWidth, boolean drawFill) {
        float[] pointsY = computeYCoordinates(values, len, topPadding, usableHeight);

        Path linePath = new Path();
        linePath.moveTo(leftPadding, pointsY[0]);

        for (int i = 1; i < len; i++) {
            float prevX = leftPadding + (i - 1) * stepX;
            float prevY = pointsY[i - 1];
            float curX = leftPadding + i * stepX;
            float curY = pointsY[i];
            float midX = (prevX + curX) / 2f;
            linePath.cubicTo(midX, prevY, midX, curY, curX, curY);
        }

        if (drawFill) {
            Path fillPath = new Path(linePath);
            fillPath.lineTo(leftPadding + (len - 1) * stepX, baselineY);
            fillPath.lineTo(leftPadding, baselineY);
            fillPath.close();

            LinearGradient gradient = new LinearGradient(
                    0f, topPadding, 0f, baselineY,
                    fillColor, Color.TRANSPARENT, Shader.TileMode.CLAMP
            );
            Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            fillPaint.setStyle(Paint.Style.FILL);
            fillPaint.setShader(gradient);
            canvas.drawPath(fillPath, fillPaint);

            // Layered glow effect under hero line
            Paint glowPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            glowPaint.setStyle(Paint.Style.STROKE);
            glowPaint.setColor(Color.argb(45, Color.red(strokeColor), Color.green(strokeColor), Color.blue(strokeColor)));
            glowPaint.setStrokeWidth(strokeWidth * 2.2f);
            glowPaint.setStrokeCap(Paint.Cap.ROUND);
            glowPaint.setStrokeJoin(Paint.Join.ROUND);
            canvas.drawPath(linePath, glowPaint);
        }

        // Crisp core curve
        Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
        linePaint.setStyle(Paint.Style.STROKE);
        linePaint.setColor(strokeColor);
        linePaint.setStrokeWidth(strokeWidth);
        linePaint.setStrokeCap(Paint.Cap.ROUND);
        linePaint.setStrokeJoin(Paint.Join.ROUND);
        canvas.drawPath(linePath, linePaint);
    }

    private static void drawGlowDot(Canvas canvas, float x, float y, int color) {
        // Outer halo ring
        Paint haloPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        haloPaint.setStyle(Paint.Style.FILL);
        haloPaint.setColor(Color.argb(45, Color.red(color), Color.green(color), Color.blue(color)));
        canvas.drawCircle(x, y, 14f, haloPaint);

        // Middle soft ring
        Paint midPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        midPaint.setStyle(Paint.Style.FILL);
        midPaint.setColor(Color.argb(90, Color.red(color), Color.green(color), Color.blue(color)));
        canvas.drawCircle(x, y, 8f, midPaint);

        // Inner solid ring
        Paint innerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        innerPaint.setStyle(Paint.Style.FILL);
        innerPaint.setColor(color);
        canvas.drawCircle(x, y, 5f, innerPaint);

        // Core white center
        Paint corePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        corePaint.setStyle(Paint.Style.FILL);
        corePaint.setColor(Color.WHITE);
        canvas.drawCircle(x, y, 2.5f, corePaint);
    }

    private static void drawTimelineMarkers(Canvas canvas, int len, float leftPadding, float stepX, float baselineY) {
        Paint tickPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        tickPaint.setColor(Color.argb(35, 255, 255, 255));
        tickPaint.setStrokeWidth(1.2f);

        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.parseColor("#64748B")); // Muted slate
        textPaint.setTextSize(17f);
        textPaint.setTextAlign(Paint.Align.CENTER);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));

        int[] dayIndices = new int[] { 0, 5, 11, 14, 19, 24, len - 1 };
        String[] labels = new String[] { "30h lalu", "6", "12", "15", "20", "25", "Hari ini" };

        for (int i = 0; i < dayIndices.length; i++) {
            int idx = dayIndices[i];
            if (idx >= len) continue;
            float x = leftPadding + idx * stepX;
            canvas.drawLine(x, baselineY, x, baselineY + 4f, tickPaint);
            canvas.drawText(labels[i], x, baselineY + 20f, textPaint);
        }
    }

    private static void drawPlaceholderWave(Canvas canvas, int width, int height, float leftPadding, float usableWidth, float usableHeight, float topPadding, float baselineY) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setColor(Color.argb(45, 134, 168, 121));
        p.setStrokeWidth(3f);

        Path path = new Path();
        float startY = topPadding + usableHeight * 0.5f;
        path.moveTo(leftPadding, startY);
        path.cubicTo(leftPadding + usableWidth * 0.33f, topPadding + usableHeight * 0.3f,
                leftPadding + usableWidth * 0.66f, topPadding + usableHeight * 0.7f,
                leftPadding + usableWidth, startY);
        canvas.drawPath(path, p);
    }

    /**
     * Generate an offscreen Bitmap containing a semicircular gauge for top 3 expense categories.
     * Features a 180° speedometer-style arc with colored pill segments and subtle inner concentric ring.
     */
    public static Bitmap createCategoryGaugeBitmap(String topCategoriesJson) {
        int width = 160;
        int height = 110;
        float centerX = width / 2f;
        float centerY = 95f;
        float radius = 62f;
        float strokeWidth = 16f;

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        RectF arcRect = new RectF(centerX - radius, centerY - radius, centerX + radius, centerY + radius);

        // 1. Draw subtle background track (180 degrees semicircle)
        Paint trackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        trackPaint.setStyle(Paint.Style.STROKE);
        trackPaint.setStrokeWidth(strokeWidth);
        trackPaint.setStrokeCap(Paint.Cap.ROUND);
        trackPaint.setColor(Color.argb(35, 255, 255, 255)); // 14% translucent white track
        canvas.drawArc(arcRect, 180f, 180f, false, trackPaint);

        // 2. Parse top categories
        int p1 = 45, p2 = 30, p3 = 25;
        int c1 = Color.parseColor("#2DD4BF"); // Teal
        int c2 = Color.parseColor("#38BDF8"); // Sky
        int c3 = Color.parseColor("#FB923C"); // Amber

        try {
            JSONArray arr = new JSONArray(topCategoriesJson != null ? topCategoriesJson : "[]");
            if (arr.length() > 0) {
                JSONObject o1 = arr.optJSONObject(0);
                if (o1 != null) {
                    p1 = o1.optInt("percentage", 45);
                    String col = o1.optString("color", null);
                    if (col != null && col.startsWith("#")) {
                        try { c1 = Color.parseColor(col); } catch (Exception ignored) {}
                    }
                }
            }
            if (arr.length() > 1) {
                JSONObject o2 = arr.optJSONObject(1);
                if (o2 != null) {
                    p2 = o2.optInt("percentage", 30);
                    String col = o2.optString("color", null);
                    if (col != null && col.startsWith("#")) {
                        try { c2 = Color.parseColor(col); } catch (Exception ignored) {}
                    }
                }
            } else {
                p2 = 0;
            }
            if (arr.length() > 2) {
                JSONObject o3 = arr.optJSONObject(2);
                if (o3 != null) {
                    p3 = o3.optInt("percentage", 25);
                    String col = o3.optString("color", null);
                    if (col != null && col.startsWith("#")) {
                        try { c3 = Color.parseColor(col); } catch (Exception ignored) {}
                    }
                }
            } else {
                p3 = 0;
            }
        } catch (Exception ignored) {}

        int totalP = p1 + p2 + p3;
        if (totalP <= 0) {
            totalP = 100;
            p1 = 45; p2 = 30; p3 = 25;
        }

        float sweep1 = (p1 / (float) totalP) * 180f;
        float sweep2 = (p2 / (float) totalP) * 180f;
        float sweep3 = (p3 / (float) totalP) * 180f;

        // Draw segmented colored arcs
        float curAngle = 180f;

        Paint segPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        segPaint.setStyle(Paint.Style.STROKE);
        segPaint.setStrokeWidth(strokeWidth);
        segPaint.setStrokeCap(Paint.Cap.ROUND);

        float gap = 3.5f;

        if (sweep1 > gap) {
            segPaint.setColor(c1);
            canvas.drawArc(arcRect, curAngle + (gap / 2f), sweep1 - gap, false, segPaint);
        }
        curAngle += sweep1;

        if (sweep2 > gap) {
            segPaint.setColor(c2);
            canvas.drawArc(arcRect, curAngle + (gap / 2f), sweep2 - gap, false, segPaint);
        }
        curAngle += sweep2;

        if (sweep3 > gap) {
            segPaint.setColor(c3);
            canvas.drawArc(arcRect, curAngle + (gap / 2f), sweep3 - gap, false, segPaint);
        }

        // Inner decorative concentric arc
        Paint innerRingPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        innerRingPaint.setStyle(Paint.Style.STROKE);
        innerRingPaint.setStrokeWidth(2f);
        innerRingPaint.setColor(Color.argb(25, 255, 255, 255));
        RectF innerRect = new RectF(centerX - 40f, centerY - 40f, centerX + 40f, centerY + 40f);
        canvas.drawArc(innerRect, 180f, 180f, false, innerRingPaint);

        // Center typography: "TOP 3"
        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.parseColor("#94A3B8"));
        textPaint.setTextSize(16f);
        textPaint.setTextAlign(Paint.Align.CENTER);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        canvas.drawText("TOP 3", centerX, centerY - 8f, textPaint);

        return bitmap;
    }

    public static Bitmap createSparklineBitmap(String sparklineJson) {
        return createMultiWaveSparklineBitmap(sparklineJson, null, null, 200);
    }

    public static Bitmap createSparklineBitmap(String sparklineJson, String sparklineDatesJson) {
        return createMultiWaveSparklineBitmap(sparklineJson, null, null, 200);
    }

    public static Bitmap createSparklineBitmap(String sparklineJson, String sparklineDatesJson, int targetHeight) {
        return createMultiWaveSparklineBitmap(sparklineJson, null, null, targetHeight);
    }

    public static Bitmap createSparklineBitmap(String sparklineJson, String sparklineDatesJson, String todayNet, float todayNetVal) {
        return createMultiWaveSparklineBitmap(sparklineJson, null, null, 200);
    }
}
