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

        // Bind elegant inline Net today text next to total balance
        if (todayNet != null && !todayNet.trim().isEmpty() && !"Rp 0".equals(todayNet.trim()) && !"+Rp 0".equals(todayNet.trim())) {
            views.setTextViewText(R.id.widget_today_net, todayNet);
            if (todayNetVal > 0 || todayNet.startsWith("+")) {
                views.setTextColor(R.id.widget_today_net, Color.parseColor("#86EFAC")); // Soft emerald
            } else if (todayNetVal < 0 || todayNet.startsWith("-")) {
                views.setTextColor(R.id.widget_today_net, Color.parseColor("#FDA4AF")); // Soft rose
            } else {
                views.setTextColor(R.id.widget_today_net, Color.parseColor("#94A3B8")); // Muted slate
            }
            views.setViewVisibility(R.id.widget_today_net, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_today_net, View.GONE);
        }

        // Determine calibrated sparkline canvas height based on widget bounds
        int targetCanvasHeight = 210;
        if (appWidgetManager != null && appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            try {
                Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
                if (options != null) {
                    int minW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
                    int minH = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
                    if (minW > 0 && minH > 0) {
                        int estChartW = Math.max(160, minW - 28);
                        int estChartH = Math.max(60, minH - 92);
                        float ratio = (float) estChartH / (float) estChartW;
                        int calcH = Math.round(800f * ratio);
                        targetCanvasHeight = Math.max(160, Math.min(320, calcH));
                    }
                }
            } catch (Exception ignored) {}
        }

        // Render trend sparkline with timeline (calibrated aspect ratio to prevent squishing)
        Bitmap sparklineBitmap = createSparklineBitmap(sparklineJson, sparklineDatesJson, targetCanvasHeight);
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
        return createSparklineBitmap(sparklineJson, null);
    }

    public static Bitmap createSparklineBitmap(String sparklineJson, String sparklineDatesJson, String todayNet, float todayNetVal) {
        return createSparklineBitmap(sparklineJson, sparklineDatesJson);
    }

    /**
     * Generate an offscreen Bitmap containing an un-distorted smooth sparkline trend chart
     * with daily date timeline labels. Aspect ratio is calibrated to match real-world
     * widget viewport dimensions, ensuring true circular pulse dots and un-squished text.
     */
    public static Bitmap createSparklineBitmap(String sparklineJson, String sparklineDatesJson) {
        return createSparklineBitmap(sparklineJson, sparklineDatesJson, 210);
    }

    public static Bitmap createSparklineBitmap(String sparklineJson, String sparklineDatesJson, int targetHeight) {
        if (sparklineJson == null || sparklineJson.trim().isEmpty() || "[]".equals(sparklineJson.trim())) {
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

            // Calibrated dimensions adaptive to widget viewport
            int width = 800;
            int height = targetHeight > 0 ? targetHeight : 210;
            float leftPadding = 32f;
            float rightPadding = 32f;
            float topPadding = Math.max(16f, height * 0.12f);
            float bottomPadding = Math.max(40f, height * 0.23f);
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
            int[] fillColors = new int[] {
                Color.argb(45, 107, 124, 94),  // sage alpha 18%
                Color.argb(25, 107, 124, 94),  // sage alpha 10%
                Color.argb(8, 107, 124, 94),   // sage alpha 3%
                Color.argb(0, 107, 124, 94)    // transparent
            };
            float[] fillPositions = new float[] { 0f, 0.4f, 0.7f, 1f };
            LinearGradient gradient = new LinearGradient(
                0f, topPadding, 0f, baselineY,
                fillColors, fillPositions, Shader.TileMode.CLAMP
            );

            Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            fillPaint.setStyle(Paint.Style.FILL);
            fillPaint.setShader(gradient);
            canvas.drawPath(fillPath, fillPaint);

            // Layer 1: Wide ambient glow (outermost bloom)
            Paint glowPaint1 = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            glowPaint1.setStyle(Paint.Style.STROKE);
            glowPaint1.setColor(Color.argb(35, 134, 168, 121)); // sage #86A879 at 14% alpha
            glowPaint1.setStrokeWidth(14f);
            glowPaint1.setStrokeCap(Paint.Cap.ROUND);
            glowPaint1.setStrokeJoin(Paint.Join.ROUND);
            glowPaint1.setMaskFilter(new android.graphics.BlurMaskFilter(18f, android.graphics.BlurMaskFilter.Blur.NORMAL));
            canvas.drawPath(linePath, glowPaint1);

            // Layer 2: Medium bloom
            Paint glowPaint2 = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            glowPaint2.setStyle(Paint.Style.STROKE);
            glowPaint2.setColor(Color.argb(55, 134, 168, 121)); // sage at 22% alpha
            glowPaint2.setStrokeWidth(9f);
            glowPaint2.setStrokeCap(Paint.Cap.ROUND);
            glowPaint2.setStrokeJoin(Paint.Join.ROUND);
            glowPaint2.setMaskFilter(new android.graphics.BlurMaskFilter(8f, android.graphics.BlurMaskFilter.Blur.NORMAL));
            canvas.drawPath(linePath, glowPaint2);

            // Layer 3: Core crisp line (existing, keep same)
            Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            linePaint.setStyle(Paint.Style.STROKE);
            linePaint.setColor(Color.rgb(134, 168, 121)); // sage #86A879
            linePaint.setStrokeWidth(5.5f);
            linePaint.setStrokeCap(Paint.Cap.ROUND);
            linePaint.setStrokeJoin(Paint.Join.ROUND);
            canvas.drawPath(linePath, linePaint);

            // 2b. Draw small indicator dots at each data point (except last)
            Paint dotIndicatorPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            dotIndicatorPaint.setStyle(Paint.Style.FILL);
            dotIndicatorPaint.setColor(Color.argb(100, 134, 168, 121)); // sage at ~39% alpha
            for (int i = 0; i < len - 1; i++) {
                float dotX = leftPadding + (len > 1 ? i * stepX : usableWidth / 2f);
                float dotY = pointsY[i];
                canvas.drawCircle(dotX, dotY, 3.2f, dotIndicatorPaint);
            }

            // 3. Draw highlighted pulse dot with concentric glow rings on the latest point
            float lastX = leftPadding + (len > 1 ? (len - 1) * stepX : usableWidth);
            float lastY = pointsY[len - 1];

            // Ring 1 (outermost): ambient glow
            Paint ring1Paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            ring1Paint.setStyle(Paint.Style.FILL);
            ring1Paint.setColor(Color.argb(25, 107, 124, 94));
            canvas.drawCircle(lastX, lastY, 18f, ring1Paint);

            // Ring 2: inner glow
            Paint ring2Paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            ring2Paint.setStyle(Paint.Style.FILL);
            ring2Paint.setColor(Color.argb(45, 107, 124, 94));
            canvas.drawCircle(lastX, lastY, 13f, ring2Paint);

            // Ring 3: solid ring
            Paint ring3Paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            ring3Paint.setStyle(Paint.Style.FILL);
            ring3Paint.setColor(Color.argb(85, 134, 168, 121));
            canvas.drawCircle(lastX, lastY, 8f, ring3Paint);

            // Ring 4 (core): bright white center
            Paint coreDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            coreDotPaint.setStyle(Paint.Style.FILL);
            coreDotPaint.setColor(Color.WHITE);
            canvas.drawCircle(lastX, lastY, 4f, coreDotPaint);

            // 4. Draw subtle timeline divider and date labels below each point
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

            // 4a. Draw subtle vertical tick marks at each date position
            Paint tickPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            tickPaint.setColor(Color.argb(20, 255, 255, 255)); // 8% white
            tickPaint.setStrokeWidth(1f);
            for (int i = 0; i < len; i++) {
                float tickX = leftPadding + (len > 1 ? i * stepX : usableWidth / 2f);
                canvas.drawLine(tickX, baselineY, tickX, baselineY + 4f, tickPaint);
            }

            Paint dividerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            dividerPaint.setColor(Color.argb(22, 255, 255, 255));
            dividerPaint.setStrokeWidth(1.5f);
            canvas.drawLine(leftPadding, baselineY + 4f, width - rightPadding, baselineY + 4f, dividerPaint);

            Paint datePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
            datePaint.setTextAlign(Paint.Align.CENTER);
            datePaint.setTextSize(Math.max(20f, height * 0.11f));
            datePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

            float dateLabelY = height - 9f;
            for (int i = 0; i < len; i++) {
                float x = leftPadding + (len > 1 ? i * stepX : usableWidth / 2f);
                boolean isToday = (i == len - 1);
                if (isToday) {
                    datePaint.setColor(Color.parseColor("#F8FAFC")); // Bright white for today
                } else {
                    datePaint.setColor(Color.parseColor("#525C6B")); // Slate-500 muted for past days
                }
                String label = dateLabels[i] != null ? dateLabels[i] : "";
                canvas.drawText(label, x, dateLabelY, datePaint);
            }

            return bitmap;
        } catch (Exception e) {
            return null;
        }
    }
}
