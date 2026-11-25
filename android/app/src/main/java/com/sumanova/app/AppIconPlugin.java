package com.sumanova.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Switchable launcher icon. Each choice is an <activity-alias> of MainActivity in the
 * manifest; we enable the chosen one and disable the rest (the app keeps running).
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    private static final String[] ICONS = { "Pink", "Ink", "Blue", "Green", "Violet", "Orange" };

    private ComponentName alias(Context ctx, String name) {
        return new ComponentName(ctx.getPackageName(), "com.sumanova.app.Icon" + name);
    }

    @PluginMethod
    public void get(PluginCall call) {
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        String current = "Pink";
        for (String n : ICONS) {
            int st = pm.getComponentEnabledSetting(alias(ctx, n));
            boolean on = st == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                || (st == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && n.equals("Pink"));
            if (on) { current = n; break; }
        }
        JSObject ret = new JSObject();
        ret.put("icon", current);
        call.resolve(ret);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("icon", "Pink");
        boolean known = false;
        for (String n : ICONS) if (n.equals(name)) known = true;
        if (!known) {
            call.reject("Unknown icon");
            return;
        }
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        // Enable the new one first so there is never a moment with no launcher entry.
        pm.setComponentEnabledSetting(alias(ctx, name), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String n : ICONS) {
            if (n.equals(name)) continue;
            pm.setComponentEnabledSetting(alias(ctx, n), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }
        call.resolve();
    }
}
