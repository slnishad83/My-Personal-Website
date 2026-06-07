package com.nishad.myteamchat;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.net.Uri;

public class IncomingCallActivity extends Activity {
    private MediaPlayer ringtonePlayer;
    private Vibrator vibrator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        String caller = getIntent().getStringExtra("fromUserName");
        String type = getIntent().getStringExtra("type");
        String callId = getIntent().getStringExtra("callId");
        int notificationId = getIntent().getIntExtra("notificationId", 5001);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(60, 140, 60, 120);
        layout.setBackgroundColor(Color.parseColor("#081120"));

        TextView titleView = new TextView(this);
        titleView.setText("video".equals(type) ? "Incoming Video Call" : "Incoming Voice Call");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(28);
        titleView.setGravity(Gravity.CENTER);

        TextView callerView = new TextView(this);
        callerView.setText(caller != null ? caller : "My Team Chat");
        callerView.setTextColor(Color.parseColor("#B8C7D9"));
        callerView.setTextSize(22);
        callerView.setGravity(Gravity.CENTER);
        callerView.setPadding(0, 30, 0, 70);

        Button acceptBtn = new Button(this);
        acceptBtn.setText("ACCEPT");
        acceptBtn.setTextSize(18);
        acceptBtn.setTextColor(Color.WHITE);
        acceptBtn.setBackgroundColor(Color.parseColor("#16A34A"));

        Button rejectBtn = new Button(this);
        rejectBtn.setText("REJECT");
        rejectBtn.setTextSize(18);
        rejectBtn.setTextColor(Color.WHITE);
        rejectBtn.setBackgroundColor(Color.parseColor("#DC2626"));

        acceptBtn.setOnClickListener(v -> openCallInApp(callId, "accept", notificationId));

        rejectBtn.setOnClickListener(v -> openCallInApp(callId, "reject", notificationId));

        layout.addView(titleView);
        layout.addView(callerView);
        layout.addView(acceptBtn);
        layout.addView(rejectBtn);
        setContentView(layout);

        startRespectfulRingOrVibrate();
    }

    private void openCallInApp(String callId, String action, int notificationId) {
        stopEffects();
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(notificationId);

        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (intent == null) {
            finish();
            return;
        }
        intent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        intent.setData(new Uri.Builder()
            .scheme("myteamchat")
            .authority("open")
            .appendQueryParameter("callId", callId != null ? callId : "")
            .appendQueryParameter("action", action)
            .build());
        startActivity(intent);
        finish();
    }

    private void startRespectfulRingOrVibrate() {
        AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        int mode = audioManager != null ? audioManager.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;

        if (mode == AudioManager.RINGER_MODE_SILENT) return;

        if (mode == AudioManager.RINGER_MODE_NORMAL) {
            try {
                ringtonePlayer = MediaPlayer.create(this, Settings.System.DEFAULT_RINGTONE_URI);
                if (ringtonePlayer != null) {
                    ringtonePlayer.setLooping(true);
                    ringtonePlayer.start();
                }
            } catch (Exception ignored) {}
        }

        if (mode == AudioManager.RINGER_MODE_VIBRATE || mode == AudioManager.RINGER_MODE_NORMAL) {
            try {
                vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (vibrator != null) {
                    long[] pattern = new long[]{0, 900, 600, 900, 600};
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                    } else {
                        vibrator.vibrate(pattern, 0);
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    private void stopEffects() {
        try {
            if (ringtonePlayer != null) {
                ringtonePlayer.stop();
                ringtonePlayer.release();
                ringtonePlayer = null;
            }
        } catch (Exception ignored) {}

        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        stopEffects();
        super.onDestroy();
    }
}
