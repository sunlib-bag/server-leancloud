var AV = require('leanengine');
var xlsx = require('node-xlsx');
var fs = require('fs');



AV.Cloud.define('getExcelInfo', function (req, res) {
    verifyLogin(req, res, function (currentUser) {
        getAllData(res); 
    });
});

//获取所有的识字助手数据
function getAllData(res) {
    var allData = [];
    var num = 1;
    var queryData = new AV.Query('LearnLetterHelpUserAction');
    queryData.limit(1000);
    queryData.find().then(function (value) {
        for(var i=0;i<value.length;i++){
            allData.push(value[i])
        }
        if(value.length >= 1000){
            //继续获取数据
            getNextData(allData, num, res);
        }else {
            //数据少于1000条，开始向下处理
            dataHandler(allData, res);
        }
    })
}

function getNextData(allData, num, res) {
    var queryData = new AV.Query('LearnLetterHelpUserAction');
    queryData.limit(1000 * num);
    queryData.find().then(function (value) {
        for(var i=0;i<value.length;i++){
            allData.push(value[i])
        }
        if(value.length == 1000){
            //继续获取数据
            num = num + 1;
            getNextData(allData, num, res);
        }else {
            //数据少于1000条，开始向下处理
            dataHandler(allData, res);
        }
    })
}

function dataHandler(value, res) {
    var allData = [];
    for(var i=0;i<value.length;i++){
        var data = value[i];
        var info = [];
        info.push(data.id);
        info.push(data.attributes.gradeBookName);
        info.push(data.attributes.usageTime);
        info.push(data.attributes.learnBlockHtml);
        info.push(data.attributes.courseName);
        info.push(data.createdAt);
        info.push(data.updatedAt);
        allData.push(info);
    }
    creatExcel(allData, res);
}

function creatExcel(allData, res) {
    var buffer = xlsx.build([{name: "sheet1", data: allData}]);
    fs.writeFileSync('./SZZS.xlsx', buffer);
    uploadFile(res);
}

function uploadFile(res) {
    fs.readFile('./SZZS.xlsx', function (err, data) {
        var file = new AV.File('SZZS.xlsx', data);
        file.save().then(function(file) {
            // 文件保存成功
            console.log(file.url());
            res.success({status: 200, data: file.url()});
        }, function(error) {
            // 异常处理
            console.error(error);
            res.success({status: 201, data: error});
        });
    })
}

//验证用户登录
function verifyLogin(req, res, cb) {
    if (!req.currentUser) {
        return res.success({status: false, message: '用户未登录'})
    }
    var currentUser = req.currentUser;
    return cb(currentUser);
}