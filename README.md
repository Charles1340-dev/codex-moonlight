# 月白解放 · Moonlight Codex

Windows Codex 的航海启动动画、主题预览与 Mini 桌宠扩展，使用 MIT 许可证开放源代码。

航海开场在真实 Codex 的加载阶段接入，结束或按 Esc 后揭开同一个操作窗口。公开版本提供原创默认壁纸、通用帆船与地标；角色插画、全身变身视频和桌宠视频由可选本地素材提供，不包含在公开仓库或程序包中。

## 功能与当前边界

| 功能 | 公开版本 | 可选本地素材 |
| --- | --- | --- |
| 航海开场、海面动态、重播与 Esc | 通用帆船和场景，可独立预览 | 双船图集与章节背景 |
| 原生加载页开场、复用现有窗口 | 需要已安装兼容的 Codex Dream Skin | 不要求角色素材 |
| 主题预览和导出 | 原创月夜壁纸与玻璃界面 | 可导入自己的壁纸 |
| 真实推理强度面板的全身动画 | 保留原有模型和档位控件 | 需要对应透明视频 |
| 增强 Mini、拖动、动作与吃图标演出 | 保留原生 Mini；增强功能需要素材 | 三种常驻形态、各六招、30 段日常和9段起停 |

桌宠形态独立于模型推理强度。切换模型和档位使用 Codex 原有控件；本项目不代理模型请求，也不要求提供 API Key。系统减少动态效果设置会生效。

## 下载与使用

从本仓库 Releases 下载 `MoonlightCodex-版本-win-x64.zip`，完整解压后运行 `MoonlightCodex.exe`。这是独立的启动与主题辅助程序，不能替代 Codex 客户端。

1. 安装 Windows x64 Codex，以及兼容的 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)。当前原生连接校验针对 Microsoft Store 安装版。
2. 双击本程序可预览界面和重播开场。通过 Dream Skin 托盘导入程序同级的 `moonlight-theme.zip`，应用默认主题。
3. 在本程序选择「从 Dream Skin 启动」，或在快捷方式目标末尾加 `--dreamskin`，将开场和增强功能接入真实 Codex。

```text
MoonlightCodex.exe                 预览与重播
MoonlightCodex.exe --dreamskin     通过已验证的本机连接接入 Codex
MoonlightCodex.exe --launch        普通打开或复用 Codex
```

已运行时复用现有 Codex；未运行时才启动。缺少可用连接时回到普通启动，不会把预览工作台当作真实聊天界面。原生界面标记和 Dream Skin 的兼容性可能随版本变化，目前未验证 macOS 和 Linux。

## 本地素材与 Mini

将自己有权使用的素材放到程序同级的 `local-themes/voyage/`。双船图集、章节、六档推理形态和桌宠文件约定见 [本地素材接入](docs/本地素材接入.md)。本机的 `moonlight-voyage-art-v15.zip` 是独立私人素材包，不属于公开 Release。

桌宠还需要在 Codex 中注册对应的智能伙伴图集；注册方法也在该文档中。选中「路飞 · 航海版」后，用「设置 → 迷你界面和智能伙伴 → 显示 Mini」控制增强桌宠。按住角色可拖动，右键选择动作、三种形态和各自六招。模型强度仍按真实六档展示。

增强桌宠可自主游荡，每分钟尝试走到一个可见快捷方式旁，演出变零食、吞咽和恢复。效果仅叠加在透明浮窗中，快捷方式文件和布局保持可用。紧凑菜单内部可滚动，点击其他位置关闭。动画共用一个视频解码器，首帧就绪后交接，避免多个身体叠影。

制作与验证记录：[桌宠完整动作](docs/桌宠自然动作.md) · [模型强度变身](docs/模型强度变身动画.md) · [航海分镜](docs/航海启动分镜.md)。

## 开发、测试与打包

需要 Node.js 24 和 Windows x64。普通应用构建不需要动画制作工具或私人素材。

```powershell
npm ci
npm test
npm run build
npm run test:startup
npm run desktop
npm run package:win
npm run package:source
```

`npm run dev` 用于本地界面开发。`npm run test:startup` 在真实 Electron 渲染器里验证大于 2 MiB 的船图实际绘制，以及没有本地素材时的通用帆船。0.2.29 修复了原生开场船图经 CSS 自定义变量传递而消失的问题。

源码与便携 ZIP、SHA-256 输出到 `release/`。仓库包含分支/PR 检查和 Windows release 工作流；推送 `v*` 标签可自动生成 Release。具体上传步骤见 [GitHub 开源发布](docs/GitHub开源发布.md)，贡献约定见 [CONTRIBUTING](CONTRIBUTING.md)。
