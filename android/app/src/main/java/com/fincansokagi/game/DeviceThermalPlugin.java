package com.fincansokagi.game;

import android.annotation.TargetApi;
import android.content.Context;
import android.os.Build;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Reads the OS thermal severity, not an estimated temperature. No permission or polling. */
@CapacitorPlugin(name = "DeviceThermal")
public class DeviceThermalPlugin extends Plugin {
    private ThermalMonitor monitor;

    @Override public void load() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            PowerManager manager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (manager != null) monitor = new Api29(manager);
            startMonitoring();
        }
    }

    @PluginMethod public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    private JSObject status() {
        JSObject value = new JSObject();
        value.put("supported", monitor != null);
        try { value.put("status", monitor == null ? 0 : monitor.status()); }
        catch (RuntimeException unavailable) { value.put("supported", false); value.put("status", 0); }
        return value;
    }

    private void startMonitoring() {
        if (monitor == null) return;
        try {
            monitor.start();
            notifyListeners("thermalStatus", status(), true);
        } catch (RuntimeException unavailable) { stopMonitoring(); monitor = null; }
    }

    private void stopMonitoring() {
        if (monitor != null) monitor.stop();
    }

    @Override protected void handleOnResume() { startMonitoring(); }
    @Override protected void handleOnPause() { stopMonitoring(); }
    @Override protected void handleOnDestroy() { stopMonitoring(); monitor = null; }

    private interface ThermalMonitor {
        int status();
        void start();
        void stop();
    }

    // Keep every Q-only type AND invocation out of the outer plugin's bytecode.
    @TargetApi(Build.VERSION_CODES.Q)
    private final class Api29 implements ThermalMonitor {
        final PowerManager manager;
        boolean started;
        final PowerManager.OnThermalStatusChangedListener listener = severity -> {
            JSObject value = new JSObject();
            value.put("supported", true); value.put("status", severity);
            notifyListeners("thermalStatus", value, true);
        };
        Api29(PowerManager manager) { this.manager = manager; }
        @Override public int status() { return manager.getCurrentThermalStatus(); }
        @Override public void start() {
            if (started) return;
            manager.addThermalStatusListener(getActivity().getMainExecutor(), listener);
            started = true;
        }
        @Override public void stop() {
            if (!started) return;
            try { manager.removeThermalStatusListener(listener); }
            catch (RuntimeException ignored) { }
            started = false;
        }
    }
}
