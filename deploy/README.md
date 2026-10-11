# TNC30141 子路径部署

| 入口 | 应用服务 |
| --- | --- |
| `http://192.168.30.141/` | Nginx 应用入口列表，不自动跳转 |
| `http://192.168.30.141/displan/` | xulu 用户级 `displan.service`，loopback 55432 |
| `http://192.168.30.141/display_plan_note/U-3-A-343432/` | xulu 用户级 `displaynote-u-3-a-343432.service`，55431 |

无尾斜杠的两个应用地址只跳转到各自带尾斜杠的地址，以保持相对资源路径正确。其他路径返回 404。Nginx 通过带尾斜杠的 `proxy_pass` 去除应用路径前缀；DisPlan 构建使用 `/displan/` base，方案页原有 HTML 的相对资源地址可直接使用。

## 目录与控制

DisPlan 发布包与部署工具放在 `/home/xulu/Service/displan/deploy`，发布目录为 `releases/<Git SHA>`，`current` 指向正在运行的产物。方案页继续使用 `/home/xulu/Service/display_plan_note/U-3-A-343432/dist`。

两个应用目录分别提供 `start.sh`、`stop.sh`、`restart.sh`、`status.sh`，以 xulu 身份运行，控制各自用户级 systemd unit，不需要 sudo。`stop.sh` 只停止当前服务，保留已配置的开机启动。Nginx 停止时应用进程继续运行；单个应用停止时其他应用与 Nginx 继续运行。

Nginx 独立控制脚本在 `/home/xulu/Service`：

```bash
./nginx-start.sh
./nginx-stop.sh
./nginx-restart.sh
./nginx-status.sh
```

Nginx 启停和重启需要 sudo，状态查看无需 sudo。通用控制器为 `nginx.sh`。

## 发布步骤

本机构建：`npm ci && npm test && npm run build && npm run test:e2e`。将 `dist/` 内容打包为 `displan-subpath.tar.gz`；部署目录同时保存 `REVISION`（完整 Git SHA）及 `SHA256SUMS-subpath`（构建包和部署文件的校验清单）。上传至 DisPlan 的 `deploy/` 目录。

先以 xulu 身份运行 `deploy/activate-apps.sh`，完成校验、备份应用脚本、发布产物、修复用户 unit 链接、启动两个应用服务并生成三个服务的独立控制脚本。方案页原有 `deploy/server.py` 与 unit 模板继续使用。

然后在本机交互终端执行一次：

```powershell
ssh -t TNC30141 "sudo bash /home/xulu/Service/displan/install.sh"
```

`install.sh` 委托 `deploy/install-nginx.sh`：备份原配置，安装应用入口页和代理配置，恢复 SELinux 文件标签，校验 Nginx；设置 `httpd_can_network_connect` 以允许 Nginx 连接应用端口，保留 SELinux Enforcing；启用用户 lingering 和 Nginx 开机启动，再重载 Nginx。主机须已安装 Nginx、Python 3.9+ 和 SELinux 管理工具，HTTP 80 端口已开放。

此步骤自动运行 `verify-services.sh`，依次验证根地址、两个入口、404、应用独立启停和 PID 变化，以及 Nginx 独立启停；退出时会尝试恢复所有服务。日志为 `/home/xulu/Service/verification-subpaths.log`。需要重复验证时运行 `sudo bash /home/xulu/Service/displan/verify-service.sh`。

同一 origin 下从根地址移动到 `/displan/` 会保留已有 localStorage 方案。无需重新导入。

配置依据：[Vite base](https://vite.dev/config/shared-options.html#base)、[Nginx proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)。
