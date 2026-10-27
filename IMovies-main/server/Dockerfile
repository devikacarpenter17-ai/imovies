FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .
EXPOSE 5000

# seed.js only adds demo data when the database is empty, so it is safe on every start
CMD ["sh", "-c", "node seed.js && node server.js"]
