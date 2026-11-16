# Serveur relais de LIORA (assistant, scan d'humeur, actualités).
# À construire depuis la racine du projet, car le serveur partage du code
# avec l'application (dossier « shared ») :
#   docker build -t liora-relais .
#   docker run --env-file server/.env -p 8787:8787 liora-relais

FROM node:22-slim AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY shared ./shared
# Le serveur tourne sans droits d'administration.
USER node
WORKDIR /app/server
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.ts"]
