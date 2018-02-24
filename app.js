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

app.get('/', function (req, res) {
    res.render('../public/index.html');
});

// app.get('/', index);

var download = require('download');
var fs = require('fs.extra');
var path = require('path');
var archiver = require('archiver-promise');


app.get('/requestSmsCode', function (req, res) {

    var phoneNumber = {
        'phoneNumber': req.query.phoneNumber
    };

    AV.Cloud.run('requestSmsCode', phoneNumber).then(
        function (value) {
            res.send(value)
        },function (error) {
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


app.get('/pack', function (req, res) {
    //这里对调用接口的用户进行验证，获取phoneNumber的参数----------->
    console.log(req);
    var lessonFilesData = {
        'lesson_id': req.query.lessonId
    };
    //开始调用验证云函数进行验证----------->
    // AV.Cloud.run('requestSmsCode', phoneNumber).then(
    //     function (value) {
    //         if(value == 'ok'){
    //             startPack();
    //             // res.send('用户验证成功，开始打包！')
    //         }else {
    //             res.send(value)
    //         }
    //     },function (error) {
    //         console.log(error);
    //         res.send(error)
    //     }
    // );
    //这里是调用打包云函数的方法 ------->
    function startPack() {
        console.log('开始进入打包云函数' + JSON.stringify(lessonFilesData));
        AV.Cloud.run('pack', lessonFilesData).then(
            function (value) {
                res.send(value)
            }, function (error) {
                console.log(error);
                res.send(error)
            }
        )
    }
    //一直到这里 <-------

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
