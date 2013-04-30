/* jshint node: true, camelcase: false*/
'use strict';

// --- 外部モジュールの参照 --- //
var http = require('http');

var express = require('express');
var Twit = require('twit');
var socketIO = require('socket.io');


// --- 値の定義 --- //
var port = process.env.PORT || 3000;
var japanLocation = ['122', '20', '154', '46'];


// --- 初期化 --- //
var app = express();
var server = http.createServer(app);
var io = socketIO.listen(server);

var twit = new Twit(require('./twitter-oauth.json'));

io.set('log level', 2);


// --- Express --- //
app.use(express.static(__dirname + '/public'));


// --- Twitter --- //
var stream = twit.stream('statuses/filter', {
    locations: japanLocation
});

stream.on('tweet', function (tweet) {
    if (!tweet.coordinates) {
        return;
    }
    var obj = {
        id: tweet.id,
        text: tweet.text,
        user: tweet.user.screen_name,
        coordinates: tweet.coordinates,
        source: tweet.source
    };
    io.sockets.json.emit('tweet', obj);
});

stream.on('disconnect', function () {
    console.log('disconnect twitter');
});

stream.on('reconnect', function () {
    console.log('reconnect twitter');
});


// --- サーバ起動 --- //
server.listen(port);
console.log('Start Server: [' + port + ']');
