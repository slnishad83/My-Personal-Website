package com.nishad.myteamchat;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothHeadset;
import android.bluetooth.BluetoothProfile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.app.NotificationManager;
import android.net.Uri;
import android.os.Build;
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

    private AudioManager audioManager;
    private BluetoothHeadset bluetoothHeadset;
    private boolean isBluetoothConnected = false;
    private BroadcastReceiver audioRouteReceiver;

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
        AudioManager audioManager = getAudioManager();
        if (audioManager == null) {
            call.reject("Audio routing is unavailable");
            return;
        }
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        audioManager.setSpeakerphoneOn(enabled);
        JSObject response = new JSObject();
        response.put("enabled", enabled);
        response.put("output", enabled ? "speaker" : "earpiece");
        call.resolve(response);
    }

    @PluginMethod
    public void setAudioOutput(PluginCall call) {
        String output = call.getString("output");
        if (output == null) {
            call.reject("Missing output parameter (speaker/earpiece/bluetooth)");
            return;
        }
        AudioManager am = getAudioManager();
        if (am == null) {
            call.reject("Audio routing is unavailable");
            return;
        }

        am.setMode(AudioManager.MODE_IN_COMMUNICATION);

        switch (output.toLowerCase()) {
            case "speaker":
                am.setSpeakerphoneOn(true);
                am.setBluetoothScoOn(false);
                break;
            case "earpiece":
                am.setSpeakerphoneOn(false);
                am.setBluetoothScoOn(false);
                break;
            case "bluetooth":
                am.setSpeakerphoneOn(false);
                if (am.isBluetoothScoAvailableOffCall()) {
                    am.setBluetoothScoOn(true);
                    am.startBluetoothSco();
                    am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                }
                break;
            default:
                am.setSpeakerphoneOn(true);
                break;
        }

        JSObject response = new JSObject();
        response.put("output", output);
        response.put("isBluetoothConnected", isBluetoothConnected);
        call.resolve(response);
    }

    @PluginMethod
    public void getAudioRouteInfo(PluginCall call) {
        AudioManager am = getAudioManager();
        JSObject response = new JSObject();
        if (am == null) {
            response.put("available", false);
            call.resolve(response);
            return;
        }

        android.media.AudioDeviceInfo[] devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
        boolean hasEarpiece = false;
        boolean hasSpeaker = false;
        for (android.media.AudioDeviceInfo d : devices) {
            if (d.getType() == android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) hasEarpiece = true;
            if (d.getType() == android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) hasSpeaker = true;
        }
        boolean hasBluetooth = isBluetoothConnected || am.isBluetoothScoOn();
        boolean hasWiredHeadset = am.isWiredHeadsetOn();

        String currentRoute = "earpiece";
        if (am.isSpeakerphoneOn()) {
            currentRoute = "speaker";
        } else if (hasBluetooth && am.isBluetoothScoOn()) {
            currentRoute = "bluetooth";
        } else if (hasWiredHeadset) {
            currentRoute = "wired";
        }

        response.put("available", true);
        response.put("hasEarpiece", hasEarpiece);
        response.put("hasSpeaker", hasSpeaker);
        response.put("hasBluetooth", hasBluetooth);
        response.put("hasWiredHeadset", hasWiredHeadset);
        response.put("currentRoute", currentRoute);
        response.put("isBluetoothSCOOn", am.isBluetoothScoOn());
        call.resolve(response);
    }

    @PluginMethod
    public void setupBluetoothListener(PluginCall call) {
        registerBluetoothReceiver();
        JSObject response = new JSObject();
        response.put("listening", true);
        call.resolve(response);
    }

    private void registerBluetoothReceiver() {
        if (audioRouteReceiver != null) return;

        audioRouteReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED.equals(action)) {
                    int state = intent.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, -1);
                    isBluetoothConnected = (state == AudioManager.SCO_AUDIO_STATE_CONNECTED);
                    JSObject data = new JSObject();
                    data.put("connected", isBluetoothConnected);
                    data.put("state", state);
                    notifyListeners("bluetoothStateChanged", data);
                }
            }
        };

        IntentFilter filter = new IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED);
        getContext().registerReceiver(audioRouteReceiver, filter);
    }

    @PluginMethod
    public void enterCallMode(PluginCall call) {
        AudioManager am = getAudioManager();
        if (am == null) {
            call.reject("Audio routing is unavailable");
            return;
        }

        am.setMode(AudioManager.MODE_IN_COMMUNICATION);

        boolean useSpeaker = call.getBoolean("useSpeaker", false);
        boolean useBluetooth = call.getBoolean("useBluetooth", false);

        if (useBluetooth && am.isBluetoothScoAvailableOffCall()) {
            am.setBluetoothScoOn(true);
            am.startBluetoothSco();
        } else if (useSpeaker) {
            am.setSpeakerphoneOn(true);
        }

        JSObject response = new JSObject();
        response.put("mode", "in_communication");
        response.put("speaker", useSpeaker);
        response.put("bluetooth", useBluetooth);
        call.resolve(response);
    }

    @PluginMethod
    public void exitCallMode(PluginCall call) {
        AudioManager am = getAudioManager();
        if (am != null) {
            if (am.isBluetoothScoOn()) {
                am.stopBluetoothSco();
                am.setBluetoothScoOn(false);
            }
            am.setSpeakerphoneOn(false);
            am.setMode(AudioManager.MODE_NORMAL);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearAudioMode(PluginCall call) {
        AudioManager am = getAudioManager();
        if (am != null) {
            if (am.isBluetoothScoOn()) {
                am.stopBluetoothSco();
                am.setBluetoothScoOn(false);
            }
            am.setSpeakerphoneOn(false);
            am.setMode(AudioManager.MODE_NORMAL);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearChatNotification(PluginCall call) {
        String chatId = call.getString("chatId");
        String chatType = call.getString("chatType");
        if (chatId == null || chatType == null) {
            call.reject("Chat ID and type are required");
            return;
        }
        String chatKey = chatType + "-" + chatId;
        NotificationManager manager =
            (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel("chat:" + chatKey, chatKey.hashCode() & 0x7fffffff);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearCallNotification(PluginCall call) {
        String callId = call.getString("callId");
        if (callId == null) {
            call.reject("Call ID is required");
            return;
        }
        NotificationManager manager =
            (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(callId.hashCode() & 0x7fffffff);
        call.resolve();
    }

    private AudioManager getAudioManager() {
        if (audioManager == null) {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        }
        return audioManager;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (audioRouteReceiver != null) {
            try {
                getContext().unregisterReceiver(audioRouteReceiver);
            } catch (Exception e) { /* ignore */ }
            audioRouteReceiver = null;
        }
        AudioManager am = getAudioManager();
        if (am != null && am.getMode() == AudioManager.MODE_IN_COMMUNICATION) {
            if (am.isBluetoothScoOn()) {
                am.stopBluetoothSco();
                am.setBluetoothScoOn(false);
            }
            am.setSpeakerphoneOn(false);
            am.setMode(AudioManager.MODE_NORMAL);
        }
    }
}
