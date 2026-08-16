package com.mirrorisle.beta;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String BOOT_TAG = "MirrorBoot";
    private static final int MAX_BOOT_CHECKS = 40;
    private static final long BOOT_CHECK_INTERVAL_MS = 250L;

    private final Handler bootHandler = new Handler(Looper.getMainLooper());
    private int bootChecks = 0;

    private final Runnable bootCheck = new Runnable() {
        @Override
        public void run() {
            Bridge bridge = getBridge();
            if (bridge == null) {
                scheduleNextBootCheck();
                return;
            }

            bridge.eval("document.documentElement.dataset.mirrorReady || ''", value -> {
                if ("\"1\"".equals(value) || "1".equals(value)) {
                    Log.i(BOOT_TAG, "MIRROR_NATIVE_BOOT_READY");
                    bootHandler.removeCallbacks(bootCheck);
                    return;
                }
                scheduleNextBootCheck();
            });
        }
    };

    @Override
    public void onResume() {
        super.onResume();
        bootChecks = 0;
        bootHandler.removeCallbacks(bootCheck);
        bootHandler.post(bootCheck);
    }

    @Override
    public void onPause() {
        bootHandler.removeCallbacks(bootCheck);
        super.onPause();
    }

    private void scheduleNextBootCheck() {
        bootChecks += 1;
        if (bootChecks >= MAX_BOOT_CHECKS) {
            Log.e(BOOT_TAG, "MIRROR_NATIVE_BOOT_TIMEOUT");
            return;
        }
        bootHandler.postDelayed(bootCheck, BOOT_CHECK_INTERVAL_MS);
    }
}
