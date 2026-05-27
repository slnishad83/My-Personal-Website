package com.nishad.myteamchat;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;
import android.view.Gravity;

public class IncomingCallActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        String caller = getIntent().getStringExtra("fromUserName");
        String type = getIntent().getStringExtra("type");
        String title = "Incoming " + ("video".equals(type) ? "Video" : "Voice") + " Call";

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(48, 48, 48, 48);
        layout.setBackgroundColor(Color.rgb(15, 23, 42));

        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(26);
        titleView.setGravity(Gravity.CENTER);

        TextView callerView = new TextView(this);
        callerView.setText(caller != null ? caller : "NSL Chat");
        callerView.setTextColor(Color.LTGRAY);
        callerView.setTextSize(20);
        callerView.setGravity(Gravity.CENTER);
        callerView.setPadding(0, 24, 0, 48);

        Button acceptBtn = new Button(this);
        acceptBtn.setText("Accept");
        acceptBtn.setTextSize(18);

        Button rejectBtn = new Button(this);
        rejectBtn.setText("Reject");
        rejectBtn.setTextSize(18);

        acceptBtn.setOnClickListener(v -> {
            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("openCall", "true");
            intent.putExtra("callId", getIntent().getStringExtra("callId"));
            startActivity(intent);
            finish();
        });

        rejectBtn.setOnClickListener(v -> finish());

        layout.addView(titleView);
        layout.addView(callerView);
        layout.addView(acceptBtn);
        layout.addView(rejectBtn);

        setContentView(layout);
    }
}