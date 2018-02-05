'use strict';

var express = require('express');
var timeout = require('connect-timeout');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AV = require('leanengine');

// 加载云函数定义，你可以将云函数拆分到多个文件方便管理，但需要在主文件中加载它们
require('./cloud');

var app = express();

// 设置模板引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static('public'));

// 设置默认超时时间
app.use(timeout('15s'));

// 加载云引擎中间件
app.use(AV.express());

app.enable('trust proxy');
// 需要重定向到 HTTPS 可去除下一行的注释。
// app.use(AV.Cloud.HttpsRedirect());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());

app.get('/', function (req, res) {
    res.render('index', {currentTime: new Date()});
});

var download = require('download')
var fs = require('fs.extra');
var path = require('path')
var archiver = require('archiver-promise');

app.get('/testpack', function (req, res) {
    var lesson_id = 'sadfasdfsdafadsfsf'
    var files = [
        {
            "id": "5a70244d1b69e6003c5380ae",
            "url": "http://ac-cqbvih8f.clouddn.com/9bdb0f354d3829aa54c8.png"
        },
        {
            "id": "5a701fe11b69e6003c5361ba",
            "url": "http://ac-cqbvih8f.clouddn.com/d419d4ad36a738679e05.png"
        },
        {
            "id": "5a701fd3a22b9d003d14c6f1",
            "url": "http://ac-cqbvih8f.clouddn.com/813ff9b1c64b926d1840.png"
        }
    ]

    if (!fs.existsSync('download')) {
        fs.mkdirSync('download')
    }
    fs.rmrfSync(path.join('download', lesson_id))
    fs.mkdirSync(path.join('download', lesson_id))
    var promises = []
    files.forEach(function (v, k) {
        promises.push(download(v.url))
    })
    Promise.all(promises)
        .then(function (results) {
            var archive = archiver(path.join('download', lesson_id + '.zip'), {
                store: true
            });
            files.forEach(function (v, k) {
                console.log('downloaded', v)
                var filename = path.join('download', lesson_id, v.id)
                fs.writeFileSync(filename, results[k])
                archive.file(filename, {name: 'files/' + v.id});
            })

            archive.finalize()
                .then(function () {
                    res.send('ok')
                })

        })

});

// 可以将一类的路由单独保存在一个文件中
app.use('/todos', require('./routes/todos'));

app.use(function (req, res, next) {
    // 如果任何一个路由都没有返回响应，则抛出一个 404 异常给后续的异常处理器
    if (!res.headersSent) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }
});

// error handlers
app.use(function (err, req, res, next) {
    if (req.timedout && req.headers.upgrade === 'websocket') {
        // 忽略 websocket 的超时
        return;
    }

    var statusCode = err.status || 500;
    if (statusCode === 500) {
        console.error(err.stack || err);
    }
    if (req.timedout) {
        console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
    }
    res.status(statusCode);
    // 默认不输出异常详情
    var error = {};
    if (app.get('env') === 'development') {
        // 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
        error = err;
    }
    res.render('error', {
        message: err.message,
        error: error
    });
});

module.exports = app;
