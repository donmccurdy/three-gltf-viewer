FROM alpine 

RUN apk add nodejs npm python3 bash make g++ util-linux

WORKDIR /app
COPY . .

RUN npm install

CMD npm run dev