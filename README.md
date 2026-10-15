# 词穹 IELTS Vocabulary

「词穹」是围绕《雅思词汇真经》制作的浏览器端学习网站，包含 64 个 List、3,693 个词条、三轮学习流程、浏览器发音、艾宾浩斯复习、学习记录及打卡。

正式部署目标为腾讯云 EdgeOne Pages/Makers，网站可作为纯静态项目运行，不需要数据库、服务端 API、登录系统或运行时环境变量。

## 技术栈

- React 19
- TypeScript 5
- Vite 8
- Tailwind CSS 4
- 浏览器 Web Speech API
- 浏览器 `localStorage`

## 环境要求

- Node.js `>=22.13.0`
- npm（仓库以 `package-lock.json` 和 `npm ci` 为正式部署标准）

## 本地安装和构建

```bash
npm ci
npm run build:edgeone
```

构建结果位于 `dist-edgeone/`。可以用任意静态文件服务器预览该目录，例如：

```bash
npx vite preview --outDir dist-edgeone
```

项目原有的 Sites 开发与构建方式仍保留：

```bash
npm run dev
npm run build
```

GitHub Pages 构建也继续保留：

```bash
npm run build:pages
```

## 腾讯云 EdgeOne Pages/Makers 部署

仓库根目录提供了 `edgeone.json`。从 GitHub 导入项目后，建议确认以下设置：

| 设置 | 值 |
| --- | --- |
| 根目录 | `.` |
| 安装命令 | `npm ci` |
| 构建命令 | `npm run build:edgeone` |
| 输出目录 | `dist-edgeone` |
| Node.js | `22.17.1` |
| 环境变量 | 无 |

构建成功后，在 EdgeOne 中绑定 `ciqiong.com`，并按控制台提示配置 DNS。不要删除或覆盖原来的 `chatgpt.site` 站点；新域名验证完成前，应同时保留两个版本。

## 数据和外部依赖

- 词库位于 `public/vocab.json`，随静态网站一同发布。
- 字体、图标、分享图片等运行时资源均在项目内，不依赖 Google Fonts 或海外 CDN。
- 发音使用设备浏览器内置的 Web Speech API，不调用外部语音接口，也不需要密钥。
- 学习进度、考试日期、每日计划和打卡记录保存在访问者浏览器的 `localStorage` 中。
- 项目没有运行时环境变量、数据库或后端服务。

## 从旧域名迁移学习记录

浏览器数据按域名隔离，旧站记录不会自动出现在 `ciqiong.com`。迁移步骤：

1. 在原 `chatgpt.site` 网站打开「设置 / 数据」。
2. 导出学习记录 JSON，并妥善保存该文件。
3. 打开 `ciqiong.com`。
4. 在相同入口导入刚才的 JSON 文件。
5. 检查累计学习、复习计划和打卡记录是否一致。

迁移和验收完成前不要清除旧站浏览器数据。该过程不需要服务器端数据迁移。

## 数据备份和恢复

建议用户定期使用站内导出功能备份学习记录。更换浏览器、设备、域名，或清理浏览器数据前，应先导出 JSON；恢复时使用站内导入功能。

## 安全说明

- 不要把云平台令牌、GitHub Token 或其他密钥写入源码、提交到仓库或放入前端环境变量。
- 当前静态版本不需要任何密钥。
- 如果未来加入跨设备同步或账号系统，应通过服务端保存凭据，并为数据接口增加鉴权和访问控制。

## 发布前检查

- `npm ci` 成功完成。
- `npm run build:edgeone` 成功完成。
- 构建目录存在 `index.html`、`assets/` 和 `vocab.json`。
- 在手机与桌面浏览器验证 64 个 List、三轮学习、发音、复习、打卡和导入导出。
- 验证 `ciqiong.com` 的 HTTPS、DNS 与中国大陆网络访问。
- 确认词库内容具备面向公众发布所需的版权或授权。
