# 发布到 GitHub

目标仓库：Charles1340-dev/codex-moonlight。代码使用 MIT 许可证，公开源码与本地角色素材分开。

## 发布内容

| 内容 | 放置位置 |
| --- | --- |
| src、desktop、scripts、tests、docs、themes、worker、配置与许可证 | Git 仓库 |
| MoonlightCodex-版本-win-x64.zip 及 SHA-256 | GitHub Release |
| MoonlightCodex-版本-source.zip 及 SHA-256 | 可选 Release 附件 |
| local-themes、私人插画、角色动画及对应本地素材包 | 保留在本机 |
| node_modules、dist、qa、日志和 .env | 不上传 |

公开版包含原创默认壁纸、通用帆船、地标和预览界面。推理形态视频和增强桌宠需要使用者自行准备素材，具体文件格式与 Mini 接入见 [本地素材接入](本地素材接入.md)。仓库的 MIT 许可证不代表对另外导入的素材授予权利。

## 首次发布

1. 在 GitHub 核对右上角账号为 Charles1340-dev，创建 public 仓库 codex-moonlight。已有本地文件时不要额外勾选生成 README、许可证或 .gitignore。
2. 在本项目目录提交经过检查的源码并关联仓库。先用 `git status`、`git diff --cached --stat` 核对内容；不要强制加入被忽略的目录。

```powershell
git init
git symbolic-ref HEAD refs/heads/main
git add .github .openai desktop docs scripts src tests themes worker
git add .gitignore .npmrc AGENTS.md CONTRIBUTING.md LICENSE README.md index.html package.json package-lock.json vite.config.mjs
git diff --cached --stat
git commit -m "Release Moonlight Codex 0.2.31"
git remote add origin https://github.com/Charles1340-dev/codex-moonlight.git
git push -u origin main
```

Git 登录身份与提交作者是不同设置；推送时应使用 Charles1340-dev 的授权，不要使用其他账号的 Token。当前 Codex GitHub 连接若仍是其他账号，需在连接设置里重新登录目标账号，或使用已登录目标账号的 GitHub 网页/Git 客户端。不要把凭据写进仓库地址。

## 自动打包与 Release

仓库含 Windows release 工作流。手动运行 Actions → Windows release 可先取得构建产物；推送与 package.json 版本一致的标签，会自动测试、构建、打包并创建 Release：

```powershell
git tag v0.2.31
git push origin v0.2.31
```

普通分支与 PR 由 CI 检查测试、构建和启动船只绘制。Release 上传便携 ZIP、源码 ZIP 和校验文件，程序 ZIP 不含本地角色素材。

本机导出可复核的源码包：`npm run package:source`。脚本使用明确的源码目录，排除本地素材、构建、环境文件和密钥，并阻止常见明文凭据进入归档；文件清单与哈希在 release/source-manifest.json。请不要将整个工作目录直接拖到 GitHub 网页。

参考：[GitHub 官方：将本地代码添加到仓库](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github?platform=windows)。
