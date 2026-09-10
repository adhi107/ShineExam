# React Native R8 & ProGuard Optimization Rules
# -------------------------------------------------------------------

# Keep React Native classes & native module bridges
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.shineexam.app.** { *; }

# Keep OkHttp & WebSocket
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**

# Keep Async Storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Keep SVG native elements
-keep class com.horcrux.svg.** { *; }

# Keep React Native Screens & Safe Area Context
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }

# Suppress known safe warnings for React Native
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
