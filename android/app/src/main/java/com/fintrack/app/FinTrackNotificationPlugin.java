package com.fintrack.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.provider.Settings;
import android.text.TextUtils;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Set;

@CapacitorPlugin(name = "FinTrackNotification")
public class FinTrackNotificationPlugin extends Plugin {

    private static final String[] KNOWN_FINANCIAL_PACKAGES = {
        "com.bca",
        "com.bca.mybca",
        "id.co.bankmandiri.livin",
        "id.co.bri.brimo",
        "id.co.bni.wondr",
        "src.bni",
        "com.btpn.jenius",
        "id.co.cimbniaga.octomobile",
        "com.seabank.id",
        "com.jago.bank",
        "com.gojek.app",
        "com.gopay.wallet",
        "ovo.id",
        "id.dana",
        "com.shopee.id"
    };

    @PluginMethod
    public void isPermissionGranted(PluginCall call) {
        Context context = getContext();
        boolean isGranted = false;
        try {
            Set<String> packageNames = NotificationManagerCompat.getEnabledListenerPackages(context);
            isGranted = packageNames.contains(context.getPackageName());
        } catch (Exception e) {
            isGranted = false;
        }

        JSObject ret = new JSObject();
        ret.put("granted", isGranted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open notification listener settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void drainQueuedMutations(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        synchronized (FinTrackNotificationService.QUEUE_LOCK) {
            try {
                SharedPreferences prefs = FinTrackNotificationService.getEncryptedPreferences(context);
                String queueJson = prefs.getString(FinTrackNotificationService.KEY_QUEUE, "[]");
                JSONArray jsonArray = new JSONArray(queueJson);

                JSArray resultArr = new JSArray();
                for (int i = 0; i < jsonArray.length(); i++) {
                    JSONObject item = jsonArray.getJSONObject(i);
                    JSObject obj = new JSObject();
                    obj.put("id", item.optString("id"));
                    obj.put("packageName", item.optString("packageName"));
                    obj.put("title", item.optString("title"));
                    obj.put("text", item.optString("text"));
                    obj.put("timestamp", item.optLong("timestamp"));
                    resultArr.put(obj);
                }

                // Atomically clear the queue within synchronized block
                prefs.edit().putString(FinTrackNotificationService.KEY_QUEUE, "[]").commit();

                ret.put("mutations", resultArr);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to drain queued mutations: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void getQueuedMutations(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        synchronized (FinTrackNotificationService.QUEUE_LOCK) {
            try {
                SharedPreferences prefs = FinTrackNotificationService.getEncryptedPreferences(context);
                String queueJson = prefs.getString(FinTrackNotificationService.KEY_QUEUE, "[]");
                JSONArray jsonArray = new JSONArray(queueJson);

                JSArray resultArr = new JSArray();
                for (int i = 0; i < jsonArray.length(); i++) {
                    JSONObject item = jsonArray.getJSONObject(i);
                    JSObject obj = new JSObject();
                    obj.put("id", item.optString("id"));
                    obj.put("packageName", item.optString("packageName"));
                    obj.put("title", item.optString("title"));
                    obj.put("text", item.optString("text"));
                    obj.put("timestamp", item.optLong("timestamp"));
                    resultArr.put(obj);
                }

                ret.put("mutations", resultArr);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to retrieve queued mutations: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void clearQueuedMutations(PluginCall call) {
        Context context = getContext();
        synchronized (FinTrackNotificationService.QUEUE_LOCK) {
            try {
                SharedPreferences prefs = FinTrackNotificationService.getEncryptedPreferences(context);
                prefs.edit().putString(FinTrackNotificationService.KEY_QUEUE, "[]").commit();

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to clear queue: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void getSupportedInstitutions(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        JSArray list = new JSArray();

        for (String pkg : KNOWN_FINANCIAL_PACKAGES) {
            JSObject item = new JSObject();
            item.put("packageName", pkg);
            boolean installed = false;
            try {
                pm.getPackageInfo(pkg, PackageManager.GET_ACTIVITIES);
                installed = true;
            } catch (Exception ignored) {
                installed = false;
            }
            item.put("isInstalled", installed);
            list.put(item);
        }

        JSObject ret = new JSObject();
        ret.put("institutions", list);
        call.resolve(ret);
    }

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        Context context = getContext();
        try {
            // Support multiple possible key names
            String balance = call.getString("balance");
            if (balance == null || balance.trim().isEmpty()) balance = call.getString("totalBalance");
            if (balance == null || balance.trim().isEmpty()) balance = call.getString("total_net_worth");
            if (balance == null || balance.trim().isEmpty()) balance = call.getString("wallet_balance", "Rp 0");

            String income = call.getString("income");
            if (income == null || income.trim().isEmpty()) income = call.getString("monthIncome", "Masuk: Rp 0");
            if (!income.startsWith("Masuk:") && !income.startsWith("In:")) {
                income = "Masuk: " + income;
            }

            String expense = call.getString("expense");
            if (expense == null || expense.trim().isEmpty()) expense = call.getString("monthExpense", "Keluar: Rp 0");
            if (!expense.startsWith("Keluar:") && !expense.startsWith("Out:")) {
                expense = "Keluar: " + expense;
            }

            String period = call.getString("period", "Bulan Ini");

            String sparklineData = call.getString("sparklineData");
            if (sparklineData == null || sparklineData.trim().isEmpty()) {
                JSArray arr = call.getArray("sparklinePoints");
                if (arr != null) {
                    sparklineData = arr.toString();
                } else {
                    arr = call.getArray("sparklineData");
                    sparklineData = arr != null ? arr.toString() : "[]";
                }
            }

            String btnText = call.getString("btnText", "+ Catat");
            String balanceLabel = call.getString("balanceLabel", "Kekayaan Bersih");
            String dateText = call.getString("dateText");
            if (dateText == null || dateText.trim().isEmpty()) {
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("EEEE, d MMM", new java.util.Locale("id", "ID"));
                dateText = sdf.format(new java.util.Date());
            }

            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            prefs.edit()
                .putString("fintrack_widget_balance", balance)
                .putString("total_net_worth", balance)
                .putString("wallet_balance", balance)
                .putString("fintrack_widget_income", income)
                .putString("month_income", income)
                .putString("income", income)
                .putString("fintrack_widget_expense", expense)
                .putString("month_expense", expense)
                .putString("expense", expense)
                .putString("fintrack_widget_period", period)
                .putString("period", period)
                .putString("fintrack_widget_date", dateText)
                .putString("fintrack_widget_sparkline", sparklineData)
                .putString("sparklineData", sparklineData)
                .putString("fintrack_widget_btn_text", btnText)
                .putString("fintrack_widget_balance_label", balanceLabel)
                .commit();

            // Direct in-process update to all active widget instances
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, FinTrackWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            if (appWidgetIds != null && appWidgetIds.length > 0) {
                for (int appWidgetId : appWidgetIds) {
                    FinTrackWidgetProvider.updateAppWidget(context, appWidgetManager, appWidgetId, balance, income, expense, period, sparklineData, btnText, balanceLabel, dateText);
                }
            }

            // Broadcast update intents for system launchers
            Intent updateIntent = new Intent(context, FinTrackWidgetProvider.class);
            updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
            context.sendBroadcast(updateIntent);

            Intent customIntent = new Intent(context, FinTrackWidgetProvider.class);
            customIntent.setAction(FinTrackWidgetProvider.ACTION_UPDATE_WIDGET);
            context.sendBroadcast(customIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to update widget data: " + e.getMessage());
        }
    }
}
