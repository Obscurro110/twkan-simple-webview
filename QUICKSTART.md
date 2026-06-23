# 快速开始指南

## 🚀 使用 GitHub Actions 构建 APK

### 第一步：创建 GitHub 仓库并推送代码

```bash
# 1. 在 GitHub 上创建新仓库（不要初始化任何文件）
#    访问: https://github.com/new
#    仓库名: twkan-simple-webview

# 2. 推送代码（替换 YOUR_USERNAME 为你的 GitHub 用户名）
cd D:/AI/code/ls/twkan-simple-webview
git remote add origin https://github.com/YOUR_USERNAME/twkan-simple-webview.git
git branch -M main
git push -u origin main
```

### 第二步：等待自动构建

1. 访问你的 GitHub 仓库
2. 点击顶部的 **Actions** 标签
3. 看到 "Build APK" 工作流正在运行（黄色圆圈）
4. 等待 3-5 分钟直到显示绿色勾号 ✅

### 第三步：下载 APK

1. 点击已完成的构建任务
2. 滚动到底部的 **Artifacts** 部分
3. 下载 **app-debug**（这是一个 ZIP 文件）
4. 解压得到 `app-debug.apk`

### 第四步：安装到 Android 设备

1. 将 `app-debug.apk` 传输到手机
2. 在手机上点击安装
3. 如果提示"未知来源"，需要在设置中允许安装

## 📝 重要说明

- ✅ 所有文件已准备就绪，包括 GitHub Actions 配置
- ✅ 每次推送代码到 `main` 分支会自动构建
- ✅ 也可以在 Actions 页面手动触发构建（Run workflow 按钮）
- ✅ 构建产物保存 90 天
- ✅ 公开仓库的 GitHub Actions 完全免费

## 🔧 Git 配置（如果需要）

如果你想修改 Git 用户信息：

```bash
git config --global user.name "你的名字"
git config --global user.email "your.email@example.com"
```

## 📦 项目结构

```
twkan-simple-webview/
├── .github/workflows/build.yml  # GitHub Actions 配置
├── .gitignore                   # Git 忽略文件
├── BUILD_INSTRUCTIONS.md        # 详细构建说明
├── README.md                    # 项目说明
├── build.gradle                 # 根构建配置
├── settings.gradle              # Gradle 设置
├── gradlew / gradlew.bat        # Gradle Wrapper 脚本
├── gradle/wrapper/              # Gradle Wrapper 文件
└── app/                         # 应用源代码
    ├── build.gradle
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/                # Java 代码
        ├── res/                 # 资源文件
        └── assets/              # simplify.js 脚本
```

## ❓ 常见问题

**Q: 推送代码时要求输入密码？**  
A: GitHub 现在需要使用 Personal Access Token (PAT) 而不是密码。访问 GitHub Settings → Developer settings → Personal access tokens 创建一个。

**Q: 构建失败了怎么办？**  
A: 点击失败的构建查看日志，通常是 Gradle 配置问题。可以在 Actions 页面重新运行。

**Q: 可以构建发布版 APK 吗？**  
A: 可以，但需要配置签名密钥。当前配置会尝试构建 release 版本但未签名。

**Q: 本地能构建吗？**  
A: 可以，但需要安装 Android Studio 或手动配置 Android SDK + JDK。建议使用 GitHub Actions。

## 📱 应用信息

- **应用名**: 台湾小说网简体版
- **包名**: com.example.twkansimple
- **最低系统**: Android 10 (API 29)
- **目标系统**: Android 15 (API 35)
- **功能**: 自动将繁体中文转换为简体中文

详细技术说明请查看 `README.md`。
