package com.rotakars.yonetim;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RotaAppPlugin.class);
        super.onCreate(savedInstanceState);
        // Telefon karanlık moddayken WebView panel ve siteyi zorla koyulaştırmasın;
        // tasarım kendi renkleriyle görünür.
        WebSettings settings = getBridge().getWebView().getSettings();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false);
        }
    }
}
