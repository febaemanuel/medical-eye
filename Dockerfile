FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --chown=node:node server server
COPY --chown=node:node web web
USER node
EXPOSE 4310
CMD ["node", "server/http.mjs"]
