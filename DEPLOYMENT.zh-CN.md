# 多平台部署

为运行反向代理的服务设置 `TARGET_URL`，例如 `https://upstream.example.com`。可选的 `HEALTH_PATH` 默认是 `/__healthz`。部署后访问该路径确认服务启动，再用一个实际业务路径确认上游可达。健康检查在本地返回。

| 平台 | 部署方式 | 监听端口或配置 |
| --- | --- | --- |
| Cloudflare Pages | 从 Git 导入仓库 | Framework preset 选 None，构建命令留空，输出目录 `dist` |
| 阿里云函数计算 FC | Web 函数，上传下方代码包或使用容器镜像 | `9000` |
| 腾讯云 SCF | WebServer 镜像函数，使用仓库的 `Dockerfile` | `9000` |
| Vercel | 从 Git 导入仓库 | 自动识别 `server.ts`，使用 Node.js 22 或更新版本 |
| Netlify | 从 Git 导入仓库 | 使用仓库的 `netlify.toml`，给 Functions 作用域设置 `TARGET_URL` |
| 其他 Node.js 或容器平台 | Node.js 22+，启动命令 `npm start`，或构建 Docker 镜像 | `PORT`，默认 `9000` |

## 阿里云函数计算 FC

1. 在仓库根目录生成代码包。

   ```bash
   zip -r relay-fc.zip package.json server.js node-handler.js functions
   ```

2. 创建 Web 函数，选择支持 Node.js 22 或更新版本的自定义运行环境，然后上传 ZIP。自定义运行环境如果需要单独提供 Node.js，可使用公共层，或直接使用下文的容器镜像。
3. 启动命令设置为 `node`，启动参数设置为 `server.js`。如果控制台只有一个命令输入框，填写 `node server.js`。监听端口设为 `9000`。
4. 设置 `TARGET_URL`，部署后启用 HTTP 访问入口。绑定自定义域名时，将根路径及所有子路径映射到该函数。

[阿里云 Web 函数文档](https://help.aliyun.com/zh/functioncompute/creating-a-web-function)

## 腾讯云 SCF

1. 在与云函数匹配的地域准备腾讯云容器镜像服务（TCR）仓库。用实际仓库地址替换下方示例。

   ```bash
   docker build --platform linux/amd64 -t REGISTRY/NAMESPACE/relay:v1 .
   docker push REGISTRY/NAMESPACE/relay:v1
   ```

2. 在 SCF 创建 WebServer 镜像函数，选择已推送的镜像，保留镜像的默认启动命令。函数会监听 `0.0.0.0:9000`。
3. 设置 `TARGET_URL`，开启 HTTP 访问入口。绑定自定义域名时，将根路径及所有子路径映射到该函数。

[腾讯云 WebServer 镜像函数文档](https://cloud.tencent.com/document/product/583/56051)

## 通用 Node.js 和容器

```bash
TARGET_URL=https://upstream.example.com npm start
```

```bash
docker build -t pages-relay .
docker run --rm -p 9000:9000 -e TARGET_URL=https://upstream.example.com pages-relay
```

如果前面有 CDN 或网关，请让它覆盖客户端提供的 `X-Forwarded-Host` 和 `X-Forwarded-Proto`，填入公开域名和协议。Node.js 入口使用这两个值来构造对外的重定向地址。

## 纯静态 Pages

GitHub Pages、OSS 或 COS 的静态网站托管只能发布文件。可以把自定义域名直接绑定到上述函数，或让具备反向代理能力的 CDN 或网关将所有路径转发到函数。仓库中的 `dist` 目录自身无法执行中转。

Cloudflare Pages 入口处理 WebSocket 升级。其他入口提供 HTTP 转发，上传大小、请求时长和响应流式传输还受各平台入口限制。
