package com.sumanova.app;

import android.app.Activity;
import android.os.Build;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Screen privacy for snaps.
 * - setSecure(true) adds FLAG_SECURE: Android blocks screenshots and screen
 *   recording of the app while it's set.
 * - On Android 14+ (API 34) a ScreenCaptureCallback reports screenshot
 *   attempts to JS as a "screenshot" event.
 */
@CapacitorPlugin(name = "Privacy")
public class PrivacyPlugin extends Plugin {
    private Object captureCallback; // Activity.ScreenCaptureCallback on API 34+

    @PluginMethod
    public void setSecure(PluginCall call) {
        final boolean secure = Boolean.TRUE.equals(call.getBoolean("secure", false));
        final Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (secure) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                registerCaptureCallback(activity);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                unregisterCaptureCallback(activity);
            }
            call.resolve();
        });
    }

    private void registerCaptureCallback(Activity activity) {
        if (Build.VERSION.SDK_INT < 34 || captureCallback != null) return;
        Activity.ScreenCaptureCallback cb = () -> notifyListeners("screenshot", null);
        activity.registerScreenCaptureCallback(activity.getMainExecutor(), cb);
        captureCallback = cb;
    }

    private void unregisterCaptureCallback(Activity activity) {
        if (Build.VERSION.SDK_INT < 34 || captureCallback == null) return;
        activity.unregisterScreenCaptureCallback((Activity.ScreenCaptureCallback) captureCallback);
        captureCallback = null;
    }

    @Override
    protected void handleOnDestroy() {
        unregisterCaptureCallback(getActivity());
        super.handleOnDestroy();
    }
}
