package com.shineexam.app;

import android.app.Activity;
import android.view.WindowManager;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;

public class ScreenSecurityModule extends ReactContextBaseJavaModule {
    public static final String NAME = "RNScreenSecurity";

    public ScreenSecurityModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void setFlagSecure(final boolean enable, final Promise promise) {
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Activity activity = getCurrentActivity();
                    if (activity != null) {
                        if (enable) {
                            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        } else {
                            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        }
                        promise.resolve(true);
                    } else {
                        promise.reject("ACTIVITY_NULL", "Current activity is null");
                    }
                } catch (Exception e) {
                    promise.reject("FLAG_SECURE_ERROR", e.getMessage());
                }
            }
        });
    }
}
