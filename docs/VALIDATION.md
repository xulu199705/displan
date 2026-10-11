# DisPlan V1.0 验证报告

日期：2026-10-11。环境：Windows，Node.js v24.20.0，npm 11.19.0。

## 实际执行结果

| 检查               | 结果                    | 证据范围                                              |
| ------------------ | ----------------------- | ----------------------------------------------------- |
| `npm run build`    | PASS                    | TypeScript 严格类型检查及 Vite 生产构建，白板独立加载 |
| `npm test`         | PASS，52 / 52           | 3 个 Vitest 测试文件：几何、历史状态、持久化与导出    |
| `npm run test:e2e` | PASS，9 / 9             | Microsoft Edge，1440 × 1000 桌面及 800 × 850 窄屏     |
| `npm audit`        | PASS，0 vulnerabilities | 安装升级后依赖审计；这是当前审计结果，后续可变化      |
| 本地预览           | PASS，HTTP 200          | Vite 开发服务及 Codex 浏览器可见界面检查              |

生产产物：主入口 JS 255.99 kB、白板 JS 350.56 kB，gzip 分别约 81.83 / 107.66 kB；CSS 14.93 kB。构建不再出现大于 500 kB 的单块警告。

## 核心回归

毫米正反坐标变换、四种旋转及中心稳定性、单台和联合 AABB、负坐标、锁定对象参与组合统计、对角线估算、指针中心缩放、远距离 Fit、边缘及中心吸附、四种间距、不同缩放下 8 CSS px 阈值、轴向限制、投影重叠过滤、测量接触 / 重叠 / 包含、带方向偏差。

指定 Dell 示例已由单元和浏览器测量共同验证：

| 项目                             |              期望值 | 结果 |
| -------------------------------- | ------------------: | ---- |
| 双 U3425WE 高度                  |           718.30 mm | PASS |
| 竖置 U3225QE 高度                |           713.20 mm | PASS |
| 高度差                           |             5.10 mm | PASS |
| 垂直中心偏差                     |             0.00 mm | PASS |
| B − A 顶边偏差（A 双屏，B 竖屏） |            +2.55 mm | PASS |
| B − A 底边偏差                   |            −2.55 mm | PASS |
| 水平边缘间距                     |            10.00 mm | PASS |
| 整体 AABB                        | 1233.80 × 718.30 mm | PASS |

## 浏览器交互覆盖

1. 初始示例、包围盒开关、Ctrl 滚轮与 Fit；世界数据不漂移。
2. 同型号重复添加、预设宽高只读、精确坐标、旋转、撤销重做、输入焦点隔离、10 mm 键盘移动、复制和删除。
3. 仓库 DOM 拖放到鼠标落点；原型保留；Alt 拖动尺寸不变；一次拖动只产生一步历史。
4. 命名保存、刷新恢复、JSON 导出再导入保持实例坐标；未知版本导入拒绝；本地列表删除。
5. PNG / SVG 下载与文件内容检查：示例 PNG 为 2588 × 1557 px，SVG viewBox 为 `-30 -30 1293.8 778.3`，包含 30 mm 留白，维持物理比例。
6. 直接尺寸和对角线估算自定义型号；实例尺寸数值编辑与撤销。
7. 多选测量组、指定边缘偏差、测量目标拖动实时更新、旋转实时更新、删除清除及 Escape 退出。
8. 最近吸附候选、Shift 轴限制、锁定保护、Space 平移、桌面截图及窄屏仓库展开。
9. 已选对象 Shift 拖动保持选择，静止 Shift 点击取消选择，两种操作正确区分。

鼠标事件在浏览器中以 CSS 像素落点产生，自动化拖动测试按实际落点对应的毫米坐标断言；0.01 mm 及更细精确定位通过数值字段和纯几何测试验证。

## 修复与边界

依赖首次安装审计发现 Vitest / tinypool 漏洞，升级到配套构建和测试版本后审计为零。Fit 的最小缩放下界已调整，避免远距离对象无法完整显示。明确保存会即时写入当前草稿，离开页面时也会尝试刷新草稿，日常编辑使用 500 ms 防抖。提交前复核发现已选对象 Shift 拖动会过早取消选择，已将取消选择延迟到静止点击释放时，并补充浏览器回归。

初轮测试中 JSON 字段顺序、小数鼠标落点以及最近吸附候选的断言存在错误，已依据独立几何和实际浏览器行为修正。最终结果采用修正后完整回归。

已加入 GitHub Actions，执行安装、单元测试、构建与 Chromium 浏览器回归。该工作流的远程运行结果需以 GitHub 实际状态为准，本报告不将本地 Edge 结果等同于远程 CI。

未验证：Safari / Firefox 全套兼容性、大规模对象性能、触摸交互、机械支架安装、实体屏幕尺长校准。工具只提供二维外形几何规划。

界面记录：[桌面截图](screenshots/displan-desktop.png)、[测量截图](screenshots/displan-measurement.png)。

## HTTP UUID 兼容修复回归（2026-10-11）

