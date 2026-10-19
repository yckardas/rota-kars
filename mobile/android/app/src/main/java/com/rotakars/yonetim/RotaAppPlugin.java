package com.rotakars.yonetim;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Uygulamaya özel küçük köprü. Firebase yapılandırması (google-services.json)
 * pakete girmemişse bildirim kaydı uygulamayı çökertir; web tarafı önce buna sorar.
 */
@CapacitorPlugin(name = "RotaApp")
public class RotaAppPlugin extends Plugin {
    @PluginMethod
    public void pushReady(PluginCall call) {
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("ready", id != 0);
        call.resolve(result);
    }
}
