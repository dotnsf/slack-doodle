# https://nodejs.org/ja/docs/guides/nodejs-docker-webapp/

# base image
#FROM node:16-alpine
FROM node:16-alpine

# install python for later fonts
#RUN apk add --no-cache python3 make g++

# working directory
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080
CMD ["node", "app.js"]



