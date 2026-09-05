FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY server.js ./
COPY dist ./dist

EXPOSE 8080 10000 3000 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
