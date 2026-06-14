package com.nishad.myteamchat;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

@CapacitorPlugin(
    name = "AppPermissions",
    permissions = {
        @Permission(strings = {Manifest.permission.CAMERA}, alias = "camera"),
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "microphone"),
        @Permission(strings = {Manifest.permission.READ_CONTACTS}, alias = "contacts"),
        @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications"),
        @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, alias = "location"),
        @Permission(strings = {
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_AUDIO
        }, alias = "media")
    }
)
public class AppPermissionsPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        String alias = call.getString("alias");
        if (alias == null) {
            call.reject("Alias is required");
            return;
        }
        PermissionState state = getPermissionState(alias);
        JSObject response = new JSObject();
        response.put("status", state != null ? state.toString() : "UNKNOWN");
        call.resolve(response);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String alias = call.getString("alias");
        if (alias == null) {
            call.reject("Alias is required");
            return;
        }
        PermissionState state = getPermissionState(alias);
        if (state == PermissionState.GRANTED) {
            JSObject response = new JSObject();
            response.put("status", "granted");
            call.resolve(response);
        } else {
            requestPermissionForAlias(alias, call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        String alias = call.getString("alias");
        PermissionState state = getPermissionState(alias);
        JSObject response = new JSObject();
        response.put("status", state != null ? state.toString() : "denied");
        call.resolve(response);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setSpeakerphone(PluginCall call) {
        Boolean enabledValue = call.getBoolean("enabled");
        boolean enabled = enabledValue != null && enabledValue;
        AudioManager audioManager =
            (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            call.reject("Audio routing is unavailable");
            return;
        }
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        audioManager.setSpeakerphoneOn(enabled);
        JSObject response = new JSObject();
        response.put("enabled", enabled);
        call.resolve(response);
    }
}
