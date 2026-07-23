# libpag (PAG gift animations) resolves several Java classes from native code
# via JNI/reflection. R8 cannot see those references, so it shrank away
# org.libpag.TraceImage — which made libpag.so abort in JNI_OnLoad with
# "ClassNotFoundException: org.libpag.TraceImage" (SIGABRT) the first time a
# .pag gift played. Keep the whole package.
-keep class org.libpag.** { *; }
-keep interface org.libpag.** { *; }
-dontwarn org.libpag.**

# libpag pulls in Tencent bugly/tav helpers referenced natively.
-keep class com.tencent.** { *; }
-dontwarn com.tencent.**

# SVGA player uses reflection for its proto-decoded models.
-keep class com.opensource.svgaplayer.** { *; }
-dontwarn com.opensource.svgaplayer.**

# Agora RTC resolves classes from native code; R8 cannot see those references.
# Same failure mode that removed org.libpag.TraceImage and crashed libpag.
-keep class io.agora.**{ *; }
-dontwarn io.agora.**
