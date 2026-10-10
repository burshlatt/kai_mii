FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY sql ./sql
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
