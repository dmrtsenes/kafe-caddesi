package com.fincansokagi.game;

import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.analytics.FirebaseAnalytics.ConsentStatus;
import com.google.firebase.analytics.FirebaseAnalytics.ConsentType;
import java.util.EnumMap;
import java.util.Iterator;
import java.util.Map;

/** Native Firebase Analytics bridge for consent, structured game events, and user properties. */
@CapacitorPlugin(name = "FirebaseAnalyticsBridge")
public class FirebaseAnalyticsPlugin extends Plugin {
    private FirebaseAnalytics firebaseAnalytics;

    @Override
    public void load() {
        try {
            firebaseAnalytics = FirebaseAnalytics.getInstance(getContext());
        } catch (RuntimeException ignored) {
            firebaseAnalytics = null;
        }
    }

    @PluginMethod
    public void setConsent(PluginCall call) {
        if (firebaseAnalytics == null) {
            call.resolve();
            return;
        }
        try {
            boolean analyticsStorage = Boolean.TRUE.equals(call.getBoolean("analyticsStorage", false));
            boolean adStorage = Boolean.TRUE.equals(call.getBoolean("adStorage", false));
            boolean adUserData = Boolean.TRUE.equals(call.getBoolean("adUserData", false));
            boolean adPersonalization = Boolean.TRUE.equals(call.getBoolean("adPersonalization", false));
            boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));

            Map<ConsentType, ConsentStatus> consentMap = new EnumMap<>(ConsentType.class);
            consentMap.put(ConsentType.ANALYTICS_STORAGE, analyticsStorage ? ConsentStatus.GRANTED : ConsentStatus.DENIED);
            consentMap.put(ConsentType.AD_STORAGE, adStorage ? ConsentStatus.GRANTED : ConsentStatus.DENIED);
            consentMap.put(ConsentType.AD_USER_DATA, adUserData ? ConsentStatus.GRANTED : ConsentStatus.DENIED);
            consentMap.put(ConsentType.AD_PERSONALIZATION, adPersonalization ? ConsentStatus.GRANTED : ConsentStatus.DENIED);

            firebaseAnalytics.setConsent(consentMap);
            firebaseAnalytics.setAnalyticsCollectionEnabled(enabled);
        } catch (RuntimeException ignored) {
            // Analytics failure must never affect gameplay.
        }
        call.resolve();
    }

    @PluginMethod
    public void logEvent(PluginCall call) {
        if (firebaseAnalytics == null) {
            call.resolve();
            return;
        }
        String name = call.getString("name");
        if (name == null || name.isEmpty()) {
            call.resolve();
            return;
        }
        try {
            Bundle bundle = new Bundle();
            JSObject params = call.getObject("params");
            if (params != null) {
                Iterator<String> keys = params.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object val = params.opt(key);
                    if (val == null || val == org.json.JSONObject.NULL) continue;
                    if (val instanceof Boolean) {
                        bundle.putLong(key, ((Boolean) val) ? 1L : 0L);
                    } else if (val instanceof Number) {
                        Number num = (Number) val;
                        double d = num.doubleValue();
                        if (!Double.isFinite(d)) continue;
                        if ("value".equals(key) || (val instanceof Double) || (val instanceof Float) || Math.floor(d) != d) {
                            bundle.putDouble(key, d);
                        } else {
                            bundle.putLong(key, num.longValue());
                        }
                    } else {
                        String text = String.valueOf(val);
                        if (text.length() > 100) text = text.substring(0, 100);
                        bundle.putString(key, text);
                    }
                }
            }
            firebaseAnalytics.logEvent(name, bundle);
        } catch (RuntimeException ignored) {
            // Analytics failure must never affect gameplay.
        }
        call.resolve();
    }

    @PluginMethod
    public void setUserProperty(PluginCall call) {
        if (firebaseAnalytics == null) {
            call.resolve();
            return;
        }
        String name = call.getString("name");
        if (name == null || name.isEmpty()) {
            call.resolve();
            return;
        }
        try {
            String value = call.getString("value");
            if (value != null && value.length() > 36) {
                value = value.substring(0, 36);
            }
            firebaseAnalytics.setUserProperty(name, value);
        } catch (RuntimeException ignored) {
            // Analytics failure must never affect gameplay.
        }
        call.resolve();
    }
}
