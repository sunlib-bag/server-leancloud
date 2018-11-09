var AV = require('leanengine');
var xlsx = require('node-xlsx');
var fs = require('fs');



AV.Cloud.define('getExcelInfo', function (req, res) {
    verifyLogin(req, res, function (currentUser) {
        getAllData(req,res);
    });
});

//获取所有的识字助手数据
function getAllData(req,res) {
    var allData = [];
    var num = 1;
    var dateRange = req.params.dateRange;
    var queryData = dataQuery(req);
    queryData.find().then(function (userActions) {
        userActions.map(function (userData) {
            allData.push(userData);
        });
        if (userActions.length == 1000)
        {
            getNextData(allData, num, res,req);
        }
        else {
            //数据少于1000条，开始向下处理
            dataHandler(dateRange,allData, res);
        }
    });
}
function dataQuery(req) {
    var queryData = new AV.Query('LearnLetterHelpUserAction');
    var dateRange = req.params.dateRange;
    if (dateRange.length == 2) {
        var startDate = dateRange[0];
        var endDate = dateRange[1];
        var startQuery = new AV.Query('LearnLetterHelpUserAction');
        startQuery.greaterThanOrEqualTo('createdAt',new Date(startDate));
        var endDateQuery = new AV.Query('LearnLetterHelpUserAction');
        endDateQuery.lessThan('createdAt', new Date(endDate));
        queryData = AV.Query.and(startQuery, endDateQuery);
    }
    queryData.limit(1000);
    return queryData;
}
function getNextData(allData, num, res,req) {
    var dateRange = req.params.dateRange;
    var queryData = dataQuery(req)
    queryData.skip(1000 * num);
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
            dataHandler(dateRange,allData, res);
        }
    })
}
AV.Cloud.define('saveLearnLetterUserAction', function (req, res) {
    var userAction = req.params.userAction;
    console.log(userAction)
    console.log(req.meta.remoteAddress)
    var LearnLetterHelpUserAction = AV.Object.extend('LearnLetterHelpUserAction');
    var learnLetterHelpUserAction = new LearnLetterHelpUserAction();
    // var LearnLetterHelpUserAction = AV.Object.extend('LearnLetterHelpUserAction');
    // var learnLetterHelpUserAction =  new LearnLetterHelpUserAction();
    // 新建一个 Todo 对象
    learnLetterHelpUserAction.set('gradeBookName' , userAction.gradeBookName);
    learnLetterHelpUserAction.set('learnBlockHtml' , userAction.learnBlockHtml);
    learnLetterHelpUserAction.set('courseName' , userAction.courseName);
    learnLetterHelpUserAction.set('usageTime' ,  userAction.usageTime);
    learnLetterHelpUserAction.set('ip' , req.meta.remoteAddress);
    learnLetterHelpUserAction.save().then(function (todo) {
        // 成功保存之后，执行其他逻辑.
        console.log('New object created with objectId: ' + todo.id);
        return res.success({status: 200, data: todo});
    }, function (error) {
        return res.success({status: 401, data: error});
    });
});



function dataHandler(dateRange,value, res) {

    var allData = [{name:'澡宝宝幼儿阅读识字',data:[]},
        {name:'小学语文一年级上册',data:[]},
        {name:'小学语文一年级下册',data:[]},
        {name:'小学语文二年级上册',data:[]},
        {name:'小学语文二年级下册',data:[]}];

    //将获取的数据分科目
    value.map(function(userAction){
        var userActionInfo = userAction.toJSON();
        var index = allData.findIndex(function(item){
            return item.name == userActionInfo.gradeBookName;
        });
        userActionInfo.courseName = userActionInfo.courseName.replace(/&nbsp/g, "");
        allData[index].data.push(userActionInfo);
        return userActionInfo
    });
    var currentDate = dateRange[0];
    var endDate = dateRange[1];
    var keyDates = [];
    //获取所有时间键值（2018-09-12）
    while (currentDate<endDate)
    {
        var strDate = new Date(currentDate).Format("yyyy-MM-dd");
        keyDates.push(strDate);
        currentDate = currentDate+24*60*60*1000;
    }
    console.log(keyDates)//日期数组

    //将每科的数据处理成某个日期某节课程的时长统计
    for (var j = 0; j < allData.length; j ++)
    {
        var courseInfos = allData[j].data;
        var allCourseAndSectionKeys = [];
        for (var i = 0; i < courseInfos.length; i ++)
        {
            var courseAndSection = courseInfos[i].courseName + courseInfos[i].learnBlockHtml;
            var index = allCourseAndSectionKeys.indexOf(courseAndSection)
            if (index == -1)
            {
                allCourseAndSectionKeys.push(courseAndSection);//将所有的章节加入到里面
            }
        }
        var arrDatas = [];//将数据处理之后的存储位置
        allCourseAndSectionKeys.map(function (courseSection) {
            var item = {'课程/时间':courseSection};
            keyDates.map(function (dateKeyTmp) {
                item[dateKeyTmp] = 0;
            })
            arrDatas.push(item);
        });
        for (var m = 0; m < keyDates.length; m ++)
        {
            var keyDate = keyDates[m];
            for (var n = 0; n < allCourseAndSectionKeys.length; n ++)
            {
                var courseAndSectionKey = allCourseAndSectionKeys[n];
                var validInfos = courseInfos.filter(function (action) {
                    var formatDate = new Date(action.createdAt).Format('yyyy-MM-dd');
                    return action.courseName+action.learnBlockHtml == courseAndSectionKey && formatDate == keyDate;
                })
                var totalUsageTime = 0;
                validInfos.map(function (info) {
                    totalUsageTime += Number(info.usageTime);
                })
                //将一条数据填进去
                arrDatas[n][keyDate] = totalUsageTime;
            }
        }

        var allValidData = arrDatas.length > 0 ? [Object.keys(arrDatas[0])] : [];
        for (var i = 0; i < arrDatas.length; i ++)
        {
            var arrUsageTimeList = Object.values(arrDatas[i]);
            allValidData.push(arrUsageTimeList)
        }
        //将处理后的数据替换掉
        allData[j].data = allValidData

    }
    //统计ip每天访问的数量
    var dateIPCount = getDayUserCount(keyDates,value);

    keyDates.unshift('人数/日期');
    allData.push({name:'每天的访问人数统计',data:[keyDates,dateIPCount]});
    creatExcel(allData, res);
}
function getDayUserCount(keyDates,value){
    var dateIPCount = ['数量'];
    for (var h = 0;h < keyDates.length; h ++){
        var dateDataInfoWithIPs = value.filter(function (data) {
            var formatDate = new Date(data.createdAt).Format('yyyy-MM-dd');
            return formatDate == keyDates[h];
        });
        console.log(dateDataInfoWithIPs);
        var arrUniqIPs = [];
        for(var m = 0;m < dateDataInfoWithIPs.length; m ++)
        {
            var dataInfo = dateDataInfoWithIPs[m].toJSON();
            console.log(dataInfo.ip)
            if (dataInfo.ip)
            {
                var filterInfo = arrUniqIPs.filter(function (item) {
                    return item.ip == dataInfo.ip;
                })
                if (filterInfo.length == 0)
                {
                    arrUniqIPs.push(dataInfo);
                }
            }
        }
        dateIPCount.push(arrUniqIPs.length.toString());
    }
    return dateIPCount;
}
Date.prototype.Format = function (fmt) { //author: meizz
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

function creatExcel(allData, res) {
    // var buffer = xlsx.build([{name: '表哥', data: allData}]);
    var buffer = xlsx.build(allData);
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
