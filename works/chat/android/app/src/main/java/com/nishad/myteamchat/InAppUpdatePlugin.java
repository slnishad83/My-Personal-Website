package com.nishad.myteamchat;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.play.core.common.IntentSenderForResultStarter;

@CapacitorPlugin(name = "InAppUpdate")
public class InAppUpdatePlugin extends Plugin {

    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateListener;

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        appUpdateManager = AppUpdateManagerFactory.create(activity);

        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
            JSObject response = new JSObject();

            boolean updateAvailable = appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE;
            boolean immediateAllowed = appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE);
            boolean flexibleAllowed = appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);

            response.put("updateAvailable", updateAvailable);
            response.put("immediateAllowed", immediateAllowed);
            response.put("flexibleAllowed", flexibleAllowed);
            response.put("availableVersionCode", appUpdateInfo.availableVersionCode());
            response.put("stalenessDays", appUpdateInfo.clientVersionStalenessDays());
            response.put("installStatus", appUpdateInfo.installStatus());

            call.resolve(response);
        }).addOnFailureListener(e -> {
            call.reject("Failed to check for update: " + e.getMessage());
        });
    }

    @PluginMethod
    public void startFlexibleUpdate(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        appUpdateManager = AppUpdateManagerFactory.create(activity);

        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {

                installStateListener = installState -> {
                    if (installState.installStatus() == InstallStatus.DOWNLOADED) {
                        JSObject response = new JSObject();
                        response.put("status", "downloaded");
                        call.resolve(response);
                        notifyListeners("updateDownloaded", response);
                    } else if (installState.installStatus() == InstallStatus.FAILED) {
                        call.reject("Update download failed");
                    }
                };

                appUpdateManager.registerListener(installStateListener);
                try {
                    appUpdateManager.startUpdateFlowForResult(
                        appUpdateInfo, AppUpdateType.FLEXIBLE, activity, 0);
                } catch (Exception e) {
                    call.reject("Failed to start update flow: " + e.getMessage());
                    return;
                }
            } else {
                call.reject("No update available or not allowed");
            }
        }).addOnFailureListener(e -> {
            call.reject("Failed to start update: " + e.getMessage());
        });
    }

    @PluginMethod
    public void startImmediateUpdate(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        appUpdateManager = AppUpdateManagerFactory.create(activity);

        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {

                try {
                    appUpdateManager.startUpdateFlowForResult(
                        appUpdateInfo, AppUpdateType.IMMEDIATE, activity, 0);
                } catch (Exception e) {
                    call.reject("Failed to start update flow: " + e.getMessage());
                    return;
                }

                JSObject response = new JSObject();
                response.put("status", "started");
                call.resolve(response);
            } else {
                call.reject("No update available or not allowed");
            }
        }).addOnFailureListener(e -> {
            call.reject("Failed to start update: " + e.getMessage());
        });
    }

    @PluginMethod
    public void completeUpdate(PluginCall call) {
        if (appUpdateManager != null) {
            appUpdateManager.completeUpdate();
            JSObject response = new JSObject();
            response.put("status", "completed");
            call.resolve(response);
        } else {
            call.reject("No update in progress");
        }
    }

    @PluginMethod
    public void isUpdateDownloaded(PluginCall call) {
        if (appUpdateManager == null) {
            call.reject("No update manager initialized");
            return;
        }

        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
            JSObject response = new JSObject();
            response.put("downloaded", appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED);
            call.resolve(response);
        }).addOnFailureListener(e -> {
            call.reject("Failed to check status: " + e.getMessage());
        });
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (appUpdateManager != null && installStateListener != null) {
            appUpdateManager.unregisterListener(installStateListener);
        }
    }
}
