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
import java.util.Locale;
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
        "id.co.bcadigital.blu",
        "com.bca.blu",
        "id.bmri.livin",
        "id.co.bankmandiri.livin",
        "id.co.bri.brimo",
        "id.bni.wondr",
        "id.co.bni.wondr",
        "src.bni",
        "com.btpn.dc",
        "com.btpn.jenius",
        "id.co.bankbsi.mobile",
        "com.bsi.mobile",
        "com.cimbniaga.octomobile",
        "id.co.cimbniaga.octomobile",
        "com.linecorp.linebank.id",
        "com.seabank.id",
        "com.jago.digitalBanking",
        "com.jago.bank",
        "id.co.banksaqu.mobile",
        "id.co.superbank.app",
        "com.allobank.allobank",
        "com.bnc.finance",
        "com.gojek.app",
        "com.gojek.gopay",
        "com.gopay.wallet",
        "ovo.id",
        "id.dana",
        "com.shopee.id",
        // Default SMS / MMS Messaging Applications
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.coloros.mms",
        "com.vivo.mms"
    ));

    private static final Set<String> SMS_PACKAGES = new HashSet<>(Arrays.asList(
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.coloros.mms",
        "com.vivo.mms"
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
        CharSequence bigTitleChar = extras.getCharSequence(Notification.EXTRA_TITLE_BIG);
        CharSequence bigTextChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence subTextChar = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);

        String title = titleChar != null ? titleChar.toString() : "";
        if (title.isEmpty() && bigTitleChar != null) {
            title = bigTitleChar.toString();
        }

        String text = "";
        if (bigTextChar != null && bigTextChar.length() > 0) {
            text = bigTextChar.toString();
        } else if (textChar != null && textChar.length() > 0) {
            text = textChar.toString();
        }

        if (textChar != null && textChar.length() > text.length()) {
            text = textChar.toString();
        }

        if (text.isEmpty()) {
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null && lines.length > 0) {
                StringBuilder sb = new StringBuilder();
                for (CharSequence line : lines) {
                    if (line != null && line.length() > 0) {
                        if (sb.length() > 0) sb.append(" ");
                        sb.append(line);
                    }
                }
                text = sb.toString();
            }
        }

        if (text.isEmpty() && subTextChar != null) {
            text = subTextChar.toString();
        } else if (title.isEmpty() && subTextChar != null) {
            title = subTextChar.toString();
        }

        if (title.isEmpty() && text.isEmpty()) {
            return;
        }

        String lowerCombined = (title + " " + text).toLowerCase();

        // Guard: For SMS apps, strictly verify that the sender or body matches a financial institution
        if (isSmsPackage(packageName)) {
            boolean hasBankSignature = lowerCombined.contains("bca") ||
                lowerCombined.contains("mandiri") ||
                lowerCombined.contains("bri") ||
                lowerCombined.contains("bni") ||
                lowerCombined.contains("cimb") ||
                lowerCombined.contains("permata") ||
                lowerCombined.contains("danamon") ||
                lowerCombined.contains("mega") ||
                lowerCombined.contains("citi") ||
                lowerCombined.contains("hsbc") ||
                lowerCombined.contains("seabank") ||
                lowerCombined.contains("jago") ||
                lowerCombined.contains("bsi") ||
                lowerCombined.contains("jenius") ||
                lowerCombined.contains("blu");

            boolean hasCurrency = lowerCombined.contains("rp") || lowerCombined.contains("idr");
            if (!hasBankSignature || !hasCurrency) {
                return;
            }

            // Reject OTP and security codes instantly
            if (lowerCombined.contains("otp") ||
                lowerCombined.contains("kode rahasia") ||
                lowerCombined.contains("jangan berikan") ||
                lowerCombined.contains("verifikasi") ||
                lowerCombined.contains("token") ||
                lowerCombined.contains("http://") ||
                lowerCombined.contains("https://")) {
                return;
            }
        }

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
            title.contains("\uD83D\uDC49") || text.contains("\uD83D\uDC49") ||
            title.contains("\uD83D\uDD25") || text.contains("\uD83D\uDD25") ||
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
        saveNotificationToQueue(this, packageName, title, text, postTime);
    }

    private boolean isFinancialPackage(String pkg) {
        if (pkg == null) return false;
        String lower = pkg.toLowerCase();
        if (WHITELISTED_PACKAGES.contains(lower)) {
            return true;
        }
        try {
            SharedPreferences prefs = getEncryptedPreferences(this);
            String customJson = prefs.getString("custom_whitelisted_packages", "[]");
            JSONArray arr = new JSONArray(customJson);
            for (int i = 0; i < arr.length(); i++) {
                String customPkg = arr.optString(i, "").toLowerCase();
                if (!customPkg.isEmpty() && customPkg.equals(lower)) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    private boolean isSmsPackage(String pkg) {
        return SMS_PACKAGES.contains(pkg.toLowerCase());
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

    public static void saveNotificationToQueue(Context context, String packageName, String title, String text, long postTime) {
        synchronized (QUEUE_LOCK) {
            try {
                SharedPreferences prefs = getEncryptedPreferences(context);
                String currentQueueJson = prefs.getString(KEY_QUEUE, "[]");
                JSONArray queueArray = new JSONArray(currentQueueJson);

                String normText = text != null ? text.replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT) : "";
                String normTitle = title != null ? title.replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT) : "";

                // Cross-channel deduplication: check recent entries (within 60 seconds)
                // Suppresses duplicates even if package name differs between SMS receiver and messaging app
                for (int i = queueArray.length() - 1; i >= 0 && i >= queueArray.length() - 25; i--) {
                    JSONObject existing = queueArray.getJSONObject(i);
                    long existingTime = existing.optLong("timestamp", 0);
                    if (Math.abs(postTime - existingTime) > 60000) {
                        continue;
                    }

                    String exPkg = existing.optString("packageName");
                    String exTitle = existing.optString("title").replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
                    String exText = existing.optString("text").replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);

                    // 1. Identical package, title, and text
                    if (packageName.equals(exPkg) && normTitle.equals(exTitle) && normText.equals(exText)) {
                        Log.d(TAG, "Suppressed rapid duplicate notification from " + packageName);
                        return;
                    }

                    // 2. Cross-channel content match (SMS broadcast vs Notification listener)
                    // Suppress duplicate only when one source is SMS and the other is financial notification
                    if (!normText.isEmpty() && !exText.isEmpty()) {
                        String lowPkg = packageName.toLowerCase(Locale.ROOT);
                        String lowExPkg = exPkg.toLowerCase(Locale.ROOT);
                        boolean isSmsOne = lowPkg.contains("sms") || lowPkg.contains("messaging") || lowPkg.contains("mms");
                        boolean isSmsTwo = lowExPkg.contains("sms") || lowExPkg.contains("messaging") || lowExPkg.contains("mms");
                        boolean isCrossChannel = isSmsOne ^ isSmsTwo;

                        if (isCrossChannel && (normText.equals(exText) || normText.contains(exText) || exText.contains(normText))) {
                            Log.d(TAG, "Suppressed cross-channel duplicate between " + packageName + " and " + exPkg);
                            return;
                        }
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
