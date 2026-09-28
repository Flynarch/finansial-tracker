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
import android.Manifest;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(
    name = "FinTrackNotification",
    permissions = {
        @Permission(
            alias = "sms",
            strings = {
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS
            }
        )
    }
)
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
        "com.shopee.id",
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.coloros.mms",
        "com.vivo.mms"
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
    public void checkSmsPermission(PluginCall call) {
        Context context = getContext();
        boolean receiveGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean readGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("receiveGranted", receiveGranted);
        ret.put("readGranted", readGranted);
        ret.put("granted", receiveGranted && readGranted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        requestPermissionForAlias("sms", call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        checkSmsPermission(call);
    }

    @PluginMethod
    public void scanHistoricalSms(PluginCall call) {
        Context context = getContext();
        int days = call.getInt("days", 30);
        long cutoffTime = System.currentTimeMillis() - (days * 86400000L);

        JSArray resultArr = new JSArray();

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("mutations", resultArr);
            ret.put("error", "READ_SMS permission not granted");
            call.resolve(ret);
            return;
        }

        Uri uri = Uri.parse("content://sms/inbox");
        String selection = "date >= ?";
        String[] selectionArgs = new String[] { String.valueOf(cutoffTime) };
        String sortOrder = "date DESC LIMIT 200";

        try (Cursor cursor = context.getContentResolver().query(uri, new String[] { "_id", "address", "body", "date" }, selection, selectionArgs, sortOrder)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idIdx = cursor.getColumnIndex("_id");
                int addrIdx = cursor.getColumnIndex("address");
                int bodyIdx = cursor.getColumnIndex("body");
                int dateIdx = cursor.getColumnIndex("date");

                do {
                    String id = cursor.getString(idIdx);
                    String address = cursor.getString(addrIdx);
                    String body = cursor.getString(bodyIdx);
                    long date = cursor.getLong(dateIdx);

                    if (address == null) address = "";
                    if (body == null) body = "";

                    String upperAddress = address.toUpperCase(Locale.ROOT);
                    String addressDigits = upperAddress.replaceAll("[^0-9]", "");
                    String lowerBody = body.toLowerCase(Locale.ROOT);

                    // Check if sender matches a financial institution or official shortcode
                    boolean isFinancial = upperAddress.contains("BCA") ||
                        upperAddress.contains("MANDIRI") ||
                        upperAddress.contains("BRI") ||
                        upperAddress.contains("BNI") ||
                        upperAddress.contains("CIMB") ||
                        upperAddress.contains("PERMATA") ||
                        upperAddress.contains("DANAMON") ||
                        upperAddress.contains("MEGA") ||
                        upperAddress.contains("CITI") ||
                        upperAddress.contains("HSBC") ||
                        upperAddress.contains("BSI") ||
                        upperAddress.contains("SEABANK") ||
                        upperAddress.contains("JAGO") ||
                        upperAddress.contains("JENIUS") ||
                        upperAddress.contains("BLU") ||
                        addressDigits.equals("69888") || addressDigits.equals("6269888") ||
                        addressDigits.equals("83355") || addressDigits.equals("6283355") ||
                        addressDigits.equals("3355") || addressDigits.equals("623355") ||
                        addressDigits.equals("3300") || addressDigits.equals("623300") ||
                        addressDigits.equals("3346") || addressDigits.equals("623346") ||
                        addressDigits.equals("1418") || addressDigits.equals("621418") ||
                        addressDigits.equals("3399") || addressDigits.equals("623399") ||
                        addressDigits.equals("3377") || addressDigits.equals("623377") ||
                        lowerBody.startsWith("bca:") ||
                        lowerBody.startsWith("mandiri:") ||
                        lowerBody.startsWith("bri:") ||
                        lowerBody.startsWith("bni:") ||
                        lowerBody.startsWith("cimb:") ||
                        lowerBody.startsWith("permata:") ||
                        lowerBody.startsWith("danamon:") ||
                        lowerBody.startsWith("mega:") ||
                        lowerBody.startsWith("citibank:") ||
                        lowerBody.startsWith("hsbc:");

                    // Reject OTP, security keywords, and loan spam instantly
                    boolean isOtp = lowerBody.contains("otp") ||
                        lowerBody.contains("kode rahasia") ||
                        lowerBody.contains("jangan berikan") ||
                        lowerBody.contains("verifikasi") ||
                        lowerBody.contains("kode verifikasi") ||
                        lowerBody.contains("kode autentikasi") ||
                        lowerBody.contains("token") ||
                        lowerBody.contains("http://") ||
                        lowerBody.contains("https://") ||
                        lowerBody.contains("klik link") ||
                        lowerBody.contains("penawaran kta") ||
                        lowerBody.contains("kta kilat") ||
                        lowerBody.contains("dana tunai") ||
                        lowerBody.contains("pinjaman kilat");

                    if (isFinancial && !isOtp && (lowerBody.contains("rp") || lowerBody.contains("idr"))) {
                        JSObject obj = new JSObject();
                        obj.put("id", "sms_hist_" + id);
                        obj.put("packageName", "android.provider.Telephony.SMS_RECEIVED");
                        obj.put("title", address);
                        obj.put("text", body);
                        obj.put("timestamp", date);
                        resultArr.put(obj);
                    }
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            Log.e("FinTrackNotifPlugin", "Failed to query SMS inbox", e);
        }

        JSObject ret = new JSObject();
        ret.put("mutations", resultArr);
        call.resolve(ret);
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
