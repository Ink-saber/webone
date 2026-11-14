# 后端容器说明
#
# 为什么需要这个文件：
# 仓库根目录有 index.html，Railway 会默认把整个仓库当成静态网站发布，
# 导致 /api/... 全部 404。放了 Dockerfile 之后，Railway 会优先用 Docker 构建，
# 明确只跑 server/ 里的 Node 程序。
#
# 存储用的是纯 JS 的 JSON 文件（server/store.js），不依赖 node:sqlite，
# 所以对 Node 版本没有硬要求，这里取 24 只是求稳。

FROM node:24-alpine

WORKDIR /app

# 先只拷依赖清单，利用 Docker 层缓存：代码改了不用重装依赖
COPY server/package.json server/package-lock.json ./
RUN npm install --omit=dev

# 再拷源码
COPY server/index.js server/store.js ./

ENV NODE_ENV=production

# 端口由平台通过 PORT 环境变量注入，代码里会读 process.env.PORT
CMD ["node", "index.js"]
