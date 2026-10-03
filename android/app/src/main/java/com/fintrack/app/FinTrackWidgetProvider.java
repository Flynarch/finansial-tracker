package com.fintrack.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.ArrayMap;
import android.util.Log;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;

import java.util.Locale;
import java.util.Map;

public class FinTrackWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "FinTrackWidget";
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
            return String.valueOf(val);
        } catch (Exception e) {
            return defaultVal;
        }
    }

    private static float getSafeFloat(SharedPreferences prefs, String key, float defaultVal) {
        try {
            if (!prefs.contains(key)) return defaultVal;
            Object val = prefs.getAll().get(key);
            if (val == null) return defaultVal;
            if (val instanceof Number) return ((Number) val).floatValue();
            return Float.parseFloat(String.valueOf(val));
        } catch (Exception e) {
            return defaultVal;
        }
    }

    private static String stripLeadingSigns(String s) {
        if (s == null) return "0";
        String res = s.trim();
        while (res.startsWith("+") || res.startsWith("-") || res.startsWith("\u2212")) {
            res = res.substring(1).trim();
        }
        return res.isEmpty() ? "0" : res;
    }

    private static class WidgetModel {
        String labelSmall;
        String labelMediumLarge;
        String periodSmall;
        String periodInline;
        String balanceSmall;
        String balanceMediumLarge;
        String incomeDisplay;
        String expenseDisplay;
        String netDisplay;
        int netSign;
        boolean hideBalance;
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

            // Read preferences
            String balance = getSafeString(prefs, "fintrack_widget_balance", null);
            if (balance == null || balance.trim().isEmpty() || "Rp 0".equals(balance) || "0".equals(balance)) {
                String fallback = getSafeString(prefs, "total_net_worth", null);
                if (fallback == null || fallback.trim().isEmpty()) {
                    fallback = getSafeString(prefs, "wallet_balance", "0");
                }
                if (fallback != null && !fallback.trim().isEmpty()) {
                    balance = fallback;
                }
            }
            if (balance == null || balance.trim().isEmpty()) {
                balance = "0";
            }

            String balanceCompact = getSafeString(prefs, "fintrack_widget_balance_compact", null);
            if (balanceCompact == null || balanceCompact.trim().isEmpty()) {
                balanceCompact = balance;
            }

            String incomeCompact = getSafeString(prefs, "fintrack_widget_income_compact", null);
            if (incomeCompact == null || incomeCompact.trim().isEmpty()) {
                String rawIncome = getSafeString(prefs, "fintrack_widget_income", null);
                if (rawIncome == null || rawIncome.trim().isEmpty()) {
                    rawIncome = getSafeString(prefs, "month_income", null);
                    if (rawIncome == null || rawIncome.trim().isEmpty()) {
                        rawIncome = getSafeString(prefs, "income", "0");
                    }
                }
                if (rawIncome != null) {
                    rawIncome = rawIncome.trim();
                    if (rawIncome.startsWith("Masuk:")) rawIncome = rawIncome.substring(6).trim();
                    else if (rawIncome.startsWith("In:")) rawIncome = rawIncome.substring(3).trim();
                }
                incomeCompact = stripLeadingSigns(rawIncome);
            } else {
                incomeCompact = stripLeadingSigns(incomeCompact);
            }

            String expenseCompact = getSafeString(prefs, "fintrack_widget_expense_compact", null);
            if (expenseCompact == null || expenseCompact.trim().isEmpty()) {
                String rawExpense = getSafeString(prefs, "fintrack_widget_expense", null);
                if (rawExpense == null || rawExpense.trim().isEmpty()) {
                    rawExpense = getSafeString(prefs, "month_expense", null);
                    if (rawExpense == null || rawExpense.trim().isEmpty()) {
                        rawExpense = getSafeString(prefs, "expense", "0");
                    }
                }
                if (rawExpense != null) {
                    rawExpense = rawExpense.trim();
                    if (rawExpense.startsWith("Keluar:")) rawExpense = rawExpense.substring(7).trim();
                    else if (rawExpense.startsWith("Out:")) rawExpense = rawExpense.substring(4).trim();
                }
                expenseCompact = stripLeadingSigns(rawExpense);
            } else {
                expenseCompact = stripLeadingSigns(expenseCompact);
            }

            String netCompact = getSafeString(prefs, "fintrack_widget_net_compact", null);
            int netSign = 0;
            String netSignStr = getSafeString(prefs, "fintrack_widget_net_sign", null);
            if (netSignStr != null && !netSignStr.trim().isEmpty()) {
                try {
                    netSign = Integer.parseInt(netSignStr.trim());
                } catch (Exception e) {
                    try {
                        float f = Float.parseFloat(netSignStr.trim());
                        netSign = f > 0 ? 1 : (f < 0 ? -1 : 0);
                    } catch (Exception ignored) {
                    }
                }
            }

            if (netCompact == null || netCompact.trim().isEmpty()) {
                float incVal = getSafeFloat(prefs, "fintrack_widget_income_val_num", 0f);
                float expVal = getSafeFloat(prefs, "fintrack_widget_expense_val_num", 0f);
                float surplus = incVal - expVal;
                if (Math.abs(surplus) > 0.01f) {
                    netSign = surplus > 0 ? 1 : -1;
                    netCompact = getSafeString(prefs, "fintrack_widget_surplus_formatted", String.format(Locale.US, "%,.0f", Math.abs(surplus)));
                } else {
                    netSign = 0;
                    netCompact = "";
                }
            } else {
                netCompact = stripLeadingSigns(netCompact);
            }

            String localeStr = getSafeString(prefs, "fintrack_widget_locale", "id");
            String currencyPrefix = getSafeString(prefs, "fintrack_widget_currency_prefix", "Rp");

            // Localized context
            Configuration config = new Configuration(context.getResources().getConfiguration());
            Locale targetLocale = "en".equalsIgnoreCase(localeStr) ? Locale.ENGLISH : new Locale("id", "ID");
            config.setLocale(targetLocale);
            Context locCtx = context.createConfigurationContext(config);

            // Period text
            String range = prefs.getString("widget_config_range_" + appWidgetId, prefs.getString("widget_config_range", "month"));
            String periodText;
            if ("7d".equals(range)) {
                periodText = locCtx.getString(R.string.widget_period_7d);
            } else if ("30d".equals(range)) {
                periodText = locCtx.getString(R.string.widget_period_30d);
            } else {
                periodText = locCtx.getString(R.string.widget_period_month);
            }

            String walletId = prefs.getString("widget_config_wallet_id_" + appWidgetId, prefs.getString("widget_config_wallet_id", "-1"));
            String walletName = prefs.getString("widget_config_wallet_name_" + appWidgetId, prefs.getString("widget_config_wallet_name", ""));
            if (!"-1".equals(walletId) && walletName != null && !walletName.trim().isEmpty()) {
                periodText = walletName.trim() + " \u00B7 " + periodText;
            }

            // Hide balance preference
            boolean hideBalance = false;
            try {
                if (prefs.contains("widget_config_hide_balance_" + appWidgetId)) {
                    Object val = prefs.getAll().get("widget_config_hide_balance_" + appWidgetId);
                    if (val instanceof Boolean) {
                        hideBalance = (Boolean) val;
                    } else if (val != null) {
                        hideBalance = "true".equalsIgnoreCase(String.valueOf(val).trim());
                    }
                }
            } catch (Exception ignored) {
            }

            WidgetModel model = new WidgetModel();
            model.labelSmall = locCtx.getString(R.string.widget_label_balance_short);
            model.labelMediumLarge = locCtx.getString(R.string.widget_label_net_worth);
            model.periodSmall = periodText;
            model.periodInline = " \u00B7 " + periodText;
            model.hideBalance = hideBalance;

            if (hideBalance) {
                String masked = currencyPrefix + " " + locCtx.getString(R.string.widget_hidden_mask);
                model.balanceSmall = masked;
                model.balanceMediumLarge = masked;
            } else {
                model.balanceSmall = balanceCompact;
                model.balanceMediumLarge = balance;
            }

            model.incomeDisplay = "+" + incomeCompact;
            model.expenseDisplay = "\u2212" + expenseCompact;
            model.netSign = netSign;
            if (netSign > 0) {
                model.netDisplay = "+" + netCompact;
            } else if (netSign < 0) {
                model.netDisplay = "\u2212" + netCompact;
            } else {
                model.netDisplay = "";
            }

            // Render trend bitmap for large layout
            Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
            int orientation = context.getResources().getConfiguration().orientation;
            boolean isLandscape = (orientation == Configuration.ORIENTATION_LANDSCAPE);
            int widthDp = isLandscape
                ? (options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0) : 0)
                : (options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) : 0);
            if (widthDp <= 0) {
                int minWidth = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) : 0;
                widthDp = minWidth > 0 ? minWidth : 220;
            }
            widthDp = Math.max(widthDp, 220);

            int heightDp = isLandscape
                ? (options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) : 0)
                : (options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0);
            if (heightDp <= 0) {
                heightDp = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
            }
            int targetHeightDp = heightDp > 140 ? (heightDp - 130) : 56;
            targetHeightDp = Math.max(targetHeightDp, 48);

            float density = context.getResources().getDisplayMetrics().density;
            int widthPx = Math.round((widthDp - 32) * density);
            widthPx = Math.min(Math.max(widthPx, 100), 1200);
            int heightPx = Math.max(Math.round(targetHeightDp * density), 20);

            String sparklineJson = getSafeString(prefs, "fintrack_widget_sparkline", null);
            if (sparklineJson == null || sparklineJson.trim().isEmpty() || "[]".equals(sparklineJson)) {
                sparklineJson = getSafeString(prefs, "sparklineData", "[]");
            }
            Bitmap chartBitmap = renderTrendBitmap(context, sparklineJson, widthPx, heightPx);

            // Build RemoteViews for small, medium, and large
            RemoteViews smallViews = buildViews(context, locCtx, R.layout.widget_fintrack_small, model, null, appWidgetId);
            RemoteViews mediumViews = buildViews(context, locCtx, R.layout.widget_fintrack_medium, model, null, appWidgetId);
            RemoteViews largeViews = buildViews(context, locCtx, R.layout.widget_fintrack_large, model, chartBitmap, appWidgetId);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Map<SizeF, RemoteViews> viewMapping = new ArrayMap<>();
                viewMapping.put(new SizeF(110f, 110f), smallViews);
                viewMapping.put(new SizeF(220f, 110f), mediumViews);
                viewMapping.put(new SizeF(220f, 180f), largeViews);
                appWidgetManager.updateAppWidget(appWidgetId, new RemoteViews(viewMapping));
            } else {
                int minWidth = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) : 0;
                int maxHeight = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
                RemoteViews selectedViews;
                if (minWidth > 0 && minWidth < 200) {
                    selectedViews = smallViews;
                } else if (maxHeight >= 170) {
                    selectedViews = largeViews;
                } else {
                    selectedViews = mediumViews;
                }
                appWidgetManager.updateAppWidget(appWidgetId, selectedViews);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to update widget id " + appWidgetId, e);
        }
    }

    private static RemoteViews buildViews(Context context, Context locCtx, int layoutId, WidgetModel m, Bitmap chartOrNull, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);

        // Header label & period
        if (layoutId == R.layout.widget_fintrack_small) {
            views.setTextViewText(R.id.widget_label, m.labelSmall);
            views.setTextViewText(R.id.widget_period, m.periodSmall);
        } else {
            views.setTextViewText(R.id.widget_label, m.labelMediumLarge);
            views.setTextViewText(R.id.widget_period, m.periodInline);
        }

        // PendingIntent for + button (quick add)
        Intent quickAddIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("fintrack://quick-add"));
        quickAddIntent.setClass(context, MainActivity.class);
        quickAddIntent.setPackage(context.getPackageName());
        quickAddIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingQuickAdd = PendingIntent.getActivity(
                context,
                appWidgetId * 10 + 1,
                quickAddIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_add, pendingQuickAdd);

        // PendingIntent for whole container (open app)
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingOpen = PendingIntent.getActivity(
                context,
                appWidgetId * 10 + 0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(android.R.id.background, pendingOpen);

        // Hero Balance
        if (layoutId == R.layout.widget_fintrack_small) {
            views.setTextViewText(R.id.widget_balance, m.balanceSmall);
        } else {
            views.setTextViewText(R.id.widget_balance, m.balanceMediumLarge);
        }

        // Flow row (medium & large only)
        if (layoutId == R.layout.widget_fintrack_medium || layoutId == R.layout.widget_fintrack_large) {
            if (m.hideBalance) {
                views.setViewVisibility(R.id.widget_flow_row, View.GONE);
            } else {
                views.setViewVisibility(R.id.widget_flow_row, View.VISIBLE);
                views.setTextViewText(R.id.widget_income_label, locCtx.getString(R.string.widget_income));
                views.setTextViewText(R.id.widget_income_value, m.incomeDisplay);
                views.setTextViewText(R.id.widget_expense_label, locCtx.getString(R.string.widget_expense));
                views.setTextViewText(R.id.widget_expense_value, m.expenseDisplay);

                if (m.netSign != 0 && !m.netDisplay.isEmpty()) {
                    views.setTextViewText(R.id.widget_net_value, m.netDisplay);
                    views.setTextColor(R.id.widget_net_value, m.netSign > 0 ? locCtx.getColor(R.color.widget_income) : locCtx.getColor(R.color.widget_expense));
                    views.setViewVisibility(R.id.widget_net_value, View.VISIBLE);
                } else {
                    views.setViewVisibility(R.id.widget_net_value, View.GONE);
                }
            }
        }

        // Chart (large only)
        if (layoutId == R.layout.widget_fintrack_large) {
            if (chartOrNull != null) {
                views.setImageViewBitmap(R.id.widget_chart, chartOrNull);
                views.setViewVisibility(R.id.widget_chart, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_chart, View.GONE);
            }
        }

        return views;
    }

    public static Bitmap renderTrendBitmap(Context ctx, String netPointsJson, int widthPx, int heightPx) {
        if (widthPx <= 0) widthPx = 200;
        if (heightPx <= 0) heightPx = 56;
        Bitmap bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        float density = ctx.getResources().getDisplayMetrics().density;
        int hairlineColor = ctx.getColor(R.color.widget_hairline);
        int incomeColor = ctx.getColor(R.color.widget_income);
        int expenseColor = ctx.getColor(R.color.widget_expense);

        float[] rawPoints = parsePoints(netPointsJson);
        if (rawPoints == null || rawPoints.length < 2) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setStyle(Paint.Style.STROKE);
            p.setColor(hairlineColor);
            p.setStrokeWidth(1.0f * density);
            float midY = heightPx / 2f;
            canvas.drawLine(0f, midY, widthPx, midY, p);
            return bitmap;
        }

        int len = rawPoints.length;
        float[] cum = new float[len];
        cum[0] = rawPoints[0];
        boolean allZeros = (cum[0] == 0f);
        for (int i = 1; i < len; i++) {
            cum[i] = cum[i - 1] + rawPoints[i];
            if (cum[i] != 0f) {
                allZeros = false;
            }
        }

        if (allZeros) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setStyle(Paint.Style.STROKE);
            p.setColor(hairlineColor);
            p.setStrokeWidth(1.0f * density);
            float midY = heightPx / 2f;
            canvas.drawLine(0f, midY, widthPx, midY, p);
            return bitmap;
        }

        float minVal = 0f;
        float maxVal = 0f;
        for (float v : cum) {
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
        }
        float range = maxVal - minVal;
        if (range <= 0.0001f) {
            range = 1f;
        }

        float topInset = 4f * density;
        float bottomInset = 4f * density;
        float usableHeight = heightPx - topInset - bottomInset;
        if (usableHeight <= 0f) usableHeight = heightPx;

        // Draw zero baseline
        float zeroY = topInset + (maxVal - 0f) / range * usableHeight;
        Paint baselinePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        baselinePaint.setStyle(Paint.Style.STROKE);
        baselinePaint.setColor(hairlineColor);
        baselinePaint.setStrokeWidth(1.0f * density);
        canvas.drawLine(0f, zeroY, widthPx, zeroY, baselinePaint);

        float dotRadius = 3.0f * density;
        float horizontalPadding = dotRadius + 1.0f * density;
        float leftPadding = horizontalPadding;
        float rightPadding = horizontalPadding;
        float usableWidth = widthPx - leftPadding - rightPadding;
        if (usableWidth <= 0f) usableWidth = widthPx;
        float stepX = usableWidth / (len - 1);

        float[] pointsX = new float[len];
        float[] pointsY = new float[len];
        for (int i = 0; i < len; i++) {
            pointsX[i] = leftPadding + i * stepX;
            pointsY[i] = topInset + (maxVal - cum[i]) / range * usableHeight;
        }

        Path path = new Path();
        path.moveTo(pointsX[0], pointsY[0]);
        for (int i = 1; i < len; i++) {
            float prevX = pointsX[i - 1];
            float prevY = pointsY[i - 1];
            float curX = pointsX[i];
            float curY = pointsY[i];
            float midX = (prevX + curX) / 2f;
            path.cubicTo(midX, prevY, midX, curY, curX, curY);
        }

        int trendColor = (cum[len - 1] >= 0f) ? incomeColor : expenseColor;

        Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
        linePaint.setStyle(Paint.Style.STROKE);
        linePaint.setColor(trendColor);
        linePaint.setStrokeWidth(1.5f * density);
        linePaint.setStrokeCap(Paint.Cap.ROUND);
        linePaint.setStrokeJoin(Paint.Join.ROUND);
        canvas.drawPath(path, linePaint);

        Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dotPaint.setStyle(Paint.Style.FILL);
        dotPaint.setColor(trendColor);
        canvas.drawCircle(pointsX[len - 1], pointsY[len - 1], dotRadius, dotPaint);

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
}
