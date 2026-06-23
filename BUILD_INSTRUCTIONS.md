# 如何使用 GitHub Actions 构建 APK

## 步骤 1: 创建 GitHub 仓库

1. 访问 [GitHub](https://github.com) 并登录
2. 点击右上角的 `+` → `New repository`
3. 填写仓库信息：
   - **Repository name**: `twkan-simple-webview`（或你喜欢的名字）
   - **Description**: 台湾小说网简体版 - Android WebView 应用
   - **Public** 或 **Private**（随意选择）
   - 不要勾选 "Add a README file"、"Add .gitignore" 或 "Choose a license"
4. 点击 `Create repository`

## 步骤 2: 推送代码到 GitHub

在你的项目目录中运行以下命令（替换 `YOUR_USERNAME` 为你的 GitHub 用户名）：

```bash
cd D:/AI/code/ls/twkan-simple-webview
git remote add origin https://github.com/YOUR_USERNAME/twkan-simple-webview.git
git branch -M main
git push -u origin main
```

**提示**：如果你还没有配置 Git，先运行：
```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

## 步骤 3: 触发自动构建

推送代码后，GitHub Actions 会自动开始构建。你可以：

1. 在 GitHub 仓库页面点击 `Actions` 标签
2. 查看正在运行的工作流
3. 等待构建完成（大约 3-5 分钟）

**或者手动触发构建**：
1. 进入 `Actions` 标签
2. 点击左侧的 `Build APK` 工作流
3. 点击右侧的 `Run workflow` → `Run workflow`

## 步骤 4: 下载 APK

构建完成后：

1. 进入 `Actions` 标签
2. 点击最新的成功构建（绿色勾号）
3. 向下滚动到 `Artifacts` 部分
4. 下载 `app-debug`（调试版 APK，可直接安装）

## APK 位置

- **调试版**：`app-debug.apk` - 可直接安装到 Android 设备
- **发布版**（如果成功构建）：`app-release-unsigned.apk` - 需要签名后才能安装

## 在 Android 设备上安装

1. 下载并解压 `app-debug.zip`
2. 将 `app-debug.apk` 传输到你的 Android 设备
3. 在设备上启用"未知来源"安装：
   - 设置 → 安全 → 允许安装未知应用
4. 点击 APK 文件进行安装

## 注意事项

- 项目已配置为在每次推送到 `main` 分支时自动构建
- 你也可以通过 Pull Request 触发构建
- 所有构建产物会保存 90 天
- GitHub Actions 对公开仓库免费，私有仓库每月有免费配额

## 故障排除

如果构建失败：
1. 检查 Actions 日志查看错误信息
2. 确保所有文件都已正确提交
3. 检查 `build.yml` 配置是否正确

## 本地测试（如果以后安装了 Android Studio）

```bash
cd D:/AI/code/ls/twkan-simple-webview
./gradlew assembleDebug
# APK 位置: app/build/outputs/apk/debug/app-debug.apk
```
