package com.nishad.myteamchat;

import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        normalizeNotificationIntent(getIntent());
        registerPlugin(AppPermissionsPlugin.class);
        super.onCreate(savedInstanceState);

        // Edge-to-edge: let the web content draw behind both the status bar
        // and the navigation bar so that CSS env(safe-area-inset-*) values
        // are correctly set and our CSS can pad accordingly.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Keep the window flags from the theme but make both bars transparent.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        normalizeNotificationIntent(intent);
        super.onNewIntent(intent);
    }

    private void normalizeNotificationIntent(Intent intent) {
        if (intent == null || intent.getData() != null) return;
        String chatUserId = intent.getStringExtra("chatUserId");
        if (chatUserId != null && !chatUserId.isEmpty()) {
            intent.setData(Uri.parse("myteamchat://open?chatUserId=" + Uri.encode(chatUserId)));
        }
    }
}
