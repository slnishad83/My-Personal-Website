package com.nishad.myteamchat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "incoming_calls";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        String kind = message.getData().get("kind");
        if (!"call".equals(kind)) return;

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

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("video".equals(type) ? "Incoming video call" : "Incoming voice call")
            .setContentText((fromUserName != null ? fromUserName : "My Team Chat") + " is calling")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent);

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(notificationId, builder.build());
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

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
}
