var AV = require('leanengine');
var download = require('download');
var fs = require('fs.extra');
var path = require('path');
var archiver = require('archiver-promise');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function (request) {
    return 'Hello wangyongfei!';
});


//这里是一个限制登录的云函数------>
AV.Cloud.define('requestSmsCode', function (request) {

    var phoneNumber = request.params.phoneNumber;
    var phonesArr = [];
    var query = new AV.Query('_User');
    return query.find().then(function (value) {

        value.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });

        console.log(phonesArr);

        if (phonesArr.indexOf(phoneNumber) != -1) {
            console.log('ok');
            return 'ok'
        } else {
            console.log('is not user');
            return 'is not user'
        }
        //用户手机号的集合
    }, function (error) {
        console.log(error);
    });

});
//一直到这里结束<-------------


//这里是发布打包的云函数------------->
AV.Cloud.define('pack', function (request) {   //打包

    var lesson_id = request.params.lesson_id;

    var manifestData = {};
    var materials = [];
    //这里开始查询该课程id下的所有内容---
    manifestData.id = lesson_id;    //这里将课程id添加json

    queryAllData(manifestData, materials);

    function queryAllData(manifestData, materials) {
        var queryAll = new AV.Query('Lesson');
        queryAll.get(lesson_id).then(function (dataAll) {
            var lessonPlan_id = dataAll.attributes.plan.id;
            //根据记录的lessonPlan_id查询课程下的lessonPlan
            var queryLessonPlan = new AV.Query('LessonPlan');
            queryLessonPlan.get(lessonPlan_id).then(function (dataLessonPlan) {
                // console.log(dataLessonPlan.attributes.title);

                manifestData.title = dataLessonPlan.attributes.title;   //这里将title添加到json
                manifestData.content = dataLessonPlan.attributes.content;   //这里将content添加到json
                manifestData.author = dataLessonPlan.attributes.author;    //这里将author添加到json

                queryLessonMaterialData(manifestData, materials);
            })
        })
    }

    function queryLessonMaterialData(manifestData, materials) {
        var queryLessonMaterial = new AV.Query('LessonMaterial');
        queryLessonMaterial.find().then(function (dataLessonMaterials) {
            for (var i = 0; i < dataLessonMaterials.length; i++) {
                // console.log(i)
                var material = dataLessonMaterials[i];
                var materialObj = {};
                if (material.attributes.lesson.id == lesson_id) {
                    materialObj.id = material.attributes.material.id;
                    materialObj.file_index = material.attributes.index;
                    materials.push(materialObj)
                }
            }
            // console.log('--1' + JSON.stringify(manifestData));
            // console.log('--2' + JSON.stringify(materials));
            queryMaterialUrl(manifestData, materials)
        })
    }

    function queryMaterialUrl(manifestData, materials) {
        var filesData = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryMaterialUrl = new AV.Query('Material');
                queryMaterialUrl.get(materialObj.id).then(function (dataMaterialUrl) {

                    materialObj.url = dataMaterialUrl.attributes.file.attributes.url;
                    materialObj.filename = materialObj.id;
                    materialObj.type = dataMaterialUrl.attributes.file.attributes.mime_type;

                    //这里将来要加上parent和album_index属性

                    filesData.push(materialObj);

                    if (filesData.length == materials.length) {
                        manifestData.materials = filesData;
                        // console.log('1-----'+JSON.stringify(filesData));
                        // console.log('2-----'+JSON.stringify(manifestData));
                        downloadFile(manifestData, filesData);
                    }

                })
            })(i);
        }
    }

    function downloadFile(manifestData, filesData) {
        if (!fs.existsSync('download')) {
            fs.mkdirSync('download')
        }
        fs.rmrfSync(path.join('download', lesson_id));
        fs.rmrfSync(path.join('download', 'zip'));
        fs.mkdirSync(path.join('download', lesson_id));
        fs.mkdirSync(path.join('download', 'zip'));

        // fs.writeFileSync('download/manifest.json', JSON.stringify(manifestData));

        downloadData(manifestData, filesData)
        // beforePack(manifestData, filesData)
    }

    function downloadData(manifestData, filesData) {
        console.log(filesData);
        var files = [];
        for (var i = 0; i < filesData.length; i++) {
            (function (i) {
                var file = filesData[i];
                var filename = path.join('download', lesson_id, file.id);

                download(file.url).then(function (data) {
                    console.log('download' + JSON.stringify(file.url));
                    fs.writeFileSync(filename, data);
                    files.push(filename);
                    if (files.length == filesData.length) {
                        pack();
                    }
                });
            })(i)
        }
    }


    function pack() {
        // console.log('现在开始写json文件！');
        fs.writeFileSync('download/zip/manifest.json', JSON.stringify(manifestData));
        // console.log('现在开始归档文件！');
        var archive = archiver(path.join('download', lesson_id + '.zip'), {
            store: true
        });

        archive.directory('download/' + lesson_id, 'materials');
        archive.file('download/zip/manifest.json', {name: 'manifest.json'});

        archive.finalize().then(function () {
            console.log('打包成功！！');

            fs.readFile(path.join('download', lesson_id + '.zip'), function (err, data) {  //读取压缩包数据并上传文件
                var file = new AV.File(lesson_id + '.zip', data);
                file.save().then(function (valueFile) {
                    console.log(valueFile.id);

                    var query = new AV.Query('Lesson');   //查询该课程的当前信息并更新信息，将压缩包保存到当前id的lesson下
                    query.get(lesson_id).then(function (value1) {
                        var draft_version_code = value1.attributes.draft_version_code;
                        var update = AV.Object.createWithoutData('Lesson', lesson_id);
                        update.set('version_code', draft_version_code);
                        update.set('isPublished', true);
                        update.set('package', {"__type": "File", "objectId": valueFile.id});
                        update.save().then(function (value2) {
                            console.log('成功保存');
                        }, function (err) {
                            console.log(err);
                        });
                    })

                }, function (reason) {
                    console.log(reason);
                });
            })

        })


    }

    return 'pcackage is OK'
});
//一直到这里结束<--------------------

//这里是保存历史版本数据的hook函数---------->>>>>>
AV.Cloud.afterSave('Lesson', function (request) {
    console.log('--afterSave');

    var query = new AV.Query('Lesson');
    return query.get(request.object.id).then(function (value) {
        var draft_version_code = value.attributes.draft_version_code;
        var update = AV.Object.createWithoutData('Lesson', request.object.id);
        update.set('draft_version_code', draft_version_code);
        update.save()

    }, function (error) {
        console.log(error)
    });
});

AV.Cloud.afterUpdate('Lesson', function (request) {
    console.log('--afterUpdate');
    var query = new AV.Query('Lesson');
    // console.log(request.object);
    return query.get(request.object.id).then(function (value) {
        // console.log('----保存的数据------' + JSON.stringify(value.attributes));
        var HistoryLesson = AV.Object.extend('LessonSnapshot');
        var historyLesson = new HistoryLesson();
        historyLesson.set('data', value.attributes);
        historyLesson.save().then(function (value2) {
            console.log(value2.id)
        }, function (reason) {
            console.log(reason);
        })
    });
});
//<<<<<<------------------一直到这里





