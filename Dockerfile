FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node . .
USER node
EXPOSE 4310
CMD ["node", "server/http.mjs"]
