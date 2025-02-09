FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

RUN npx prisma generate


EXPOSE 4000


CMD ["sh", "-c", "npm run db:deploy && npm start"]
