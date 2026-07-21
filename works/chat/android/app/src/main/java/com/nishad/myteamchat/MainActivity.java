package com.nishad.myteamchat;

import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.content.Intent;
import android.net.Uri;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        normalizeNotificationIntent(getIntent());
        registerPlugin(AppPermissionsPlugin.class);
        registerPlugin(BiometricPlugin.class);
        registerPlugin(ScreenshotProtectionPlugin.class);
        registerPlugin(InAppUpdatePlugin.class);
        registerPlugin(AppShortcutsPlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);

        // Make WebView background match app theme to prevent white flash
        getWindow().getDecorView().setBackgroundColor(0xFF11131C);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        normalizeNotificationIntent(intent);
        super.onNewIntent(intent);
    }

    /**
     * Provides haptic feedback to the web layer when called via
     * JavaScript: Capacitor.Plugins.Haptic.performHapticFeedback()
     */
    public void performHapticFeedback(int type) {
        View rootView = getBridge().getWebView();
        if (rootView == null) return;

        switch (type) {
            case 0: // LIGHT
                rootView.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                break;
            case 1: // MEDIUM
                rootView.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
                break;
            case 2: // HEAVY
                Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (vibrator != null && vibrator.hasVibrator()) {
                    vibrator.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE));
                }
                break;
            default:
                rootView.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                break;
        }
    }

    private void normalizeNotificationIntent(Intent intent) {
        if (intent == null || intent.getData() != null) return;
        String chatUserId = intent.getStringExtra("chatUserId");
        String groupId = intent.getStringExtra("groupId");
        String tab = intent.getStringExtra("tab");
        String messageId = intent.getStringExtra("messageId");
        boolean hasMsgId = messageId != null && !messageId.isEmpty();
        if (chatUserId != null && !chatUserId.isEmpty()) {
            Uri.Builder ub = Uri.parse("myteamchat://open").buildUpon()
                .appendQueryParameter("chatUserId", chatUserId);
            if (hasMsgId) ub.appendQueryParameter("messageId", messageId);
            intent.setData(ub.build());
        } else if (groupId != null && !groupId.isEmpty()) {
            Uri.Builder ub = Uri.parse("myteamchat://open").buildUpon()
                .appendQueryParameter("groupId", groupId);
            if (hasMsgId) ub.appendQueryParameter("messageId", messageId);
            intent.setData(ub.build());
        } else if (tab != null && !tab.isEmpty()) {
            intent.setData(Uri.parse("myteamchat://open?tab=" + Uri.encode(tab)));
        }
    }
}
