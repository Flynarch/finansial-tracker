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
        if (ACTION_UPDATE_WIDGET.equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, FinTrackWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            onUpdate(context, appWidgetManager, appWidgetIds);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        
        String balance = prefs.getString("fintrack_widget_balance", "Rp 0");
        String income = prefs.getString("fintrack_widget_income", "Masuk: Rp 0");
        String expense = prefs.getString("fintrack_widget_expense", "Keluar: Rp 0");
        String period = prefs.getString("fintrack_widget_period", "Bulan Ini");
        String sparklineJson = prefs.getString("fintrack_widget_sparkline", "[]");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_fintrack_balance);
        views.setTextViewText(R.id.widget_total_balance, balance);
        views.setTextViewText(R.id.widget_income_text, income);
        views.setTextViewText(R.id.widget_expense_text, expense);
        views.setTextViewText(R.id.widget_period_label, period);

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
                values[i] = (float) arr.optDouble(i, 0.0);
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
