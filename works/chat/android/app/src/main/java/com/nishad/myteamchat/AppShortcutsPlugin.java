package com.nishad.myteamchat;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "AppShortcuts")
public class AppShortcutsPlugin extends Plugin {

    @PluginMethod
    public void setShortcuts(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
            call.reject("App shortcuts require Android 7.1+ (API 25)");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        ShortcutManager manager = activity.getSystemService(ShortcutManager.class);
        if (manager == null) {
            call.reject("ShortcutManager unavailable");
            return;
        }

        List<ShortcutInfo> shortcuts = new ArrayList<>();

        // Default shortcuts
        ShortcutInfo chatShortcut = new ShortcutInfo.Builder(getContext(), "new_chat")
            .setShortLabel("New Chat")
            .setLongLabel("Start New Chat")
            .setIcon(Icon.createWithResource(getContext(), R.drawable.ic_shortcut_chat))
            .setIntent(new Intent(Intent.ACTION_VIEW, Uri.parse("myteamchat://open?tab=chats&action=new")))
            .setRank(0)
            .build();
        shortcuts.add(chatShortcut);

        ShortcutInfo groupShortcut = new ShortcutInfo.Builder(getContext(), "new_group")
            .setShortLabel("New Group")
            .setLongLabel("Create New Group")
            .setIcon(Icon.createWithResource(getContext(), R.drawable.ic_shortcut_group))
            .setIntent(new Intent(Intent.ACTION_VIEW, Uri.parse("myteamchat://open?tab=groups&action=new")))
            .setRank(1)
            .build();
        shortcuts.add(groupShortcut);

        manager.setDynamicShortcuts(shortcuts);

        JSObject response = new JSObject();
        response.put("count", shortcuts.size());
        call.resolve(response);
    }

    @PluginMethod
    public void addDynamicShortcut(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
            call.reject("App shortcuts require Android 7.1+ (API 25)");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        ShortcutManager manager = activity.getSystemService(ShortcutManager.class);
        if (manager == null) {
            call.reject("ShortcutManager unavailable");
            return;
        }

        String id = call.getString("id");
        String shortLabel = call.getString("shortLabel");
        String longLabel = call.getString("longLabel", shortLabel);
        String url = call.getString("url");

        if (id == null || shortLabel == null || url == null) {
            call.reject("id, shortLabel, and url are required");
            return;
        }

        ShortcutInfo shortcut = new ShortcutInfo.Builder(getContext(), id)
            .setShortLabel(shortLabel)
            .setLongLabel(longLabel)
            .setIcon(Icon.createWithResource(getContext(), R.drawable.ic_shortcut_chat))
            .setIntent(new Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            .setRank(2)
            .build();

        List<ShortcutInfo> current = manager.getDynamicShortcuts();
        current.add(shortcut);

        // Max 15 dynamic shortcuts
        if (current.size() > 15) {
            List<ShortcutInfo> trimmed = current.subList(current.size() - 15, current.size());
            manager.setDynamicShortcuts(trimmed);
        } else {
            manager.setDynamicShortcuts(current);
        }

        JSObject response = new JSObject();
        response.put("success", true);
        response.put("count", current.size());
        call.resolve(response);
    }

    @PluginMethod
    public void removeAllDynamicShortcuts(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
            call.reject("App shortcuts require Android 7.1+ (API 25)");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        ShortcutManager manager = activity.getSystemService(ShortcutManager.class);
        if (manager == null) {
            call.reject("ShortcutManager unavailable");
            return;
        }

        manager.removeAllDynamicShortcuts();

        JSObject response = new JSObject();
        response.put("success", true);
        call.resolve(response);
    }

    @PluginMethod
    public void getShortcutCount(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
            call.reject("App shortcuts require Android 7.1+ (API 25)");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        ShortcutManager manager = activity.getSystemService(ShortcutManager.class);
        if (manager == null) {
            call.reject("ShortcutManager unavailable");
            return;
        }

        JSObject response = new JSObject();
        response.put("dynamicCount", manager.getDynamicShortcuts().size());
        response.put("pinnedCount", manager.getPinnedShortcuts().size());
        response.put("maxCount", manager.getMaxShortcutCountPerActivity());
        call.resolve(response);
    }
}
