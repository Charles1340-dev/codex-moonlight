# 参与开发

当前维护 Windows x64 版本。需要 Node.js 24；`npm ci` 会安装开发依赖和 Electron 运行时。

```powershell
npm ci
npm test
npm run build
npm run test:startup
npm run test:sites
```

`npm run dev` 打开本地界面开发服务；`npm run desktop` 运行已经构建的桌面端。启动服务后使用终端显示的本机地址。

界面代码在 src，Windows 桥接在 desktop。请保持主页面与 Mini 的身份校验、Store 安装身份和回环端口验证。开场须在原生加载阶段接入，同一播放任务衔接到原生工作区。桌宠坚持单解码器、单人物层和完整动作，不通过拆分肢体或透明叠影代替连续动作。具体约束见 AGENTS.md。

提交前运行上述检查。启动回归使用原创红蓝 PNG 夹具，包含超过 2 MiB 的图片地址；既检查 CSS 结果，也检查实际绘制像素，因此无需私人角色素材。无显示器的 Windows CI 也可运行。

高级动画制作脚本依赖自行准备的原画、Real-ESRGAN 和 RIFE 工具；它们不是普通用户构建应用的前置条件，工具与原画不打入公开源代码。素材约定见 [本地素材接入](docs/本地素材接入.md)。

PR 请说明问题、最终行为和验证结果。日志和截图应移除凭据、聊天内容与个人目录；本地素材、录屏和便携程序不要提交到 Git。
