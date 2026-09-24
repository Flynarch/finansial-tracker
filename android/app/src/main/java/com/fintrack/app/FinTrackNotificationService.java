package com.fintrack.app;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class FinTrackNotificationService extends NotificationListenerService {
    private static final String TAG = "FinTrackNotifService";
    public static final String PREFS_NAME = "FinTrackEncryptedNotificationPrefs";
    public static final String LEGACY_PREFS_NAME = "FinTrackNotificationPrefs";
    public static final String KEY_QUEUE = "fintrack_notification_queue";
    public static final Object QUEUE_LOCK = new Object();

    // Whitelisted Indonesian Financial & E-Wallet Applications
    private static final Set<String> WHITELISTED_PACKAGES = new HashSet<>(Arrays.asList(
        "com.bca",
        "com.bca.mybca",
        "com.bca.blu",
        "id.co.bankmandiri.livin",
        "id.co.bri.brimo",
        "id.co.bni.wondr",
        "src.bni",
        "com.btpn.jenius",
        "id.co.bankbsi.mobile",
        "com.bsi.mobile",
        "id.co.cimbniaga.octomobile",
        "com.linecorp.linebank.id",
        "com.seabank.id",
        "com.jago.bank",
        "com.gojek.app",
        "com.gopay.wallet",
        "ovo.id",
        "id.dana",
        "com.shopee.id"
    ));

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (packageName == null || !isFinancialPackage(packageName)) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleChar = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleChar != null ? titleChar.toString() : "";
        String text = textChar != null ? textChar.toString() : "";
        if (bigTextChar != null && bigTextChar.length() > text.length()) {
            text = bigTextChar.toString();
        }

        if (title.isEmpty() && text.isEmpty()) {
            return;
        }

        String lowerCombined = (title + " " + text).toLowerCase();

        // Guard 1: Filter general Shopee e-commerce, shopping orders, and live-stream spam
        if ("com.shopee.id".equalsIgnoreCase(packageName)) {
            boolean isShopeeWallet = lowerCombined.contains("shopeepay") ||
                lowerCombined.contains("isi saldo") ||
                lowerCombined.contains("transfer") ||
                lowerCombined.contains("pembayaran") ||
                lowerCombined.contains("qris");
            if (!isShopeeWallet) {
                return;
            }
        }

        // Guard 2: Filter obvious marketing clickbaits, engagement questions, and promo hype emojis
        if (title.contains("?") || text.contains("?") ||
            title.contains("👉") || text.contains("👉") ||
            title.contains("🔥") || text.contains("🔥") ||
            lowerCombined.contains("cek caranya") ||
            lowerCombined.contains("saldo gratis") ||
            lowerCombined.contains("gratis saldo") ||
            lowerCombined.contains("bisa terima") ||
            lowerCombined.contains("mau hemat") ||
            lowerCombined.contains("voucher diskon") ||
            lowerCombined.contains("gratis ongkir") ||
            lowerCombined.contains("flash sale") ||
            lowerCombined.contains("live stream")) {
            return;
        }

        // Guard 3: Filter failed, rejected, cancelled transactions or unpaid reminders
        if (lowerCombined.contains("gagal") ||
            lowerCombined.contains("tidak berhasil") ||
            lowerCombined.contains("belum berhasil") ||
            lowerCombined.contains("dibatalkan") ||
            lowerCombined.contains("kadaluarsa") ||
            lowerCombined.contains("kedaluwarsa") ||
            lowerCombined.contains("ditolak") ||
            lowerCombined.contains("menunggu pembayaran") ||
            lowerCombined.contains("tagihan telah terbit") ||
            lowerCombined.contains("segera bayar")) {
            return;
        }

        long postTime = sbn.getPostTime();
        saveNotificationToQueue(packageName, title, text, postTime);
    }

    private boolean isFinancialPackage(String pkg) {
        return WHITELISTED_PACKAGES.contains(pkg.toLowerCase());
    }

    public static SharedPreferences getEncryptedPreferences(Context context) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();

            SharedPreferences encryptedPrefs = EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );

            // Check if legacy unencrypted preferences exist and migrate
            SharedPreferences legacyPrefs = context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE);
            if (legacyPrefs.contains(KEY_QUEUE)) {
                String legacyQueue = legacyPrefs.getString(KEY_QUEUE, null);
                if (legacyQueue != null && !legacyQueue.equals("[]")) {
                    String currentQueue = encryptedPrefs.getString(KEY_QUEUE, "[]");
                    if (currentQueue.equals("[]")) {
                        encryptedPrefs.edit().putString(KEY_QUEUE, legacyQueue).commit();
                    }
                }
                legacyPrefs.edit().clear().commit();
            }

            return encryptedPrefs;
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize EncryptedSharedPreferences, falling back to private SharedPreferences", e);
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        }
    }

    private void saveNotificationToQueue(String packageName, String title, String text, long postTime) {
        synchronized (QUEUE_LOCK) {
            try {
                SharedPreferences prefs = getEncryptedPreferences(this);
                String currentQueueJson = prefs.getString(KEY_QUEUE, "[]");
                JSONArray queueArray = new JSONArray(currentQueueJson);

                // Rapid duplicate suppression (within 3 seconds for identical package, title, and text)
                if (queueArray.length() > 0) {
                    JSONObject last = queueArray.getJSONObject(queueArray.length() - 1);
                    if (packageName.equals(last.optString("packageName")) &&
                        title.equals(last.optString("title")) &&
                        text.equals(last.optString("text")) &&
                        Math.abs(postTime - last.optLong("timestamp", 0)) < 3000) {
                        Log.d(TAG, "Suppressed rapid duplicate notification from " + packageName);
                        return;
                    }
                }

                JSONObject item = new JSONObject();
                item.put("id", "notif_" + postTime + "_" + (int)(Math.random() * 1000));
                item.put("packageName", packageName);
                item.put("title", title);
                item.put("text", text);
                item.put("timestamp", postTime);

                queueArray.put(item);

                // Limit queue size to last 100 entries to prevent memory growth
                if (queueArray.length() > 100) {
                    JSONArray trimmed = new JSONArray();
                    for (int i = queueArray.length() - 100; i < queueArray.length(); i++) {
                        trimmed.put(queueArray.get(i));
                    }
                    queueArray = trimmed;
                }

                prefs.edit().putString(KEY_QUEUE, queueArray.toString()).commit();
                Log.d(TAG, "Queued financial notification from " + packageName + " | " + title);
            } catch (Exception e) {
                Log.e(TAG, "Error queuing notification", e);
            }
        }
    }
}
