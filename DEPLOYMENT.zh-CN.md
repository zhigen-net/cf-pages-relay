# 多平台部署

为运行反向代理的服务设置 `TARGET_URL`，例如 `https://upstream.example.com`。可选的 `HEALTH_PATH` 默认是 `/__healthz`。部署后访问该路径确认服务启动，再用一个实际业务路径确认上游可达。健康检查在本地返回。

| 平台 | 部署方式 | 监听端口或配置 |
| --- | --- | --- |
| 阿里云 ESA Pages | 从 GitHub 导入，使用 `esa.jsonc` 和 `esa/index.js` | 设置运行时函数变量 `TARGET_URL` |
| 腾讯云 EdgeOne Pages | 从 Git 导入，使用 `edgeone.json` 和 `cloud-functions/` | 设置项目环境变量 `TARGET_URL` |
| Cloudflare Pages | 从 Git 导入仓库 | Framework preset 选 None，构建命令留空，输出目录 `dist` |
| 阿里云函数计算 FC | Web 函数，上传下方代码包或使用容器镜像 | `9000` |
| 腾讯云 SCF | WebServer 镜像函数，使用仓库的 `Dockerfile` | `9000` |
| Vercel | 从 Git 导入仓库 | 自动识别 `server.ts`，使用 Node.js 22 或更新版本 |
| Netlify | 从 Git 导入仓库 | 使用仓库的 `netlify.toml`，给 Functions 作用域设置 `TARGET_URL` |
| 其他 Node.js 或容器平台 | Node.js 22+，启动命令 `npm start`，或构建 Docker 镜像 | `PORT`，默认 `9000` |

## 阿里云 ESA Pages

1. 在 ESA 控制台进入「边缘计算和 AI → 函数和 Pages」，创建 Pages 并从 GitHub 导入本仓库。选择 `main`，根目录使用仓库根目录。
2. 仓库的 `esa.jsonc` 将 `esa/index.js` 设为边缘函数入口。这个项目只需要函数入口，静态资源目录留空。
3. 在项目的「基本信息 → 函数变量」给生产环境添加 `TARGET_URL`，然后发布生产版本。测试分支使用测试环境自己的变量。修改变量后重新发布。
4. 用 Pages 访问域名验证 `/__healthz`、`/` 和业务子路径，再绑定自定义域名。

[ESA Pages 构建与路由](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/build-pages) · [运行时函数变量](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/function-variable)

## 腾讯云 EdgeOne Pages

1. 在 EdgeOne Pages 导入本仓库，选择 `main`，使用仓库根目录。选择静态或 Other 预设，构建命令留空，输出目录为 `dist`，仓库的 `edgeone.json` 已声明该目录。
2. 在项目的环境变量中添加 `TARGET_URL`，然后部署或重新部署。Cloud Functions 通过 `context.env` 读取变量。
3. `cloud-functions/index.js` 处理根路径，`cloud-functions/[[default]].js` 处理业务子路径。使用项目域名验证根路径、带查询参数的子路径和 `/__healthz`。

EdgeOne Pages 使用 Node.js Cloud Functions。平台文档列出的请求与响应体上限为 6 MB。若项目原先部署了旧版 Edge Functions，需要重新部署当前分支，使原有 API 路径改由 Cloud Functions 处理。重新部署后，可用实际 API 路径发送一个超过 1 MB 且低于 6 MB 的有效请求来验证。

内联 Base64 图片或音频会增加约三分之一的数据量，平台上限按整个请求体计算。上游支持文件 URL 时，可先上传到对象存储，再传 URL。Models 网关的 25 MB 上限适用于通过该服务发起的模型调用，现有 `TARGET_URL` 的通用中转仍走 Cloud Functions。

[EdgeOne Cloud Functions 限制](https://pages.edgeone.ai/document/cloud-functions) · [Node.js 函数路由](https://pages.edgeone.ai/document/node-functions) · [EdgeOne Pages 配置文件](https://pages.edgeone.ai/zh/document/edgeone-json)

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
