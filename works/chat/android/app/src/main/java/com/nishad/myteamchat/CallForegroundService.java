package com.nishad.myteamchat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;

public class CallForegroundService extends Service {
    private static final String CHANNEL_ID = "incoming_calls_v2";
    private static final String FOREGROUND_CHANNEL_ID = "call_foreground_v1";
    private static final int FOREGROUND_NOTIFICATION_ID = 9999;
    private static final String ACTION_ACCEPT = "com.nishad.myteamchat.ACTION_ACCEPT";
    private static final String ACTION_REJECT = "com.nishad.myteamchat.ACTION_REJECT";
    private static final String ACTION_STOP = "com.nishad.myteamchat.ACTION_STOP";

    private Ringtone ringtone;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createForegroundChannel();
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "nslchat:call_wakelock"
            );
            wakeLock.acquire(60 * 60 * 1000L);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action) || ACTION_ACCEPT.equals(action) || ACTION_REJECT.equals(action)) {
            stopEffects();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String callId = intent.getStringExtra("callId");
        String type = intent.getStringExtra("type");
        String fromUserName = intent.getStringExtra("fromUserName");
        String fromUserAvatar = intent.getStringExtra("fromUserAvatar");
        int notificationId = intent.getIntExtra("notificationId", FOREGROUND_NOTIFICATION_ID);

        startForeground(FOREGROUND_NOTIFICATION_ID, buildForegroundNotification(
            callId, type, fromUserName, fromUserAvatar, notificationId
        ));

        startRingtone();

        return START_NOT_STICKY;
    }

    private Notification buildForegroundNotification(
        String callId, String type, String fromUserName, String fromUserAvatar, int notificationId
    ) {
        String callerName = fromUserName != null ? fromUserName : "My Team Chat";
        String title = "video".equals(type) ? "Incoming video call" : "Incoming voice call";

        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.putExtra("callId", callId);
        fullScreenIntent.putExtra("type", type);
        fullScreenIntent.putExtra("fromUserName", fromUserName);
        fullScreenIntent.putExtra("fromUserAvatar", fromUserAvatar);
        fullScreenIntent.putExtra("notificationId", notificationId);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this, notificationId, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent acceptIntent = new Intent(this, IncomingCallActivity.class);
        acceptIntent.putExtra("callId", callId);
        acceptIntent.putExtra("type", type);
        acceptIntent.putExtra("fromUserName", fromUserName);
        acceptIntent.putExtra("fromUserAvatar", fromUserAvatar);
        acceptIntent.putExtra("notificationId", notificationId);
        acceptIntent.putExtra("nativeAction", "accept");
        acceptIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent acceptPending = PendingIntent.getActivity(
            this, notificationId + 1, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent rejectIntent = new Intent(this, IncomingCallActivity.class);
        rejectIntent.putExtra("callId", callId);
        rejectIntent.putExtra("type", type);
        rejectIntent.putExtra("fromUserName", fromUserName);
        rejectIntent.putExtra("fromUserAvatar", fromUserAvatar);
        rejectIntent.putExtra("notificationId", notificationId);
        rejectIntent.putExtra("nativeAction", "reject");
        rejectIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent rejectPending = PendingIntent.getActivity(
            this, notificationId + 2, rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(callerName + " is calling")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSound(Settings.System.DEFAULT_RINGTONE_URI)
            .setVibrate(new long[]{0, 900, 600, 900, 600})
            .addAction(0, "Decline", rejectPending)
            .addAction(0, "Accept", acceptPending)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .build();
    }

    private void startRingtone() {
        try {
            Uri ringtoneUri = Settings.System.DEFAULT_RINGTONE_URI;
            ringtone = RingtoneManager.getRingtone(getApplicationContext(), ringtoneUri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    ringtone.setAudioAttributes(attrs);
                }
                ringtone.play();
            }
        } catch (Exception ignored) {}
    }

    private void stopEffects() {
        if (ringtone != null) {
            try { ringtone.stop(); } catch (Exception ignored) {}
            ringtone = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.setMode(AudioManager.MODE_NORMAL);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopEffects();
        super.onDestroy();
    }

    private void createForegroundChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                FOREGROUND_CHANNEL_ID,
                "Active Call",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shown during an active call");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    public static void stopService(android.content.Context context) {
        Intent intent = new Intent(context, CallForegroundService.class);
        intent.setAction(ACTION_STOP);
        context.startForegroundService(intent);
    }
}
