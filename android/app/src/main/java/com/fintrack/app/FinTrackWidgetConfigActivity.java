package com.fintrack.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.SwitchCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Locale;

public class FinTrackWidgetConfigActivity extends AppCompatActivity {
    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        setContentView(R.layout.activity_widget_config);

        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            appWidgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        // Apply edge-to-edge window insets padding
        View rootView = findViewById(R.id.config_root);
        if (rootView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, insets) -> {
                Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                view.setPadding(
                    dpToPx(20) + systemBars.left,
                    dpToPx(20) + systemBars.top,
                    dpToPx(20) + systemBars.right,
                    dpToPx(20) + systemBars.bottom
                );
                return insets;
            });
        }

        // Load existing config
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String currentRange = prefs.getString("widget_config_range_" + appWidgetId, prefs.getString("widget_config_range", "month"));
        String currentWalletId = prefs.getString("widget_config_wallet_id_" + appWidgetId, prefs.getString("widget_config_wallet_id", "-1"));

        // Setup localized context
        String localeStr = prefs.getString("fintrack_widget_locale", "id");
        Locale targetLocale = "en".equalsIgnoreCase(localeStr) ? Locale.ENGLISH : new Locale("id", "ID");
        Configuration config = new Configuration(getResources().getConfiguration());
        config.setLocale(targetLocale);
        Context locCtx = createConfigurationContext(config);

        // Period selection
        if ("7d".equals(currentRange)) {
            ((RadioButton) findViewById(R.id.radio_7d)).setChecked(true);
        } else if ("30d".equals(currentRange)) {
            ((RadioButton) findViewById(R.id.radio_30d)).setChecked(true);
        } else {
            ((RadioButton) findViewById(R.id.radio_month)).setChecked(true);
        }

        // Hide balance switch
        SwitchCompat switchHideBalance = findViewById(R.id.switch_hide_balance);
        boolean currentHideBalance = false;
        if (prefs.contains("widget_config_hide_balance_" + appWidgetId)) {
            Object val = prefs.getAll().get("widget_config_hide_balance_" + appWidgetId);
            if (val instanceof Boolean) currentHideBalance = (Boolean) val;
            else if (val != null) currentHideBalance = "true".equalsIgnoreCase(String.valueOf(val).trim());
        } else if (prefs.contains("widget_config_hide_balance")) {
            Object val = prefs.getAll().get("widget_config_hide_balance");
            if (val instanceof Boolean) currentHideBalance = (Boolean) val;
            else if (val != null) currentHideBalance = "true".equalsIgnoreCase(String.valueOf(val).trim());
        }
        if (switchHideBalance != null) {
            switchHideBalance.setChecked(currentHideBalance);
        }

        View rowHideBalance = findViewById(R.id.row_hide_balance);
        if (rowHideBalance != null && switchHideBalance != null) {
            rowHideBalance.setOnClickListener(v -> switchHideBalance.toggle());
        }

        // Localize all wallet label
        RadioButton radioWalletAll = findViewById(R.id.radio_wallet_all);
        if (radioWalletAll != null) {
            radioWalletAll.setText(locCtx.getString(R.string.widget_config_wallet_all));
        }

        // Dynamically populate wallet radio buttons
        RadioGroup walletGroup = findViewById(R.id.radio_group_wallet);
        RadioGroup periodGroup = findViewById(R.id.radio_group_period);
        String walletListJson = prefs.getString("fintrack_wallet_list", "[]");
        try {
            JSONArray wallets = new JSONArray(walletListJson);
            for (int i = 0; i < wallets.length(); i++) {
                JSONObject w = wallets.getJSONObject(i);
                String wId = w.optString("id", "");
                String wName = w.optString("name", "Wallet");
                String wCurrency = w.optString("currency", "IDR");

                RadioButton rb = new RadioButton(this);
                rb.setId(View.generateViewId());
                rb.setText(wName + " \u00B7 " + wCurrency);
                rb.setTextColor(getColor(R.color.widget_text_primary));
                rb.setTextSize(15);
                rb.setPadding(dpToPx(12), 0, 0, 0);
                rb.setMinHeight(dpToPx(50));
                rb.setButtonTintList(ColorStateList.valueOf(getColor(R.color.widget_text_primary)));
                rb.setTag(wId + "|" + wName);

                walletGroup.addView(rb);
                if (wId.equals(currentWalletId)) {
                    walletGroup.check(rb.getId());
                    if (radioWalletAll != null) {
                        radioWalletAll.setChecked(false);
                    }
                }
            }
        } catch (Exception e) {
            // Ignore JSON parse errors
        }

        // Save button
        findViewById(R.id.btn_save_config).setOnClickListener(v -> {
            // Determine selected range
            String range = "month";
            int periodCheckedId = periodGroup != null ? periodGroup.getCheckedRadioButtonId() : R.id.radio_month;
            if (periodCheckedId == R.id.radio_7d) range = "7d";
            else if (periodCheckedId == R.id.radio_30d) range = "30d";

            // Determine selected wallet
            String walletId = "-1";
            String walletName = locCtx.getString(R.string.widget_config_wallet_all);
            int walletCheckedId = walletGroup != null ? walletGroup.getCheckedRadioButtonId() : R.id.radio_wallet_all;
            if (walletCheckedId != R.id.radio_wallet_all) {
                RadioButton selectedWallet = findViewById(walletCheckedId);
                if (selectedWallet != null && selectedWallet.getTag() != null) {
                    String[] parts = String.valueOf(selectedWallet.getTag()).split("\\|", 2);
                    if (parts.length >= 1) walletId = parts[0];
                    if (parts.length >= 2) walletName = parts[1];
                }
            }

            // Determine hide balance setting
            boolean hideBalance = switchHideBalance != null && switchHideBalance.isChecked();

            // Save synchronously to SharedPreferences
            prefs.edit()
                .putString("widget_config_range", range)
                .putString("widget_config_wallet_id", walletId)
                .putString("widget_config_wallet_name", walletName)
                .putBoolean("widget_config_hide_balance", hideBalance)
                .putString("widget_config_range_" + appWidgetId, range)
                .putString("widget_config_wallet_id_" + appWidgetId, walletId)
                .putString("widget_config_wallet_name_" + appWidgetId, walletName)
                .putBoolean("widget_config_hide_balance_" + appWidgetId, hideBalance)
                .commit();

            // Trigger widget update
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(FinTrackWidgetConfigActivity.this);
            FinTrackWidgetProvider.updateAppWidget(FinTrackWidgetConfigActivity.this, appWidgetManager, appWidgetId);

            Intent resultValue = new Intent();
            resultValue.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            setResult(RESULT_OK, resultValue);
            finish();
        });
    }

    private int dpToPx(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density);
    }
}
