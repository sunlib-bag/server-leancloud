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
        startQuery.greaterThanOrEqualTo('createdAt',startDate);
        var endDateQuery = new AV.Query('LearnLetterHelpUserAction');
        endDateQuery.lessThan('createdAt', endDate);
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

function dataHandler1(dateRange,value, res) {
    var allData = [];
    console.log(value)
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
        // userActionInfo.createdAt = userActionInfo.createdAt.Format("yyyy-MM-dd");
        allData[index].data.push(userActionInfo);
        return userActionInfo
    });
    console.log(allData.toString())
    var currentDate = dateRange[0];
    var endDate = dateRange[1];
    // var currentDate = new Date('2018-10-22');
    // var endDate = new Date('2018-11-03');
    var keyDates = [];
    console.log(currentDate<endDate)
    //获取所有时间键值（2018-09-12）
    while (currentDate<endDate)
    {
        var strDate = currentDate.Format("yyyy-MM-dd");
        keyDates.push(strDate);
        currentDate.setTime(currentDate.getTime()+24*60*60*1000);
    }

    console.log(keyDates)

    //将每科的数据处理成某个日期某节课程的时长统计
    for (var j = 0; j < allData.length; j ++)
    {
        var courseInfos = allData[j].data;
        var allCourseAndSectionKeys = [];
        for (var i = 0; i < courseInfos.length; i ++)
        {
            var courseAndSection = courseInfos[i].courseName + courseInfos[i].learnBlockHtml;
            console.log(courseAndSection)
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
    console.log(171)
    console.log(allData);
    creatExcel(allData, res);
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
    console.log('======185')
    console.log(allData)
    // var buffer = xlsx.build([{name: '表哥', data: allData}]);
    var buffer = xlsx.build(allData);
    console.log('======188')
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
