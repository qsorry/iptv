package net.ssouq.player;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.UiModeManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * غلاف Ssouq Net للجوال وAndroid TV: WebView يحمّل نفس حزمة الويب من assets/www.
 *
 * التحميل من file:// مع السماح بالوصول العام يجعل الطلبات لخوادم المزوّدين (غالباً http وبلا CORS)
 * تعمل كما في تطبيقات التلفاز المحزومة. زر الرجوع يُرسل للتطبيق كحدث «ssouq:back» ليقرر هو
 * (إغلاق المشغّل، الرجوع، أو سؤال الخروج).
 */
public class MainActivity extends Activity {
    private static final String START_URL = "file:///android_asset/www/index.html";

    private WebView web;
    private FrameLayout root;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0E1014);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " SsouqNet/" + BuildConfigVersion.name(this) + (isTv() ? " AndroidTV" : ""));

        web.addJavascriptInterface(new Bridge(), "SsouqAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternally(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternally(Uri.parse(url));
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });

        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        hideSystemBars();

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
        web.requestFocus();
    }

    /** روابط التطبيق الداخلية تبقى في WebView؛ أي رابط http(s) يفتح في المتصفح. */
    private boolean openExternally(Uri uri) {
        String scheme = uri.getScheme();
        if ("file".equals(scheme) || scheme == null) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
            // لا متصفح على الجهاز (بعض أجهزة التلفاز).
        }
        return true;
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        web.setVisibility(View.VISIBLE);
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
        hideSystemBars();
    }

    private boolean isTv() {
        UiModeManager ui = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        return ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            exitFullscreen();
            return;
        }
        web.evaluateJavascript("window.dispatchEvent(new Event('ssouq:back'))", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        root.removeAllViews();
        web.destroy();
        super.onDestroy();
    }

    /** ما يراه التطبيق كـ window.SsouqAndroid (انظر src/platform/index.ts). */
    private final class Bridge {
        @JavascriptInterface
        public boolean isTv() {
            return MainActivity.this.isTv();
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= 21) finishAndRemoveTask();
                    else finish();
                }
            });
        }
    }

    /** اسم الإصدار من الحزمة نفسها (بلا BuildConfig المولّد). */
    private static final class BuildConfigVersion {
        static String name(Activity a) {
            try {
                return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1";
            }
        }
    }
}
