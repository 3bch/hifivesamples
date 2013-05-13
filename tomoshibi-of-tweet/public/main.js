/* jshint browser: true, jquery: true */
/* global io, h5, d3, topojson, createjs */

$(function () {
    'use strict';

    // --- 定数 --- //
    var rgba = createjs.Graphics.getRGB;

    var mapScale = 2.7;

    var tomoshibiPointColor = rgba(0xFFFFFF, 0.5);
    var tomoshibiLineColor  = rgba(0x66AADD, 0.05);
    var tomoshibiLineLength = 12;

    var logger = h5.log.createLogger('tomoshibi-of-tweet');


    // --- Socket.IO 初期化 --- //
    var socket = io.connect();


    // --- hifive データモデル定義 --- //
    var manager = h5.core.data.createManager('DataManager');

    var tweetAreaModel = manager.createModel({
        name: 'TweetAreaModel',
        schema: {
            id: {
                id: true,
                type: 'integer',
                min: 0,
                max: 47
            },

            name: {
                type: 'string',
                constraint: {
                    notNull: true
                }
            },

            tweetCount: {
                type: 'integer',
                defaultValue: 0,
                constraint: {
                    notNull: true,
                    min: 0
                }
            },

            lastTweetText: {
                type: 'string'
            },

            lastTweetUser: {
                type: 'string'
            }

        }
    });

    // --- DataModel ラップクラス定義 --- //
    function TweetArea(source) {
        this._data = tweetAreaModel.create(source);
    }

    TweetArea.prototype = {
        addTweet: function (tweet) {
            var data = this._data;

            var beforeCount = data.get('tweetCount');
            data.set('tweetCount', beforeCount + 1);

            data.set('lastTweetText', tweet.text);
            data.set('lastTweetUser', tweet.user);
        },

        getModel: function () {
            return this._data;
        }
    };


    function Models(japan) {
        this._japan = new TweetArea({ id: 0, name: 'japan' });
        var prefectures = this._prefectures = {};

        japan.geometries.forEach(function (geometory) {
            var id = geometory.properties.code;
            var prefecture = new TweetArea({
                id: id,
                name: geometory.id
            });
            prefectures[id] = prefecture;
        });

        // 正積図法
        var geo = this.geo = {};
        geo.projection = d3.geo.conicEqualArea()
                               .parallels([20, 40])
                               .rotate([-137, -37, 0]);

        geo.path = d3.geo.path().projection(geo.projection);
    }

    Models.prototype = {
        resize: function (size) {
            this.geo.projection.translate([size / 2, size / 2])
                               .scale(size * mapScale);
        },

        addTweet: function (code, tweet) {
            this._japan.addTweet(tweet);
            this._prefectures[code].addTweet(tweet);
        },

        getPrefecture: function (code) {
            return this._prefectures[code].getModel();
        },

        getJapan: function () {
            return this._japan._data;
        }
    };


    // --- Controller 定義 --- //
    function bindController(json) {
        var japan = topojson.object(json, json.objects.japan);
        var models = new Models(japan);

        var controller = {
            __name: 'MainController',

            // 今回は Deferred を利用しないので Logic としなかった
            _models: models,

            _binding: null,

            '#capture-svg > path mouseover': function (context, $elem) {
                this._selectPrefecture($elem.data('code'));
            },

            '#capture-svg > path mouseout': function () {
                this._selectJapan();
            },

            __ready: function () {
                var canvas = this._canvas = this.$find('#tomoshibi-canvas')[0];
                var viewSvg = this._viewSvg = this.$find('#view-svg')[0];
                var captureSvg = this._captureSvg = this.$find('#capture-svg')[0];
                this._stage = new createjs.Stage(canvas);

                this._resize();

                var geo = this._models.geo;
                var svg = d3.selectAll([captureSvg, viewSvg]);

                // 日本全体の描画(海岸線の処理の必要)
                svg.append('path')
                   .datum(japan)
                   .attr('class', 'land-all')
                   .attr('d', geo.path);

                // 県単位の描画
                svg.selectAll('.land')
                   .data(japan.geometries)
                   .enter()
                   .append('path')
                   .attr('class', 'land')
                   .attr('data-name', function (d) { return d.id; })
                   .attr('data-code', function (d) { return parseInt(d.properties.code, 10); })
                   .attr('d', geo.path);

                // socket.io の設定
                socket.on('tweet', this.own(function (tweet) {
                    var coordinate = tweet.coordinates.coordinates;
                    var code = this._searchPrefecture(coordinate);
                    if (!code) {
                        return;
                    }
                    this._models.addTweet(code, tweet);
                    this._drawTomoshibi(coordinate);
                }));

                this._selectJapan();
                $(this.rootElement).css('visibility', 'visible');
                $('#refInfo').css('visibility', 'visible');
            },

            _resize: function () {
                var $window = $(window);
                var width = $window.width();
                // 地図とAPIの利用元の表示で 50px 使う
                var height = $window.height() - 50;

                var size = this._size = (width < height) ? width : height;


                var root = this.rootElement;
                $([root, this._canvas, this._captureSvg, this._viewSvg])
                    .width(size)
                    .height(size)
                    .filter('canvas, svg')
                    .attr('width', size)
                    .attr('height', size);

                this._position = $(root).offset();
                this._models.resize(size);
            },

            _drawTomoshibi: function (coordinate) {
                var projection = this._models.geo.projection;

                var point = projection(coordinate);
                var x = point[0];
                var y = point[1];

                // 中央に点を描く
                var shape = new createjs.Shape();
                shape.graphics
                     .beginFill(tomoshibiPointColor)
                     .drawCircle(x, y, 0.5);

                var stage = this._stage;
                stage.addChild(shape);

                // 線を描く
                for (var i = 0; i < 3; i += 1) {
                    stage.addChild(this._makeLine(x, y));
                }

                // 最後のまとめて update
                stage.update();
            },

            _makeLine: function (x, y) {
                var angle = Math.random() * Math.PI * 2;
                var endX = x + Math.cos(angle) * tomoshibiLineLength;
                var endY = y + Math.sin(angle) * tomoshibiLineLength;

                var shape = new createjs.Shape();
                shape.graphics
                     .moveTo(x, y)
                     .beginStroke(tomoshibiLineColor)
                     .lineTo(endX, endY);

                return shape;
            },

            _searchPrefecture: function (coordinate) {
                var projection = this._models.geo.projection;
                var pos = this._position;

                var point = projection(coordinate);
                var x = point[0] + pos.left;
                var y = point[1] + pos.top;

                var elem = document.elementFromPoint(x, y);
                if (!elem || elem.tagName !== 'path') {
                    return null;
                }

                return $(elem).data('code');
            },

            _selectPrefecture: function (code) {
                var $view = $(this._viewSvg).children('path');

                // svg 要素は jQuery の addClass が使えない
                $view.each(function (index, elem) {
                    var selected = $(elem).data('code') === code;
                    d3.select(elem).classed('selected', selected);
                });

                var prefecture = this._models.getPrefecture(code);
                this._bindTweetArea(prefecture);
            },

            _selectJapan: function () {
                // svg 要素は jQuery の removeClass が使えない
                $(this._viewSvg).children('path')
                                .each(function (index, elem) {
                                    d3.select(elem).classed('selected', false);
                                });

                var japan = this._models.getJapan();
                this._bindTweetArea(japan);
            },

            _bindTweetArea: function (area) {
                if (this._binding) {
                    this._binding.unbind();
                }
                this._binding = h5.core.view.bind('#selectedAreaInfo', area);
            }
        };

        h5.core.controller('#content', controller);
    }



    // --- 日本の座標情報をロード後の処理 --- //
    d3.json('/map/japan.topo.json', function (err, json) {
        if (err) {
            logger.error('topo.json のロードに失敗');
            throw err;
        }
        bindController(json);
    });
});
