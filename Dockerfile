FROM node:22-slim

WORKDIR /app
COPY package.json ./
COPY . .

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
