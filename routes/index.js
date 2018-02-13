var express = require('express');
var router = express.Router();


var path = require('path');

router.get('/', function (req, res, next) {
    res.render(path(__dirname, '../public/cmsPublic/index.html'));
    console.log('开始进入应用！')
})