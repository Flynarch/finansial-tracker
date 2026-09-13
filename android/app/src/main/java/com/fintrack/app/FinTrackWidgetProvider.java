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
import android.graphics.Shader;
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

        updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineJson);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                      String balance, String income, String expense, String period, String sparklineJson) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_fintrack_balance);
        views.setTextViewText(R.id.widget_total_balance, balance != null ? balance : "Rp 0");
        views.setTextViewText(R.id.widget_income_text, income != null ? income : "Masuk: Rp 0");
        views.setTextViewText(R.id.widget_expense_text, expense != null ? expense : "Keluar: Rp 0");
        views.setTextViewText(R.id.widget_period_label, period != null ? period : "Bulan Ini");

        // Render trend sparkline
        Bitmap sparklineBitmap = createSparklineBitmap(sparklineJson);
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

    /**
     * Generate an offscreen Bitmap containing a smooth sparkline trend chart
     */
    private static Bitmap createSparklineBitmap(String sparklineJson) {
        if (sparklineJson == null || sparklineJson.trim().isEmpty()) {
            return null;
        }

        try {
            JSONArray arr = new JSONArray(sparklineJson);
            int len = arr.length();
            if (len < 2) {
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

            int width = 400;
            int height = 100;
            float topPadding = 14f;
            float bottomPadding = 12f;
            float usableHeight = height - topPadding - bottomPadding;
            float range = maxVal - minVal;

            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            float stepX = (float) width / (len - 1);
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

            linePath.moveTo(0f, pointsY[0]);
            fillPath.moveTo(0f, height);
            fillPath.lineTo(0f, pointsY[0]);

            for (int i = 1; i < len; i++) {
                float prevX = (i - 1) * stepX;
                float prevY = pointsY[i - 1];
                float curX = i * stepX;
                float curY = pointsY[i];
                float midX = (prevX + curX) / 2f;

                linePath.cubicTo(midX, prevY, midX, curY, curX, curY);
                fillPath.cubicTo(midX, prevY, midX, curY, curX, curY);
            }

            fillPath.lineTo(width, height);
            fillPath.close();

            // 1. Draw subtle area fill with Emerald gradient (app brand accent)
            int fillStart = Color.argb(75, 16, 185, 129); // 30% alpha emerald #10B981
            int fillEnd = Color.argb(0, 16, 185, 129);    // 0% alpha
            LinearGradient gradient = new LinearGradient(
                    0f, topPadding, 0f, height,
                    fillStart, fillEnd, Shader.TileMode.CLAMP
            );

            Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            fillPaint.setStyle(Paint.Style.FILL);
            fillPaint.setShader(gradient);
            canvas.drawPath(fillPath, fillPaint);

            // 2. Draw stroke line with crisp emerald-400 (#34D399)
            Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            linePaint.setStyle(Paint.Style.STROKE);
            linePaint.setColor(Color.rgb(52, 211, 153));
            linePaint.setStrokeWidth(5f);
            linePaint.setStrokeCap(Paint.Cap.ROUND);
            linePaint.setStrokeJoin(Paint.Join.ROUND);
            canvas.drawPath(linePath, linePaint);

            // 3. Draw highlighted pulse dot on the latest point
            float lastX = (len - 1) * stepX;
            float lastY = pointsY[len - 1];

            Paint outerDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            outerDotPaint.setStyle(Paint.Style.FILL);
            outerDotPaint.setColor(Color.argb(100, 16, 185, 129));
            canvas.drawCircle(lastX, lastY, 11f, outerDotPaint);

            Paint innerDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            innerDotPaint.setStyle(Paint.Style.FILL);
            innerDotPaint.setColor(Color.WHITE);
            canvas.drawCircle(lastX, lastY, 5f, innerDotPaint);

            return bitmap;
        } catch (Exception e) {
            return null;
        }
    }
}
