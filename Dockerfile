# Node.js 24.x のAlpine Linuxイメージをベースにする
FROM node:24-alpine

# 必要なパッケージをインストール (tokei用)
RUN apk update && apk add --no-cache \
    tokei \
    git

# 作業ディレクトリを作成
WORKDIR /usr/src/app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# アプリケーションのソースコードをコピー
COPY . .

RUN npm run build

EXPOSE 4111
ENV PORT=4111

ENV HOSTNAME="0.0.0.0"

# アプリケーションを起動
CMD ["npm", "start"]

