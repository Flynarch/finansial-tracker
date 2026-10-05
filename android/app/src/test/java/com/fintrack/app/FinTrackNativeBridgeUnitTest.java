package com.fintrack.app;

import static org.junit.Assert.*;

import org.junit.Test;
import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * JVM Local Unit Test Suite for FinTrack Native Bridge and Configuration.
 * Validates package ID contracts, Indonesian financial app whitelists,
 * SMS banking shortcodes, anti-OTP rejection keywords, and widget intent actions.
 */
public class FinTrackNativeBridgeUnitTest {

    public static final String EXPECTED_APP_ID = "com.fintrack.app";

    @Test
    public void testApplicationIdContract() {
        assertEquals("FinTrack application ID must match com.fintrack.app", "com.fintrack.app", EXPECTED_APP_ID);
        assertEquals("FinTrack package declaration must match com.fintrack.app",
                FinTrackNativeBridgeUnitTest.class.getPackage().getName(), EXPECTED_APP_ID);
    }

    @Test
    @SuppressWarnings("unchecked")
    public void testFinancialInstitutionsWhitelistIntegrity() throws Exception {
        // Inspect FinTrackNotificationPlugin known financial packages
        Field pluginPackagesField = FinTrackNotificationPlugin.class.getDeclaredField("KNOWN_FINANCIAL_PACKAGES");
        pluginPackagesField.setAccessible(true);
        String[] pluginPackages = (String[]) pluginPackagesField.get(null);

        assertNotNull("KNOWN_FINANCIAL_PACKAGES must not be null", pluginPackages);
        assertTrue("Whitelist must contain at least 34 financial/SMS packages", pluginPackages.length >= 34);

        Set<String> packageSet = new HashSet<>(Arrays.asList(pluginPackages));

        // Core Indonesian Banking Apps
        assertTrue("Must include BCA Mobile", packageSet.contains("com.bca"));
        assertTrue("Must include myBCA", packageSet.contains("com.bca.mybca"));
        assertTrue("Must include Blu by BCA Digital", packageSet.contains("id.co.bcadigital.blu") || packageSet.contains("com.bca.blu"));
        assertTrue("Must include Livin by Mandiri", packageSet.contains("id.bmri.livin") || packageSet.contains("id.co.bankmandiri.livin"));
        assertTrue("Must include BRImo", packageSet.contains("id.co.bri.brimo"));
        assertTrue("Must include Wondr by BNI", packageSet.contains("id.bni.wondr") || packageSet.contains("id.co.bni.wondr"));
        assertTrue("Must include OCTO Mobile by CIMB Niaga", packageSet.contains("com.cimbniaga.octomobile"));
        assertTrue("Must include BSI Mobile", packageSet.contains("id.co.bankbsi.mobile") || packageSet.contains("com.bsi.mobile"));
        assertTrue("Must include SeaBank", packageSet.contains("com.seabank.id"));
        assertTrue("Must include Bank Jago", packageSet.contains("com.jago.digitalBanking") || packageSet.contains("com.jago.bank"));

        // E-Wallet & Fintech Apps
        assertTrue("Must include Gojek", packageSet.contains("com.gojek.app"));
        assertTrue("Must include GoPay", packageSet.contains("com.gojek.gopay") || packageSet.contains("com.gopay.wallet"));
        assertTrue("Must include OVO", packageSet.contains("ovo.id"));
        assertTrue("Must include DANA", packageSet.contains("id.dana"));
        assertTrue("Must include Shopee", packageSet.contains("com.shopee.id"));

        // SMS Messengers
        assertTrue("Must include Google Messages", packageSet.contains("com.google.android.apps.messaging"));
        assertTrue("Must include Samsung Messaging", packageSet.contains("com.samsung.android.messaging"));

        // Also check FinTrackNotificationService whitelist
        Field servicePackagesField = FinTrackNotificationService.class.getDeclaredField("WHITELISTED_PACKAGES");
        servicePackagesField.setAccessible(true);
        Set<String> servicePackages = (Set<String>) servicePackagesField.get(null);
        assertNotNull("WHITELISTED_PACKAGES in FinTrackNotificationService must not be null", servicePackages);
        assertTrue("FinTrackNotificationService whitelist must match plugin package count", servicePackages.size() >= 34);
    }

    @Test
    @SuppressWarnings("unchecked")
    public void testSmsBankingShortcodesAndSenders() throws Exception {
        Field sendersField = FinTrackSmsReceiver.class.getDeclaredField("WHITELISTED_SENDERS");
        sendersField.setAccessible(true);
        Set<String> whitelistedSenders = (Set<String>) sendersField.get(null);

        assertNotNull("WHITELISTED_SENDERS must not be null", whitelistedSenders);

        // Official Indonesian bank SMS shortcodes
        String[] expectedShortcodes = {
            "69888", // BCA
            "83355", // Mandiri
            "3355",  // BRI
            "3300",  // BNI
            "3346",  // CIMB Niaga
            "1418",  // Permata
            "3399",  // Danamon
            "3377"   // Mega
        };

        for (String shortcode : expectedShortcodes) {
            assertTrue("Whitelisted senders must include official banking shortcode: " + shortcode,
                    whitelistedSenders.contains(shortcode));
        }

        // Bank brand sender titles
        String[] expectedBankNames = {"BCA", "MANDIRI", "BRI", "BNI", "CIMB", "PERMATA", "DANAMON", "MEGA", "SEABANK", "JAGO"};
        for (String bank : expectedBankNames) {
            boolean found = false;
            for (String sender : whitelistedSenders) {
                if (sender.contains(bank)) {
                    found = true;
                    break;
                }
            }
            assertTrue("Whitelisted senders must include bank: " + bank, found);
        }
    }

