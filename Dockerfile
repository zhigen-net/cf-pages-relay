FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json server.js node-handler.js ./
COPY functions/ ./functions/
USER node
ENV PORT=9000
EXPOSE 9000
CMD ["node", "server.js"]
