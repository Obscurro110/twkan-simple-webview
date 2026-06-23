# Twkan Simple WebView

一个用于封装 `https://twkan.com/` 的 Android WebView App。页面加载后会向网页注入 `simplify.js`，通过 Android ICU 的 `Traditional-Simplified` 转写器把繁体中文自动转换为简体中文。

## 功能

- 首页固定打开 `https://twkan.com/`
- 站内链接继续在 App 内打开
- 站外链接交给系统浏览器
- 支持 Cookie、DOM Storage 和阅读记录等站点本身功能
- 自动转换首次加载文本、后续动态插入文本、标题和常见可访问性属性
- Android 返回键优先执行网页后退

## 构建

本项目是标准 Gradle Android 工程，可直接用 Android Studio 打开 `twkan-simple-webview` 目录后构建。如果 Android Studio 提示创建或下载 Gradle Wrapper，按提示执行即可。

命令行构建需要本机安装 JDK、Android SDK 和 Gradle：

```powershell
cd D:\AI\code\ls\twkan-simple-webview
gradle :app:assembleDebug
```

调试 APK 生成位置：

```text
app/build/outputs/apk/debug/app-debug.apk
```

## 兼容性

`android.icu.text.Transliterator` 的公开 API 从 Android 10/API 29 可用，所以 `minSdk` 设置为 29。如果需要支持更老设备，建议改为内置 OpenCC 字典或引入对应转换库，而不是只做简单字符表替换。
