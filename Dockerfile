FROM mhart/alpine-node:16

WORKDIR /usr/src/app

COPY package*.json ./

# dependencies
RUN npm install

# source codes
COPY . .

EXPOSE 3000

CMD ["node" , "index.js"]