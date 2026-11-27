package com.sumanova.app;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * App lock: asks Android to confirm the owner's fingerprint / face (or device screen lock).
 * Nothing is stored or sent — JS only learns whether the check passed.
 */
@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {
    private static final int AUTH = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void available(PluginCall call) {
        int r = BiometricManager.from(getContext()).canAuthenticate(AUTH);
        JSObject ret = new JSObject();
        ret.put("available", r == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(ret);
    }

    @PluginMethod
    public void verify(PluginCall call) {
        final String title = call.getString("title", "Unlock");
        final String subtitle = call.getString("subtitle", null);
        final FragmentActivity activity = (FragmentActivity) getActivity();
        activity.runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    call.resolve(ret);
                }

                @Override
                public void onAuthenticationError(int code, @NonNull CharSequence msg) {
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    ret.put("error", msg.toString());
                    call.resolve(ret);
                }
                // onAuthenticationFailed: a single wrong finger — the system prompt stays open.
            });
            BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setNegativeButtonText("Use PIN")
                .setAllowedAuthenticators(AUTH);
            if (subtitle != null) info.setSubtitle(subtitle);
            prompt.authenticate(info.build());
        });
    }
}
