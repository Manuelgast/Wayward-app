package com.waywardbooks.app;

import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import java.util.Collections;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android back button: let the book handle it (close sheet, back to the library, ...);
        // only when the reader is already in the library does the app go to the background.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv == null) {
                    moveTaskToBack(true);
                    return;
                }
                wv.evaluateJavascript("(window.__waywardBack && window.__waywardBack()) ? 'y' : 'n'", res -> {
                    if (res == null || !res.contains("y")) moveTaskToBack(true);
                });
            }
        });

        // The page corner sits at the lower right edge. Keep Android's back gesture away from that strip,
        // so taking the corner turns the page instead of leaving the book (Android 10+, max 200dp per edge).
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            wv.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, orr, ob) -> {
                float d = getResources().getDisplayMetrics().density;
                int w = r - l, h = b - t, strip = Math.round(48 * d), tall = Math.round(200 * d);
                v.setSystemGestureExclusionRects(Collections.singletonList(new Rect(w - strip, Math.max(0, h - tall), w, h)));
            });
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    public void onResume() {
        super.onResume();
        immersive();
        js("window.__waywardResume && window.__waywardResume()");
    }

    @Override
    public void onPause() {
        js("window.__waywardPause && window.__waywardPause()");
        super.onPause();
    }

    /** Full-screen reading: system bars hidden, a swipe from the edge shows them briefly. */
    private void immersive() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    private void js(String code) {
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) wv.evaluateJavascript(code, null);
    }
}
