package com.fintrack.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public class FinTrackSmsReceiver extends BroadcastReceiver {
    private static final String TAG = "FinTrackSmsReceiver";

    // Known financial institutions & official SMS shortcodes in Indonesia
    private static final Set<String> WHITELISTED_SENDERS = new HashSet<>(Arrays.asList(
        "BCA", "BANK BCA", "M-BCA", "MYBCA",
        "MANDIRI", "BANK MANDIRI", "LIVIN",
        "BRI", "BANK BRI", "BRIMO", "BRI-INFO",
        "BNI", "BANK BNI", "WONDR",
        "CIMB", "CIMB NIAGA", "OCTO",
        "PERMATA", "PERMATABANK", "BANK PERMATA",
        "DANAMON", "BANK DANAMON",
        "MEGA", "BANK MEGA",
        "CITIBANK", "CITI",
        "HSBC", "BANK HSBC",
        "BSI", "BANK BSI", "BSI MOBILE",
        "SEABANK", "BANK JAGO", "JAGO", "JENIUS", "BLU",
        // Indonesian official banking SMS shortcodes
        "69888", // BCA
        "83355", // Mandiri
        "3355",  // BRI
        "3300",  // BNI
        "3346",  // CIMB
        "1418",  // Permata
        "3399",  // Danamon
        "3377"   // Mega
    ));

    // Instant rejection keywords for OTP / secret security codes (zero persistence)
    private static final String[] OTP_REJECT_KEYWORDS = {
        "kode otp", "otp anda", "kode rahasia", "jangan berikan",
        "kode verifikasi", "kode autentikasi", "verification code",
        "secret code", "one time password", "passcode", "security code",
        "http://", "https://", "klik link", "penawaran kta", "kta kilat",
        "dana tunai", "pinjaman kilat", "bunga ringan", "butuh dana"
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        SmsMessage[] messages = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            try {
                messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            } catch (Exception e) {
                Log.w(TAG, "Failed to get messages from Telephony.Sms.Intents", e);
            }
        }

        // Fallback to legacy PDU parsing if modern Telephony intents API returns null or empty
        if (messages == null || messages.length == 0) {
            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                Object[] pdus = (Object[]) bundle.get("pdus");
                if (pdus != null && pdus.length > 0) {
                    String format = bundle.getString("format");
                    messages = new SmsMessage[pdus.length];
                    for (int i = 0; i < pdus.length; i++) {
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                messages[i] = SmsMessage.createFromPdu((byte[]) pdus[i], format);
                            } else {
                                messages[i] = SmsMessage.createFromPdu((byte[]) pdus[i]);
                            }
                        } catch (Exception e) {
                            Log.w(TAG, "Failed to parse SMS PDU", e);
                        }
                    }
                }
            }
        }

        if (messages == null || messages.length == 0) return;

        StringBuilder fullBody = new StringBuilder();
        String sender = "";
        long timestamp = System.currentTimeMillis();

        for (SmsMessage message : messages) {
            if (message != null) {
                if (sender.isEmpty()) {
                    sender = message.getDisplayOriginatingAddress();
                    if (sender == null) sender = "";
                    timestamp = message.getTimestampMillis();
                    if (timestamp <= 0) timestamp = System.currentTimeMillis();
                }
                fullBody.append(message.getMessageBody());
            }
        }

        String body = fullBody.toString().trim();
        if (body.isEmpty()) return;

        // Check if sender matches financial institution or shortcode
        String upperSender = sender.toUpperCase(Locale.ROOT).trim();
        String senderDigits = upperSender.replaceAll("[^0-9]", "");
        boolean isWhitelisted = false;

        for (String white : WHITELISTED_SENDERS) {
            if (white.matches("\\d+")) {
                if (senderDigits.equals(white) || senderDigits.equals("62" + white)) {
                    isWhitelisted = true;
                    break;
                }
            } else if (upperSender.contains(white)) {
                isWhitelisted = true;
                break;
            }
        }

        // If sender is a generic shortcode or phone number, check if body starts with bank signature
        if (!isWhitelisted) {
            String lowerBody = body.toLowerCase(Locale.ROOT);
            if (lowerBody.startsWith("bca:") || lowerBody.startsWith("mandiri:") ||
                lowerBody.startsWith("bri:") || lowerBody.startsWith("bni:") ||
                lowerBody.startsWith("cimb:") || lowerBody.startsWith("permata:") ||
                lowerBody.startsWith("danamon:") || lowerBody.startsWith("mega:") ||
                lowerBody.startsWith("citibank:") || lowerBody.startsWith("hsbc:")) {
                isWhitelisted = true;
            }
        }

        if (!isWhitelisted) {
            return;
        }

        // Anti-OTP & Anti-Spam Guard: zero persistence
        String lowerBody = body.toLowerCase(Locale.ROOT);
        for (String rejectKeyword : OTP_REJECT_KEYWORDS) {
            if (lowerBody.contains(rejectKeyword)) {
                Log.d(TAG, "Instantly rejected security/OTP/spam SMS from " + sender);
                return;
            }
        }

        // Must contain currency or transaction marker
        if (!lowerBody.contains("rp") && !lowerBody.contains("idr")) {
            return;
        }

        // Save to shared encrypted queue with cross-channel deduplication
        FinTrackNotificationService.saveNotificationToQueue(
            context,
            "android.provider.Telephony.SMS_RECEIVED",
            sender,
            body,
            timestamp
        );
        Log.d(TAG, "Successfully enqueued financial SMS from: " + sender);
    }
}