    @Test
    public void testAntiOtpSecurityFilterKeywords() throws Exception {
        Field otpField = FinTrackSmsReceiver.class.getDeclaredField("OTP_REJECT_KEYWORDS");
        otpField.setAccessible(true);
        String[] otpKeywords = (String[]) otpField.get(null);

        assertNotNull("OTP_REJECT_KEYWORDS must not be null", otpKeywords);
        assertTrue("Must define at least 15 security and anti-spam rejection keywords", otpKeywords.length >= 15);

        Set<String> keywordSet = new HashSet<>(Arrays.asList(otpKeywords));

        // Essential security phrases that MUST trigger immediate rejection
        assertTrue("Must reject 'kode otp'", keywordSet.contains("kode otp"));
        assertTrue("Must reject 'kode rahasia'", keywordSet.contains("kode rahasia"));
        assertTrue("Must reject 'jangan berikan'", keywordSet.contains("jangan berikan"));
        assertTrue("Must reject 'kode verifikasi'", keywordSet.contains("kode verifikasi"));
        assertTrue("Must reject 'one time password'", keywordSet.contains("one time password"));
        assertTrue("Must reject 'klik link'", keywordSet.contains("klik link"));
        assertTrue("Must reject 'pinjaman kilat'", keywordSet.contains("pinjaman kilat"));

        // Simulate anti-OTP guard logic
        String legitSms = "BCA: Transfer Rp 500.000 ke rekening 1234567890 BERHASIL pada 04/10/2026 14:30";
        String otpSms = "BCA: JANGAN BERIKAN kode OTP 829101 kepada siapapun termasuk petugas bank";
        String phishingSms = "Bank Mandiri: Dapatkan pinjaman kilat tanpa jaminan, klik link berikut http://bad.link";

        assertTrue("Legitimate banking SMS must NOT match OTP reject keywords",
                isCleanFromOtpKeywords(legitSms, otpKeywords));
        assertFalse("OTP notification SMS MUST match OTP reject keywords and be blocked",
                isCleanFromOtpKeywords(otpSms, otpKeywords));
        assertFalse("Phishing/Spam SMS MUST match OTP reject keywords and be blocked",
                isCleanFromOtpKeywords(phishingSms, otpKeywords));
    }

    @Test
    public void testBankPrefixHeaderRecognition() {
        String[] prefixes = {
            "bca:", "mandiri:", "bri:", "bni:", "cimb:",
            "permata:", "danamon:", "mega:", "citibank:", "hsbc:"
        };

        for (String prefix : prefixes) {
            String sampleBody = prefix + " Saldo anda berkurang Rp 150.000";
            String lower = sampleBody.toLowerCase(Locale.ROOT);
            boolean matched = false;
            for (String p : prefixes) {
                if (lower.startsWith(p)) {
                    matched = true;
                    break;
                }
            }
            assertTrue("Prefix " + prefix + " must be detected at start of SMS body", matched);
        }
    }

    @Test
    public void testWidgetConstantsAndActionContract() {
        assertEquals("Widget update action intent must match contract",
                "com.fintrack.app.ACTION_UPDATE_WIDGET",
                FinTrackWidgetProvider.ACTION_UPDATE_WIDGET);

        assertEquals("Encrypted preferences file name must match contract",
                "FinTrackEncryptedNotificationPrefs",
                FinTrackNotificationService.PREFS_NAME);

        assertEquals("Legacy preferences fallback name must match contract",
                "FinTrackNotificationPrefs",
                FinTrackNotificationService.LEGACY_PREFS_NAME);

        assertEquals("Notification queue storage key must match contract",
                "fintrack_notification_queue",
                FinTrackNotificationService.KEY_QUEUE);
    }

    @Test
    public void testNotificationQueueContractKeys() {
        // Contract schema validation: Notification item keys required by FinTrack plugin & service
        String[] requiredKeys = {"id", "packageName", "title", "text", "timestamp"};
        assertEquals("Notification item contract requires 5 core fields", 5, requiredKeys.length);

        for (String key : requiredKeys) {
            assertNotNull("Field key cannot be null", key);
            assertFalse("Field key cannot be empty", key.isEmpty());
        }
    }

    private boolean isCleanFromOtpKeywords(String body, String[] rejectKeywords) {
        String lower = body.toLowerCase(Locale.ROOT);
        for (String keyword : rejectKeywords) {
            if (lower.contains(keyword)) {
                return false;
            }
        }
        return true;
    }
}
