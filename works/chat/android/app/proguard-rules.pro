# Project-specific ProGuard rules
# http://developer.android.com/guide/developing/tools/proguard.html

# ── Capacitor ────────────────────────────────────────────────────────────────
# Keep all Capacitor plugin classes so the WebView bridge works after minify.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    public <init>(...);
}
-dontwarn com.getcapacitor.**

# Keep all public methods in Capacitor plugin subclasses
-keepclassmembers class * extends com.getcapacitor.Plugin {
    public <methods>;
}

# ── Capgo live-update plugin ──────────────────────────────────────────────────
-keep class ee.forgr.capacitor_updater.** { *; }
-dontwarn ee.forgr.capacitor_updater.**

# ── WebView JavaScript interface ──────────────────────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Keep line numbers in stack traces for debugging ───────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
