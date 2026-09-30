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
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
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
            period = getSafeString(prefs, "period", "Bulan Ini");
        }

        String sparklineJson = getSafeString(prefs, "fintrack_widget_sparkline", null);
        if (sparklineJson == null || sparklineJson.trim().isEmpty() || "[]".equals(sparklineJson)) {
            sparklineJson = getSafeString(prefs, "sparklineData", "[]");
        }

        String btnText = getSafeString(prefs, "fintrack_widget_btn_text", "+ Catat");
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
                sparklineDatesJson, todayNet, todayNetVal, btnText, balanceLabel, dateText);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                      String balance, String income, String expense, String period, String sparklineJson) {
        updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineJson, "+ Catat", "Kekayaan Bersih");
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

        updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineJson,
                sparklineDatesJson, todayNet, todayNetVal, btnText, balanceLabel, dateText);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                      String balance, String income, String expense, String period, String sparklineJson,
                                      String sparklineDatesJson, String todayNet, float todayNetVal,
                                      String btnText, String balanceLabel, String dateText) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_fintrack_balance);
        views.setTextViewText(R.id.widget_total_balance, balance != null ? balance : "Rp 0");
        views.setTextViewText(R.id.widget_income_text, income != null ? income : "Masuk: +Rp 0");
        views.setTextViewText(R.id.widget_expense_text, expense != null ? expense : "Keluar: -Rp 0");
        views.setTextViewText(R.id.widget_period_label, period != null ? period : "7 Hari Terakhir");
        views.setTextViewText(R.id.widget_balance_label, balanceLabel != null ? balanceLabel : "Kekayaan Bersih");
        views.setTextViewText(R.id.widget_btn_add, btnText != null ? btnText : "+ Catat");

        if (dateText == null || dateText.trim().isEmpty()) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("EEEE, d MMM", new Locale("id", "ID"));
            dateText = sdf.format(new java.util.Date());
        }
        views.setTextViewText(R.id.widget_date_text, dateText);

        // Render trend sparkline with timeline and today net badge
        Bitmap sparklineBitmap = createSparklineBitmap(sparklineJson, sparklineDatesJson, todayNet, todayNetVal);
        if (sparklineBitmap != null) {
            views.setImageViewBitmap(R.id.widget_sparkline, sparklineBitmap);
            views.setViewVisibility(R.id.widget_sparkline, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_sparkline, View.GONE);
        }

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

        // Click on + Catat button opens app directly with fintrack://quick-add
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

    public static Bitmap createSparklineBitmap(String sparklineJson) {
        return createSparklineBitmap(sparklineJson, null, null, 0f);
    }

    /**
     * Generate an offscreen Bitmap containing a smooth sparkline trend chart,
     * daily date timeline labels, and an optional Today Net badge in the top-right corner.
     * Features high-DPI ARGB_8888 rendering, anti-aliasing/dithering, and non-clipped pulse dots.
     */
    public static Bitmap createSparklineBitmap(String sparklineJson, String sparklineDatesJson, String todayNet, float todayNetVal) {
        if (sparklineJson == null || sparklineJson.trim().isEmpty()) {
            return null;
        }

        try {
            JSONArray arr = new JSONArray(sparklineJson);
            int len = arr.length();
            if (len < 1) {
                return null;
            }

            float[] values = new float[len];
            float minVal = Float.MAX_VALUE;
            float maxVal = -Float.MAX_VALUE;

            for (int i = 0; i < len; i++) {
                double d = arr.optDouble(i, 0.0);
                values[i] = (Double.isNaN(d) || Double.isInfinite(d)) ? 0f : (float) d;
                if (values[i] < minVal) minVal = values[i];
                if (values[i] > maxVal) maxVal = values[i];
            }

            int width = 800;
            int height = 240;
            float leftPadding = 36f;
            float rightPadding = 36f;
            float topPadding = 56f;
            float bottomPadding = 50f;
            float usableWidth = width - leftPadding - rightPadding;
            float usableHeight = height - topPadding - bottomPadding;
            float baselineY = height - bottomPadding;
            float range = maxVal - minVal;

            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            float stepX = len > 1 ? usableWidth / (len - 1) : 0f;
            float[] pointsY = new float[len];

            for (int i = 0; i < len; i++) {
                if (range <= 0.0001f) {
                    pointsY[i] = topPadding + usableHeight / 2f;
                } else {
                    float normalized = (values[i] - minVal) / range;
                    // Invert for canvas coordinates (0 is top)
                    pointsY[i] = topPadding + (1f - normalized) * usableHeight;
                }
            }

            Path linePath = new Path();
            Path fillPath = new Path();

            linePath.moveTo(leftPadding, pointsY[0]);
            fillPath.moveTo(leftPadding, baselineY);
            fillPath.lineTo(leftPadding, pointsY[0]);

            if (len == 1) {
                float endX = leftPadding + usableWidth;
                linePath.lineTo(endX, pointsY[0]);
                fillPath.lineTo(endX, pointsY[0]);
                fillPath.lineTo(endX, baselineY);
            } else {
                for (int i = 1; i < len; i++) {
                    float prevX = leftPadding + (i - 1) * stepX;
                    float prevY = pointsY[i - 1];
                    float curX = leftPadding + i * stepX;
                    float curY = pointsY[i];
                    float midX = (prevX + curX) / 2f;

                    linePath.cubicTo(midX, prevY, midX, curY, curX, curY);
                    fillPath.cubicTo(midX, prevY, midX, curY, curX, curY);
                }
                fillPath.lineTo(leftPadding + (len - 1) * stepX, baselineY);
            }
            fillPath.close();

            // 1. Draw subtle area fill with Sage gradient (FinTrack brand accent token) bounded to baseline
            int fillStart = Color.argb(65, 107, 124, 94); // 25% alpha sage #6B7C5E
            int fillEnd = Color.argb(0, 107, 124, 94);     // 0% alpha
            LinearGradient gradient = new LinearGradient(
                    0f, topPadding, 0f, baselineY,
                    fillStart, fillEnd, Shader.TileMode.CLAMP
            );

            Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            fillPaint.setStyle(Paint.Style.FILL);
            fillPaint.setShader(gradient);
            canvas.drawPath(fillPath, fillPaint);

            // 2. Draw stroke line with smooth sage (#86A879)
            Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            linePaint.setStyle(Paint.Style.STROKE);
            linePaint.setColor(Color.rgb(134, 168, 121));
            linePaint.setStrokeWidth(6f);
            linePaint.setStrokeCap(Paint.Cap.ROUND);
            linePaint.setStrokeJoin(Paint.Join.ROUND);
            canvas.drawPath(linePath, linePaint);

            // 3. Draw highlighted pulse dot on the latest point with guaranteed non-clipped boundary
            float lastX = leftPadding + (len > 1 ? (len - 1) * stepX : usableWidth);
            float lastY = pointsY[len - 1];

            Paint outerDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            outerDotPaint.setStyle(Paint.Style.FILL);
            outerDotPaint.setColor(Color.argb(90, 107, 124, 94));
            canvas.drawCircle(lastX, lastY, 14f, outerDotPaint);

            Paint innerDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            innerDotPaint.setStyle(Paint.Style.FILL);
            innerDotPaint.setColor(Color.WHITE);
            canvas.drawCircle(lastX, lastY, 6f, innerDotPaint);

            // 4. Draw timeline divider and date labels below each point
            String[] dateLabels = new String[len];
            JSONArray datesArr = null;
            if (sparklineDatesJson != null && !sparklineDatesJson.trim().isEmpty()) {
                try {
                    datesArr = new JSONArray(sparklineDatesJson);
                } catch (Exception ignored) {}
            }

            if (datesArr != null && datesArr.length() >= len) {
                for (int i = 0; i < len; i++) {
                    dateLabels[i] = datesArr.optString(i, "");
                }
            } else {
                java.util.Calendar cal = java.util.Calendar.getInstance();
                cal.add(java.util.Calendar.DAY_OF_YEAR, -(len - 1));
                for (int i = 0; i < len; i++) {
                    dateLabels[i] = String.valueOf(cal.get(java.util.Calendar.DAY_OF_MONTH));
                    cal.add(java.util.Calendar.DAY_OF_YEAR, 1);
                }
            }

            Paint dividerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            dividerPaint.setColor(Color.argb(20, 255, 255, 255));
            dividerPaint.setStrokeWidth(1.5f);
            canvas.drawLine(leftPadding, baselineY + 6f, width - rightPadding, baselineY + 6f, dividerPaint);

            Paint datePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            datePaint.setTextAlign(Paint.Align.CENTER);
            datePaint.setTextSize(21f);
            datePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

            float dateLabelY = height - 12f;
            for (int i = 0; i < len; i++) {
                float x = leftPadding + (len > 1 ? i * stepX : usableWidth / 2f);
                boolean isToday = (i == len - 1);
                if (isToday) {
                    datePaint.setColor(Color.parseColor("#F8FAFC")); // Bright white for today
                } else {
                    datePaint.setColor(Color.parseColor("#94A3B8")); // Muted slate-400 for past days
                }
                String label = dateLabels[i] != null ? dateLabels[i] : "";
                canvas.drawText(label, x, dateLabelY, datePaint);
            }

            // 5. Draw Today Net Badge at top-right corner if available
            if (todayNet != null && !todayNet.trim().isEmpty()) {
                Paint badgeTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
                badgeTextPaint.setTextSize(22f);
                badgeTextPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
                badgeTextPaint.setTextAlign(Paint.Align.CENTER);

                float textWidth = badgeTextPaint.measureText(todayNet);
                float padH = 16f;
                float pillW = textWidth + padH * 2;
                float pillH = 32f;
                float pillRight = width - rightPadding;
                float pillLeft = pillRight - pillW;
                float pillTop = 10f;
                float pillBottom = pillTop + pillH;
                float cornerRadius = pillH / 2f;

                RectF pillRect = new RectF(pillLeft, pillTop, pillRight, pillBottom);

                int bgColor;
                int borderColor;
                int textColor;

                boolean isPositive = todayNetVal > 0 || todayNet.startsWith("+");
                boolean isNegative = todayNetVal < 0 || todayNet.startsWith("-");

                if (isPositive) {
                    bgColor = Color.argb(45, 134, 239, 172); // soft emerald #86EFAC
                    borderColor = Color.argb(110, 134, 239, 172);
                    textColor = Color.rgb(134, 239, 172);
                } else if (isNegative) {
                    bgColor = Color.argb(45, 253, 164, 175); // soft rose #FDA4AF
                    borderColor = Color.argb(110, 253, 164, 175);
                    textColor = Color.rgb(253, 164, 175);
                } else {
                    bgColor = Color.argb(35, 148, 163, 184); // subtle slate #CBD5E1
                    borderColor = Color.argb(80, 148, 163, 184);
                    textColor = Color.rgb(203, 213, 225);
                }

                Paint pillBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                pillBgPaint.setStyle(Paint.Style.FILL);
                pillBgPaint.setColor(bgColor);
                canvas.drawRoundRect(pillRect, cornerRadius, cornerRadius, pillBgPaint);

                Paint pillBorderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                pillBorderPaint.setStyle(Paint.Style.STROKE);
                pillBorderPaint.setColor(borderColor);
                pillBorderPaint.setStrokeWidth(2f);
                canvas.drawRoundRect(pillRect, cornerRadius, cornerRadius, pillBorderPaint);

                badgeTextPaint.setColor(textColor);
                Paint.FontMetrics fm = badgeTextPaint.getFontMetrics();
                float textY = pillRect.centerY() - (fm.ascent + fm.descent) / 2f;
                canvas.drawText(todayNet, pillRect.centerX(), textY, badgeTextPaint);
            }

            return bitmap;
        } catch (Exception e) {
            return null;
        }
    }
}
