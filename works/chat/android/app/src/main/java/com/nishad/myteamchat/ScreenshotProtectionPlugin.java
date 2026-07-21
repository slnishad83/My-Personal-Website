package com.nishad.myteamchat;

import android.app.Activity;
import android.os.Build;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenshotProtection")
public class ScreenshotProtectionPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        activity.runOnUiThread(() -> {
            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            JSObject response = new JSObject();
            response.put("enabled", true);
            call.resolve(response);
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        activity.runOnUiThread(() -> {
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            JSObject response = new JSObject();
            response.put("enabled", false);
            call.resolve(response);
        });
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        int flags = activity.getWindow().getAttributes().flags;
        boolean enabled = (flags & WindowManager.LayoutParams.FLAG_SECURE) != 0;
        JSObject response = new JSObject();
        response.put("enabled", enabled);
        call.resolve(response);
    }
}
