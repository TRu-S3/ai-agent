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

# Cloud Runはデフォルトで8080ポートを期待しますが、PORTで動的に設定されます
EXPOSE 8080

# Cloud Runが設定するPORT環境変数を使用（デフォルトは8080）
# ENV PORT=8080 # Cloud Runでは自動で設定されるため、この行は必須ではありません

ENV HOSTNAME="0.0.0.0"

# アプリケーションを起動 (修正箇所)
CMD ["npm", "run", "start"]