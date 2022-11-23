FROM node:16-alpine

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install
RUN npm update
COPY . .
COPY ./node_modules/extract-files/package.json ./node_modules/extract-files/package.json
ENTRYPOINT ["npm", "run", "dev"]
