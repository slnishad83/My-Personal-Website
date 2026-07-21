package com.nishad.myteamchat;

import android.Manifest;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "Biometric",
    permissions = {
        @Permission(strings = {Manifest.permission.USE_BIOMETRIC}, alias = "biometric")
    }
)
public class BiometricPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BiometricManager biometricManager = BiometricManager.from(getContext());
        int result = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);

        JSObject response = new JSObject();
        response.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        response.put("statusCode", result);

        String reason;
        switch (result) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                reason = "available";
                break;
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                reason = "no_hardware";
                break;
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                reason = "hardware_unavailable";
                break;
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                reason = "none_enrolled";
                break;
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                reason = "security_update_required";
                break;
            case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED:
                reason = "unsupported";
                break;
            default:
                reason = "unknown";
                break;
        }
        response.put("reason", reason);
        call.resolve(response);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Authenticate");
        String subtitle = call.getString("subtitle", "Verify your identity");
        String description = call.getString("description", "");
        String cancelText = call.getString("cancelText", "Cancel");

        if (getActivity() == null || !(getActivity() instanceof FragmentActivity)) {
            call.reject("Activity unavailable");
            return;
        }

        FragmentActivity activity = (FragmentActivity) getActivity();
        java.util.concurrent.Executor executor = ContextCompat.getMainExecutor(getContext());

        BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                JSObject response = new JSObject();
                response.put("authenticated", true);
                call.resolve(response);
            }

            @Override
            public void onAuthenticationError(int errorCode, CharSequence errString) {
                if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                    errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                    errorCode == BiometricPrompt.ERROR_CANCELED) {
                    call.reject("cancelled", String.valueOf(errorCode));
                } else {
                    call.reject(errString.toString(), String.valueOf(errorCode));
                }
            }

            @Override
            public void onAuthenticationFailed() {
                call.reject("Authentication failed", "auth_failed");
            }
        };

        BiometricPrompt prompt = new BiometricPrompt(activity, executor, callback);

        BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setDescription(description)
            .setNegativeButtonText(cancelText)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);

        prompt.authenticate(builder.build());
    }

    @PluginMethod
    public void isDeviceSecure(PluginCall call) {
        KeyguardManager keyguardManager = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        JSObject response = new JSObject();
        response.put("secure", keyguardManager != null && keyguardManager.isDeviceSecure());
        call.resolve(response);
    }
}
