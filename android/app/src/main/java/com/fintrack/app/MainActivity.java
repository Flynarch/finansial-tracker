package com.fintrack.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                // Force GPU Hardware layer for 60fps smooth rendering
                webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
                WebSettings settings = webView.getSettings();
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setEnableSmoothTransition(true);
                settings.setDomStorageEnabled(true);
            }
        } catch (Exception ignored) {}
    }
}