所有方案、实例与自定义型号 ID 统一使用 `src/domain/uuid.ts`：优先原生 `randomUUID()`，不可用时通过 `getRandomValues()` 生成 16 字节随机数，并设置 UUID v4 的 version / variant 位。保持原有 ID 格式和文档 schema，不增加依赖。

| 检查 | 结果 | 证据范围 |
| --- | --- | --- |
| `npm test` | PASS，58 / 58 | 原有 52 项及新增 6 项 UUID 测试；原生 API、接收者绑定、version / variant 位、1000 个回退 UUID 的格式与唯一性、缺失 Web Crypto 的提示 |
| `npm run build` | PASS | TypeScript 严格类型检查及生产构建 |
| `npm run test:e2e` | PASS，10 / 10 | 原有 9 项及新增普通 HTTP 回归，Microsoft Edge |

HTTP 测试使用 `http://displan.test:5173/`，浏览器仅将测试域名解析到本地服务器。测试没有修改 Web Crypto，也没有将 HTTP 来源强制视为安全上下文；实际断言 `isSecureContext === false`、`typeof crypto.randomUUID === "undefined"`、`getRandomValues` 可用。

覆盖首次加载 Dell 示例、新建空方案、重复添加、复制、撤销重做、创建自定义型号、命名保存、刷新恢复、自定义仓库恢复、重新加载示例及 JSON 导入。检查生成 ID 的 UUID v4 格式、唯一性和型号引用，并确认全过程无页面脚本异常。

首次构建发现测试引入了项目未配置的 Node 类型声明，已改用运行环境的 Web Crypto，最终构建通过。初轮浏览器回归出现一次既有吸附拖动测试未触发移动；文件编辑结束后完整重跑 10 项全部通过，未修改拖动逻辑或放宽断言。

本次验证支持普通局域网 HTTP 的浏览器兼容性；未在 `192.168.30.141` 安装静态服务器或部署产物。该主机需提供 `dist/` 的 HTTP 静态服务才能通过端口 80 访问。

## 子路径部署回归（2026-10-11）

Vite base 改为 `/displan/`，浏览器测试同步使用该路径，HTTP 回归额外检查 favicon 前缀。`npm test` 为 58 / 58，`npm run build` 通过，`npm run test:e2e` 为 10 / 10。

TNC30141 临时 Nginx 与临时 loopback DisPlan 服务预检通过：根地址入口页不跳转、两个应用前缀、DisPlan 全部资源字节、方案页 HTML / CSS、缺失资源和未知地址 404、禁止目录列表、仅两个指定入口追加尾斜杠。部署 Bash 语法、Python 3.9 语法和用户级 systemd unit 检查通过。

正式部署需一次交互 sudo 执行 `install.sh`；实际三个服务的独立启停和最终路径访问结果以主机 `/home/xulu/Service/verification-subpaths.log` 为准，临时预检不等同于已完成正式 Nginx 切换。

正式切换首轮发现 `systemctl reload` 返回后，验证请求仍可能由旧 worker 处理，未知路径短暂返回旧版 SPA 的 200。随后实际响应已为 404，两个新入口均为 200；验证脚本增加最多 8 秒的条件轮询，等待新路由生效后再执行原有严格断言。应用与 Nginx 的启动 / 重启脚本同步等待对应 HTTP 服务就绪。

## TNC30141 正式部署实测（2026-10-11）

已完成正式 Nginx 路径切换，服务器使用更新后的等待逻辑重新执行完整验证。读取 /home/xulu/Service/verification-subpaths.log，最终结果为 PASS: ALL subpath routing and independent control checks; all services running。

- 根地址返回应用入口列表，HTTP 200，不自动跳转；未知路径返回 404。
- /displan 与 /display_plan_note/U-3-A-343432 分别追加尾斜杠，HTTP 301；各自应用页面返回 200，缺失资源返回 404。
- 两个应用各自停止时，其代理入口为 502，另一个应用为 200，Nginx 保持运行；启动后恢复 200；重启后 MainPID 改变；各自状态脚本正常。
- Nginx 停止时 HTTP 不可达，两个应用进程仍为 active；启动及重启后两条应用路由恢复 200，Nginx MainPID 改变；状态脚本正常。
- 实测结束后两个应用和 Nginx 均为 active / enabled。
- 实际内网浏览器访问两个新路径：DisPlan 白板正常加载，添加、旋转、撤销及刷新恢复正常，已有自定义型号保留；方案页图片放大和关闭正常。此次访问的两个页面均无捕获到的 error / warn 控制台日志。
- 源码修复提交 d1010894cb5a245babb04a3f7f8780bcba4912f6 的 [GitHub Actions](https://github.com/xulu199705/displan/actions/runs/38117578386) 已完成，结论为 success。

Nginx 控制脚本位于 /home/xulu/Service/nginx-{start,stop,restart,status}.sh；两个应用目录各自提供 start.sh、stop.sh、restart.sh、status.sh。操作说明见 deploy/README.md。本次不扩大先前列出的浏览器与物理安装验证范围。
