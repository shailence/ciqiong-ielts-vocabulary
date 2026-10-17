# ciqiong.com 正式部署验收报告

检测时间：2026-10-17（Asia/Shanghai）

## 验收结论

**未通过，不能宣布正式部署成功。**

`ciqiong.com` 当前没有指向词穹或 EdgeOne，而是指向 22.cn 的域名出售展示服务。HTTP 返回出售页；HTTPS 在 TLS ClientHello 后超时或被关闭。由于自定义域名尚未进入正确的 EdgeOne 链路，静态资源完整性和中国大陆终端访问测试在该域名上均不具备通过条件。

现有备用地址保持不变：<https://ciqiong-ielts-vocabulary.shailence.chatgpt.site/>

## 实际检测结果

| 检查项 | 实际结果 | 状态 |
| --- | --- | --- |
| 域名注册状态 | Verisign RDAP 显示注册商为 22net, Inc.，到期时间 2026-12-24，NS 为 `PK3.22.CN`、`PK4.22.CN` | 需确认控制权 |
| DNS A 记录 | 系统解析器、阿里 DNS `223.5.5.5`、DNSPod `119.29.29.29`、Cloudflare `1.1.1.1` 均返回 `154.85.60.150`、`152.32.171.65`、`118.193.37.94` | 失败 |
| EdgeOne CNAME | 未检测到指向 `.edgeonedy1.com`、`.tyxcdn.com` 或 Makers 控制台下发目标的 CNAME | 失败 |
| HTTP | `http://ciqiong.com/` 返回 HTTP 200，但页面标题为“ciqiong.com域名出售”，服务端为 nginx | 失败 |
| HTTPS / TLS | 三个 IP 的 443 端口可连接，但带 `ciqiong.com` SNI 的 TLS 握手分别超时或被远端关闭，无法取得有效证书 | 失败 |
| EdgeOne 域名绑定 | 本地仓库具有 `edgeone.json` 和可成功执行的静态构建配置，但没有可验证的控制台绑定或部署记录；公开 DNS 亦证明绑定尚未生效 | 未通过 |
| 源站内容 | 当前自定义域名源站是出售页，不是词穹构建产物 | 失败 |
| 自定义域名静态资源 | 因 HTTPS 和源站均错误，无法在 `ciqiong.com` 验证词库、拓展、主题、阅读和图片资源 | 阻塞 |
| 中国大陆访问 | 中国大陆公共递归 DNS（阿里 DNS、DNSPod）均解析到出售页 IP；正式应用不可访问 | 失败 |
| 备用站首页 | HTTP/2 200 | 通过 |
| 备用站关键资源 | `vocab.json`、拓展数据、主题数据、阅读数据、桌面和手机背景图均 HTTP 200 | 通过 |

## 失败原因

首要原因不是代码或构建，而是**域名控制权/DNS 仍停留在 22.cn 出售页**。在域名所有权、EdgeOne 自定义域名绑定和正确 DNS 指向完成前，EdgeOne 无法为该域名提供应用内容或有效证书。

## 具体修复步骤

1. **确认域名所有权。** 登录 22.cn 域名账户确认 `ciqiong.com` 确实属于项目方，并确认可以修改 DNS。若该域名尚未购买，应先完成购买/过户，或改用一个已经拥有的域名；不要继续在 EdgeOne 配置一个无控制权的域名。
2. **移除出售页解析。** 在 22.cn/DNS 控制台删除目前指向三个出售页 IP 的 `@` 和 `www` 记录。操作前记录原值，以便回滚。
3. **确认合规区域。** 在 EdgeOne Makers 创建或打开词穹项目并选择加速区域。若选择“中国大陆可用区”或“包含中国大陆的全球区域”，先完成 ICP 备案；未备案时只能选择不含中国大陆的区域，不能把它宣称为大陆正式部署。
4. **确认生产构建。** 连接 GitHub 仓库 `shailence/ciqiong-ielts-vocabulary`，生产分支使用经过验收的分支；安装命令 `npm ci`，构建命令 `npm run build:edgeone`，输出目录 `dist-edgeone`，Node.js `22.17.1`。确认最新部署成功且预览地址能加载完整词库。
5. **添加自定义域名。** 在 Makers 的“域名管理”添加 `ciqiong.com`（建议同时添加 `www.ciqiong.com`），按控制台给出的 TXT/文件方式完成所有权验证。
6. **配置控制台下发的 DNS。** 严格使用 EdgeOne 显示的 CNAME/记录值，不要猜测。若 DNS 服务不支持根域 CNAME/ALIAS 展平，可把 `www.ciqiong.com` 作为主站绑定，再将根域 301 跳转到 `www`，或改用支持根域展平的 DNS。
7. **签发证书。** 在域名管理中申请 EdgeOne 免费证书或部署腾讯云托管证书，覆盖根域与 `www`；证书状态变为“已部署”后再开启强制 HTTPS，并建议只启用 TLS 1.2/1.3。
8. **复测源站和资源。** 依次检查首页、JS/CSS、`/vocab.json`、`/data/vocab-expansions.v1.json`、`/data/list-themes.v1.json`、`/data/reading-passages.v1.json`、两张背景图，确认全部 HTTPS 200、无混合内容、无海外字体/CDN请求。
9. **大陆真实网络验收。** 在北京、上海、广州至少各选一个节点，并覆盖电信、联通、移动：记录 DNS 结果、TLS 证书链、HTTP 状态、首字节时间和关键资源成功率。三运营商关键资源均成功后才将“大陆访问”标记为通过。
10. **迁移学习记录。** 域名切换不会自动携带 `localStorage`；提醒现有用户从备用站导出记录，再到新域名导入。验收完成前保留备用地址与历史部署。

## 官方配置依据

- EdgeOne Makers 自定义域名：<https://pages.edgeone.ai/document/custom-domain>
- EdgeOne Makers 常见问题：<https://pages.edgeone.ai/document/faqs>
- EdgeOne Pages/Makers 快速部署：<https://edgeone.ai/document/70404>
- EdgeOne 域名与 TLS 术语：<https://edgeone.ai/document/46435>

## 复验通过标准

- EdgeOne 控制台显示生产部署成功且自定义域名绑定正常。
- 公共 DNS 不再返回出售页 IP，并按控制台要求指向 EdgeOne。
- 根域和 `www` 均能完成 TLS 握手，证书域名、有效期和证书链正确。
- HTTP 自动跳转 HTTPS；首页和全部关键静态资源返回 200。
- 中国大陆三地、三运营商真实节点测试均可访问应用，而不是出售页或备用站。
- 上述证据保存后，才可把正式部署状态改为“通过”。
