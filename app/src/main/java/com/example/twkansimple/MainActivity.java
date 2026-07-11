package com.example.twkansimple;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.icu.text.Transliterator;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String TAG = "TwkanSimple";
    private static final String HOME_URL = "https://twkan.com/";
    private static final String SIMPLIFY_BRIDGE_NAME = "TwkanBridge";
    // Max ms to wait for simplification before showing page anyway
    private static final int SHOW_TIMEOUT_MS = 1500;

    private WebView webView;
    private ProgressBar progressBar;
    private String simplifierScript;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable showPageRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        simplifierScript = readAsset("simplify.js");
        createContentView();
        configureWebView();

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void createContentView() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setVisibility(View.GONE);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(3)
        );
        progressParams.gravity = Gravity.TOP;
        root.addView(progressBar, progressParams);

        setContentView(root);
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        // Override User-Agent to remove the "wv" WebView marker that Cloudflare detects as a bot.
        // Use a standard Chrome Mobile UA string instead.
        settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new SimplifyBridge(), SIMPLIFY_BRIDGE_NAME);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) {
                    return false;
                }
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                // Hide the WebView immediately when a new page starts loading
                // so the user never sees raw traditional Chinese text flash.
                if (isTwkanHost(Uri.parse(url).getHost())) {
                    webView.setVisibility(View.INVISIBLE);
                    // Safety timeout: always show after 1.5s even if JS didn't call back
                    cancelShowTimeout();
                    showPageRunnable = () -> showWebView();
                    mainHandler.postDelayed(showPageRunnable, SHOW_TIMEOUT_MS);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                injectSimplifier(url);
            }
        });
    }

    private void cancelShowTimeout() {
        if (showPageRunnable != null) {
            mainHandler.removeCallbacks(showPageRunnable);
            showPageRunnable = null;
        }
    }

    private void showWebView() {
        cancelShowTimeout();
        webView.setVisibility(View.VISIBLE);
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) {
            return false;
        }

        String scheme = uri.getScheme();
        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            if (isTwkanHost(uri.getHost())) {
                return false;
            }
            openExternal(uri);
            return true;
        }

        if ("about".equalsIgnoreCase(scheme) || "javascript".equalsIgnoreCase(scheme)) {
            return false;
        }

        openExternal(uri);
        return true;
    }

    private boolean isTwkanHost(String host) {
        if (host == null) {
            return false;
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        return "twkan.com".equals(normalized) || normalized.endsWith(".twkan.com");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ex) {
            Toast.makeText(this, R.string.no_browser_found, Toast.LENGTH_SHORT).show();
        }
    }

    private void injectSimplifier(String url) {
        if (url == null) {
            return;
        }
        if (!isTwkanHost(Uri.parse(url).getHost()) || simplifierScript.isEmpty()) {
            return;
        }
        webView.evaluateJavascript(simplifierScript, null);
    }

    private String readAsset(String fileName) {
        try (InputStream input = getAssets().open(fileName);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (IOException ex) {
            Log.e(TAG, "Unable to read asset: " + fileName, ex);
            return "";
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public final class SimplifyBridge {
        private final Transliterator transliterator;

        public SimplifyBridge() {
            transliterator = Transliterator.getInstance("Traditional-Simplified");
        }

        /** JS calls this once the first simplification pass is complete. */
        @JavascriptInterface
        public void onPageReady() {
            mainHandler.post(() -> showWebView());
        }

        @JavascriptInterface
        public String toSimplified(String text) {
            if (text == null || text.isEmpty()) {
                return text;
            }
            synchronized (transliterator) {
                return transliterator.transliterate(text);
            }
        }

        /**
         * Batch convert multiple strings in a single Bridge call.
         * Input/output: strings joined by the Unit Separator character (U+001F).
         */
        @JavascriptInterface
        public String toBatchSimplified(String input) {
            if (input == null || input.isEmpty()) {
                return input;
            }
            String[] parts = input.split("\u001F", -1);
            StringBuilder result = new StringBuilder(input.length());
            synchronized (transliterator) {
                for (int i = 0; i < parts.length; i++) {
                    if (i > 0) result.append('\u001F');
                    String part = parts[i];
                    result.append(part.isEmpty() ? part : transliterator.transliterate(part));
                }
            }
            return result.toString();
        }
    }
}
