package com.rotakars.yonetim;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RotaAppPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
