package com.nishad.myteamchat;

import android.app.NotificationChannel;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.media.AudioAttributes;
import android.provider.Settings;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "incoming_calls_v2";
    private static final String MESSAGE_CHANNEL_ID = "chat_messages_v1";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        String kind = message.getData().get("kind");
        if (!"call".equals(kind)) {
            showMessageNotification(message);
            return;
        }

        String callId = message.getData().get("callId");
        String type = message.getData().get("type");
        String fromUserName = message.getData().get("fromUserName");

        showIncomingCall(callId, type, fromUserName);
    }

    private void showIncomingCall(String callId, String type, String fromUserName) {
        createChannel();
        int notificationId = callId != null ? (callId.hashCode() & 0x7fffffff) : 5001;

        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.putExtra("callId", callId);
        fullScreenIntent.putExtra("type", type);
        fullScreenIntent.putExtra("fromUserName", fromUserName);
        fullScreenIntent.putExtra("notificationId", notificationId);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent acceptIntent = createCallActionIntent(
            callId, type, fromUserName, notificationId, "accept", notificationId + 1
        );
        PendingIntent rejectIntent = createCallActionIntent(
            callId, type, fromUserName, notificationId, "reject", notificationId + 2
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("video".equals(type) ? "Incoming video call" : "Incoming voice call")
            .setContentText((fromUserName != null ? fromUserName : "My Team Chat") + " is calling")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSound(Settings.System.DEFAULT_RINGTONE_URI)
            .setVibrate(new long[]{0, 900, 600, 900, 600})
            .addAction(0, "Decline", rejectIntent)
            .addAction(0, "Accept", acceptIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent);

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(notificationId, builder.build());
    }

    private PendingIntent createCallActionIntent(
        String callId,
        String type,
        String fromUserName,
        int notificationId,
        String action,
        int requestCode
    ) {
        Intent intent = new Intent(this, IncomingCallActivity.class);
        intent.putExtra("callId", callId);
        intent.putExtra("type", type);
        intent.putExtra("fromUserName", fromUserName);
        intent.putExtra("notificationId", notificationId);
        intent.putExtra("nativeAction", action);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void showMessageNotification(RemoteMessage message) {
        createMessageChannel();
        String title = message.getNotification() != null
            ? message.getNotification().getTitle()
            : message.getData().get("fromUserName");
        String body = message.getNotification() != null
            ? message.getNotification().getBody()
            : message.getData().get("body");
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) return;
        String chatUserId = message.getData().get("chatUserId");
        if (chatUserId != null && !chatUserId.isEmpty()) {
            launchIntent.setData(
                Uri.parse("myteamchat://open?chatUserId=" + Uri.encode(chatUserId))
            );
        }
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, (int) System.currentTimeMillis(), launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, MESSAGE_CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title != null ? title : "My Team Chat")
            .setContentText(body != null ? body : "New message")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setDefaults(Notification.DEFAULT_ALL)
            .setContentIntent(pendingIntent);
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Incoming My Team Chat voice and video calls");
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            channel.setSound(
                Settings.System.DEFAULT_RINGTONE_URI,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build()
            );
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 900, 600, 900, 600});

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private void createMessageChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                MESSAGE_CHANNEL_ID,
                "Chat Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("New My Team Chat messages");
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            channel.setSound(
                Settings.System.DEFAULT_NOTIFICATION_URI,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build()
            );
            channel.enableVibration(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
}
