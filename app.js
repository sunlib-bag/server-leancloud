'use strict';

var express = require('express');
var timeout = require('connect-timeout');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AV = require('leanengine');

// var index = require('./routes/index.js');

// 加载云函数定义，你可以将云函数拆分到多个文件方便管理，但需要在主文件中加载它们
require('./cloud');
require('./test');

var app = express();

// 设置模板引擎
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
// app.set('view engine', 'ejs');
app.set('view engine', 'html');

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

//设置多个域名跨域请求
// app.all('*', function(req, res, next) {
//     if( req.headers.origin == 'http://sl-bag.leanapp.cn/' || req.headers.origin == 'http://sl-bag-test.leanapp.cn/' ){
//         res.header("Access-Control-Allow-Origin", req.headers.origin);
//         res.header('Access-Control-Allow-Methods', 'POST, GET');
//         res.header('Access-Control-Allow-Headers', 'X-Requested-With');
//         res.header('Access-Control-Allow-Headers', 'Content-Type');
//     }
//     next();
// });

app.get('/', function (req, res) {
    res.render('../public/index.html');
});


app.get('/requestSmsCode', function (req, res) {

    var phoneNumber = {
        'phoneNumber': req.query.phoneNumber
    };

    AV.Cloud.run('requestSmsCode', phoneNumber).then(
        function (value) {
            res.send(value)
        }, function (error) {
            console.log(error);
            res.send(error)
        }
    )

});


app.get('/test', function (req, res) {
    AV.Cloud.run('hello', {}).then(function (value) {
        res.send(value)
    })
});

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
