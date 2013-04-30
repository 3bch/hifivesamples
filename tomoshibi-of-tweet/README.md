# Tweet の灯

hifive や html5 関連の技術の勉強のために作った
[Tweetping](http://www.tweetping.net/) の日本限定版です。


作成には以下のサービスを参考にしました。

- [Firefoxの灯](http://tomoshibi.mozilla.jp/)
- [Tweetping](http://www.tweetping.net/)


## 動かし方

1. Node.js をインストールする
2. このディレクトリに移動して `npm install` コマンドを実行し、依存するライブラリをダウンロードする
3. twitter-oauth.json.sample を参考に twitter API を利用するための情報を twitter-oauth.json に記述する
4. このディレクトリで `node server` コマンドを実行し、サーバを起動する


## 利用している技術

Tweet の灯は以下の技術を利用して作られています。

### サーバサイド

- [Node.js](http://nodejs.org/) : サーバ
- [Socket.IO](http://socket.io/) : サーバプッシュ

### クライアントサイド

- [hifive](http://www.htmlhifive.com/conts/web/view/Main/WebHome) : MVC フレームワーク
- [D3.js](http://d3js.org/) : 地図 SVG 作成、緯度経度から X, Y 座標への変換
- [CreateJS](http://www.createjs.com/#!/CreateJS) : 灯の描画

