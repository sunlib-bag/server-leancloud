var AV = require('leanengine');
var download = require('download');
var fs = require('fs.extra');
var path = require('path');
var archiver = require('archiver-promise');
var xlsx = require('node-xlsx');
var requests = require("request");
var md5 = require('md5');


//创建leancloud、classin账号
AV.Cloud.define('registration', function (request) {

    var excelFileId = request.params.file_id;
    console.log(excelFileId);
    //验证用户信息---------------->
    var phonesArr = [];
    var admin = AV.Object.createWithoutData('_Role', '5a76ad890b61601d10938457');
    var relation = admin.relation('users');
    var query = relation.query();
    return query.find().then(function (results) {
        results.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });
        var user = request.currentUser;
        if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
            console.log('该用户是admin,可以创建用户');
            getExcelData(excelFileId);
            var result = {'result': 200, 'data': {}};
            return result
        } else {
            console.log('用户没有权限');
            var result = {'result': 401, 'data': {}};
            return result
        }
    }, function (error) {
    });

    //读取表格用户信息
    function getExcelData(excelFileId) {

        console.log('开始获取excel文件数据-');
        // var excelFileId = '5ad5ee13a22b9d0045fc5e88';
        var excelDataQuery = new AV.Query('_File');
        var excelFileName = path.join('download', 'excelFile', excelFileId + '.xlsx');
        excelDataQuery.get(excelFileId).then(function (value) {
            console.log('开始下载文件');
            download(value.attributes.url).then(function (data) {
                console.log('下载excel文件成功');
                fs.writeFileSync(excelFileName, data);
                console.log('写入excel文件成功,开始读取文件');

                //这里是一个查询，查询当前用户有没有注册
                var userQuery = new AV.Query('_User');
                userQuery.find().then(function (value2) {
                    var usersPhoneArr = [];
                    value2.forEach(function (userData) {
                        usersPhoneArr.push(userData.attributes.mobilePhoneNumber);
                    });
                    console.log(usersPhoneArr.length);
                    //读取excel文件内容
                    var obj = xlsx.parse(excelFileName);
                    var users = obj[0].data;
                    for (var i = 1; i < users.length; i++) {
                        var userName = users[i][6];
                        var phoneNum = users[i][8];
                        createClassInUser(phoneNum);
                        if (usersPhoneArr.indexOf(phoneNum) == -1) {
                            createLeanUser(userName, phoneNum);
                        }
                    }
                });
            })
        })
    }

    //创建leancloud用户
    function createLeanUser(userName, phoneNum) {
        console.log('开始创建新用户');
        var teacher = AV.Object.createWithoutData('_Role', '5a76ada2ee920a0045e23e17');
        var name = userName;
        var password = '123456';
        var mobilePhoneNumber = phoneNum;

        var user1 = new AV.Object('_User');
        user1.set('username', name);
        user1.set('password', password);
        user1.set('mobilePhoneNumber', mobilePhoneNumber);

        var users = [user1];
        AV.Object.saveAll(users).then(function () {
            var relation1 = teacher.relation('users');
            users.map(relation1.add.bind(relation1));
            teacher.save().then(function (value1) {
                console.log('成功创建盒子用户。')
            }, function (reason1) {
                console.log(reason1)
            });
        });
    }

    //创建classin用户
    function createClassInUser(phoneNum) {
        var mobilePhoneNum = phoneNum;
        var dateTime = new Date().getTime();
        var timeStamp = Math.floor(dateTime / 1000);
        var safeKey = md5('cnFQHt8g' + timeStamp);

        var options = {
            method: 'POST',
            url: 'http://www.eeo.cn/partner/api/course.api.php',
            qs: {action: 'register'},
            headers:
                {
                    'content-type': 'application/x-www-form-urlencoded'
                },
            form:
                {
                    SID: '1318838',
                    safeKey: safeKey,
                    timeStamp: timeStamp,
                    telephone: mobilePhoneNum,
                    password: '123456',
                }
        };
        requests(options, function (error, response, body) {
            if (error) throw new Error(error);
            console.log('创建classin用户成功');
            // console.log(body);
        });
    }
});

//保存草稿云函数
AV.Cloud.define('draftSave', function (request) {
    //创建json文件，获取编辑者，保存snapshot
    console.log('====');
    console.log('保存草稿到snapshot！');
    var lesson_id = request.params.lesson_id;
    var manifestData = {};
    var materials = [];
    manifestData.id = lesson_id;    //这里将课程id添加json
    var complier = request.currentUser.getUsername();

    //验证用户信息---------------->
    var phonesArr = [];
    var admin2 = AV.Object.createWithoutData('_Role', '5ab6001dac502e57c949a142');
    var relation = admin2.relation('users');
    var query = relation.query();
    return query.find().then(function (results) {
        results.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });
        var user = request.currentUser;
        if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
            draftVersionCodeControl(lesson_id, function () {
                queryAllData(manifestData, materials);
            });
            var result = {'result': 200, 'data': {}};
            return result
        } else {
            console.log('用户没有权限');
            var result = {'result': 401, 'data': {}};
            return result
        }
    }, function (error) {
    });

    //到这里结束<--------------------

    function queryAllData(manifestData, materials) {　　//根据传入的lesson_id查询Lesson表
        var queryAll = new AV.Query('Lesson');
        queryAll.get(lesson_id).then(function (dataAll) {
            manifestData.name = dataAll.attributes.name;  //这里将lesson_name添加到json
            manifestData.version_code = dataAll.attributes.draft_version_code;
            var tags = dataAll.attributes.tags;
            manifestData.tags = dataAll.attributes.tags;　　//这里将tags添加到json
            if (tags.length > 0) {
                tags.forEach(function (tag) {
                    if (tag.indexOf('source') != -1) {
                        manifestData.source = tag.split('.')[1]  //这里将source添加到json
                    }
                })
            }
            manifestData.planId = dataAll.attributes.plan.id;
            manifestData.subjectId = dataAll.attributes.subject.id;
            var lessonPlan_id = dataAll.attributes.plan.id;
            //根据记录的lessonPlan_id查询课程下的lessonPlan
            var queryLessonPlan = new AV.Query('LessonPlan');
            queryLessonPlan.get(lessonPlan_id).then(function (dataLessonPlan) {
                manifestData.content = dataLessonPlan.attributes.content;   //这里将content添加到json
                manifestData.author = dataLessonPlan.attributes.author;    //这里将author添加到json
                queryLessonMaterialData(manifestData, materials, dataAll);
            })
        })
    }

    function queryLessonMaterialData(manifestData, materials, lesson) {     //这里获取materials的id信息
        var queryLessonMaterial = new AV.Query('LessonMaterial');
        queryLessonMaterial.equalTo('lesson', lesson);
        queryLessonMaterial.find().then(function (dataLessonMaterials) {
            console.log(dataLessonMaterials.length);
            if (dataLessonMaterials.length == 0) {
                console.log('没有检测到material，直接打包上传教案');
                creatJsonFile(manifestData);
            } else {
                for (var i = 0; i < dataLessonMaterials.length; i++) {
                    var material = dataLessonMaterials[i];
                    var materialObj = {};
                    materialObj.id = material.attributes.material.id;
                    materialObj.file_index = material.attributes.index;
                    materials.push(materialObj);

                    if (dataLessonMaterials.length == i + 1) {
                        // console.log('materials的数量－' + materials.length);
                        checkAlbumNum(manifestData, materials)
                    }
                }
            }
        })
    }

    function checkAlbumNum(manifestData, materials) {
        var albumsSign = [];
        var len = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryAlbumUrl = new AV.Query('Material');
                queryAlbumUrl.get(materialObj.id).then(function (dataMaterialUrl) {
                    len.push(materialObj.id);
                    if (dataMaterialUrl.attributes.type == 0) {
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.type = 'album';
                        albumsSign.push(materialObj.id);
                    }
                    if (len.length == materials.length) {
                        // console.log(albumsSign) 这里判断没有图集的情况
                        if (albumsSign.length == 0) {
                            var filesData = [];
                            queryMaterialUrl(manifestData, materials, albumsSign, filesData)
                        } else {
                            getAlbum(albumsSign, manifestData, materials)
                        }
                    }
                })
            })(i);
        }
    }

    function getAlbum(albumsSign, manifestData, materials) {
        var filesData = [];
        for (var i = 0; i < albumsSign.length; i++) {
            (function (i) {
                var albumId = albumsSign[i];
                var queryMaterial = new AV.Query('Material');
                queryMaterial.get(albumId).then(function (dataAlbum) {
                    (function (i) {
                        var query = new AV.Query('Material');
                        query.equalTo('parent', dataAlbum);
                        query.find().then(function (dataAlbums) {
                            for (var j = 0; j < dataAlbums.length; j++) {
                                var materialObj = {};
                                materialObj.url = dataAlbums[j].attributes.file.attributes.url;
                                materialObj.id = dataAlbums[j].id;
                                materialObj.filename = dataAlbums[j].id;
                                materialObj.parent = dataAlbums[j].attributes.parent.id;
                                materialObj.album_index = dataAlbums[j].attributes.index;
                                materialObj.album_name = dataAlbums[j].attributes.name;
                                materialObj.mime_type = dataAlbums[j].attributes.file.attributes.mime_type;
                                materialObj.type = dataAlbums[j].attributes.type;
                                filesData.push(materialObj)
                            }
                            if (albumsSign.length == i + 1) {
                                queryMaterialUrl(manifestData, materials, albumsSign, filesData)
                            }
                        })
                    })(i);
                })
            })(i)
        }
    }

    function queryMaterialUrl(manifestData, materials, albumsSign, filesData) {  //根据上边获取到的materials的id信息在Material的数据表中获取materials的信息
        console.log('检测到' + albumsSign.length + '个图集');
        var materialsSign = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryMaterialUrl = new AV.Query('Material');
                queryMaterialUrl.get(materialObj.id).then(function (dataMaterialUrl) {
                    if (dataMaterialUrl.attributes.type == 0) {
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.mime_type = 'album';
                        materialObj.type = dataMaterialUrl.attributes.type;
                    } else {
                        materialObj.url = dataMaterialUrl.attributes.file.attributes.url;
                        materialObj.filename = materialObj.id;
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.mime_type = dataMaterialUrl.attributes.file.attributes.mime_type;
                        materialObj.type = dataMaterialUrl.attributes.type;
                    }
                    filesData.push(materialObj);
                    materialsSign.push(materialObj);
                    if (materials.length == materialsSign.length) {
                        manifestData.materials = filesData;
                        creatJsonFile(manifestData)
                    }

                })
            })(i);
        }
    }

    function creatJsonFile(manifestData) {
        console.log('创建json文件');
        if (!fs.existsSync('download')) {
            fs.mkdirSync('download')
        }
        fs.rmrfSync(path.join('download', lesson_id + '-zip'));
        fs.mkdirSync(path.join('download', lesson_id + '-zip'));
        fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
        uploadJsonFile(lesson_id)
    }

    function uploadJsonFile(lesson_id) {
        fs.readFile('download/' + lesson_id + '-zip/manifest.json', function (err, data1) {
            var file1 = new AV.File(lesson_id + '_manifest.json', data1);
            var query = new AV.Query('Lesson');   //查询该课程的当前信息并更新信息，将压缩包保存到当前id的lesson下
            query.get(lesson_id).then(function (value1) {
                var update = AV.Object.createWithoutData('Lesson', lesson_id); //保存到Lesson
                update.set('manifest_json', file1);
                // update.set('isChecked', 0);
                update.set('complier', complier);
                update.save().then(function (value3) {
                    console.log('成功保存');
                    var isChecked = 0;
                    getSnapshot(lesson_id, isChecked);
                }, function (err) {
                    console.log(err);
                });
            })
        })
    }
});

//提交审核云函数
AV.Cloud.define('submitAudit', function (request) {
    //审核状态改为１，打包课程，获取编辑者，保存snapshot
    console.log('====');
    console.log('提交审核！');
    var lesson_id = request.params.lesson_id;
    var manifestData = {};
    var materials = [];
    manifestData.id = lesson_id;    //这里将课程id添加json
    var complier = request.currentUser.getUsername();

    //验证用户信息---------------->
    var phonesArr = [];
    var admin2 = AV.Object.createWithoutData('_Role', '5ab6001dac502e57c949a142');
    var relation = admin2.relation('users');
    var query = relation.query();
    return query.find().then(function (results) {
        results.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });
        var user = request.currentUser;
        if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
            return LimitedSubmit(lesson_id, complier, manifestData, materials);
        } else {
            console.log('用户没有权限');
            var result = {'result': 401, 'data': {}};
            return result
        }
    }, function (error) {
    });

    //到这里结束<--------------------
    function LimitedSubmit(lesson_id, complier, manifestData, materials) { //限制提交审核次数
        var snapshotDates = [];
        var nowDate = new Date();
        var date = JSON.stringify(nowDate).slice(1, 11);
        var snapshotQuery = new AV.Query('LessonSnapshot');
        snapshotQuery.equalTo('lessonId', lesson_id);
        snapshotQuery.equalTo('complier', complier);
        snapshotQuery.greaterThan('isChecked', 0);
        return snapshotQuery.find().then(function (value) {
            for (var i = 0; i < value.length; i++) {
                var snapshotDate = JSON.stringify(value[i].updatedAt);
                if (snapshotDate.indexOf(date) != -1) {
                    snapshotDates.push(snapshotDate);
                }
            }
            if (snapshotDates.length >= 2) {
                console.log('今日提交审核次数已达到上限');
                var result = {'result': 403, 'data': {}};
                return result
            } else {
                console.log('可以继续提交审核');
                queryAllData(manifestData, materials);
                var result = {'result': 200, 'data': {'submitNumber': snapshotDates.length + 1}};
                return result
            }
        })
    }

    function queryAllData(manifestData, materials) {　　//根据传入的lesson_id查询Lesson表
        var queryAll = new AV.Query('Lesson');
        queryAll.get(lesson_id).then(function (dataAll) {
            manifestData.name = dataAll.attributes.name;  //这里将lesson_name添加到json
            manifestData.version_code = dataAll.attributes.draft_version_code;
            var tags = dataAll.attributes.tags;
            manifestData.tags = dataAll.attributes.tags;　　//这里将tags添加到json
            if (tags.length > 0) {
                tags.forEach(function (tag) {
                    if (tag.indexOf('source') != -1) {
                        manifestData.source = tag.split('.')[1]  //这里将source添加到json
                    }
                })
            }
            manifestData.planId = dataAll.attributes.plan.id;
            manifestData.subjectId = dataAll.attributes.subject.id;
            var lessonPlan_id = dataAll.attributes.plan.id;
            //根据记录的lessonPlan_id查询课程下的lessonPlan
            var queryLessonPlan = new AV.Query('LessonPlan');
            queryLessonPlan.get(lessonPlan_id).then(function (dataLessonPlan) {
                manifestData.content = dataLessonPlan.attributes.content;   //这里将content添加到json
                manifestData.author = dataLessonPlan.attributes.author;    //这里将author添加到json
                queryLessonMaterialData(manifestData, materials, dataAll);
            })
        })
    }

    function queryLessonMaterialData(manifestData, materials, lesson) {     //这里获取materials的id信息
        var queryLessonMaterial = new AV.Query('LessonMaterial');
        queryLessonMaterial.equalTo('lesson', lesson);
        queryLessonMaterial.find().then(function (dataLessonMaterials) {
            console.log(dataLessonMaterials.length);
            if (dataLessonMaterials.length == 0) {
                console.log('没有检测到material，直接打包上传教案');
                if (!fs.existsSync('download')) {
                    fs.mkdirSync('download')
                }
                fs.rmrfSync(path.join('download', lesson_id + '-zip'));
                fs.mkdirSync(path.join('download', lesson_id + '-zip'));
                packPlan(manifestData)
            } else {
                for (var i = 0; i < dataLessonMaterials.length; i++) {
                    var material = dataLessonMaterials[i];
                    var materialObj = {};
                    materialObj.id = material.attributes.material.id;
                    materialObj.file_index = material.attributes.index;
                    materials.push(materialObj);

                    if (dataLessonMaterials.length == i + 1) {
                        // console.log('materials的数量－' + materials.length);
                        checkAlbumNum(manifestData, materials)
                    }
                }
            }
        })
    }

    function checkAlbumNum(manifestData, materials) {
        // console.log('检查图集数量');
        var albumsSign = [];
        var len = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryAlbumUrl = new AV.Query('Material');
                queryAlbumUrl.get(materialObj.id).then(function (dataMaterialUrl) {
                    len.push(materialObj.id);
                    if (dataMaterialUrl.attributes.type == 0) {
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.type = 'album';
                        albumsSign.push(materialObj.id);
                    }
                    if (len.length == materials.length) {
                        // console.log(albumsSign) 这里判断没有图集的情况
                        if (albumsSign.length == 0) {
                            var filesData = [];
                            queryMaterialUrl(manifestData, materials, albumsSign, filesData)
                        } else {
                            // console.log('从这里开始３－图集数量－' + albumsSign.length);
                            // console.log('从这里开始４－materials数量－' + materials.length);
                            getAlbum(albumsSign, manifestData, materials)
                        }
                    }
                })
            })(i);
        }
    }

    function getAlbum(albumsSign, manifestData, materials) {
        var filesData = [];
        for (var i = 0; i < albumsSign.length; i++) {
            (function (i) {
                var albumId = albumsSign[i];
                var queryMaterial = new AV.Query('Material');
                queryMaterial.get(albumId).then(function (dataAlbum) {
                    (function (i) {
                        var query = new AV.Query('Material');
                        query.equalTo('parent', dataAlbum);
                        query.find().then(function (dataAlbums) {
                            for (var j = 0; j < dataAlbums.length; j++) {
                                var materialObj = {};
                                materialObj.url = dataAlbums[j].attributes.file.attributes.url;
                                materialObj.id = dataAlbums[j].id;
                                materialObj.filename = dataAlbums[j].id;
                                materialObj.parent = dataAlbums[j].attributes.parent.id;
                                materialObj.album_index = dataAlbums[j].attributes.index;
                                materialObj.album_name = dataAlbums[j].attributes.name;
                                materialObj.mime_type = dataAlbums[j].attributes.file.attributes.mime_type;
                                materialObj.type = dataAlbums[j].attributes.type;
                                filesData.push(materialObj)
                            }
                            if (albumsSign.length == i + 1) {
                                queryMaterialUrl(manifestData, materials, albumsSign, filesData)
                            }
                        })
                    })(i);
                })
            })(i)
        }
    }

    function queryMaterialUrl(manifestData, materials, albumsSign, filesData) {  //根据上边获取到的materials的id信息在Material的数据表中获取materials的信息
        console.log('检测到' + albumsSign.length + '个图集');
        var materialsSign = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryMaterialUrl = new AV.Query('Material');
                queryMaterialUrl.get(materialObj.id).then(function (dataMaterialUrl) {
                    if (dataMaterialUrl.attributes.type == 0) {
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.mime_type = 'album';
                        materialObj.type = dataMaterialUrl.attributes.type;
                    } else {
                        materialObj.url = dataMaterialUrl.attributes.file.attributes.url;
                        materialObj.filename = materialObj.id;
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.mime_type = dataMaterialUrl.attributes.file.attributes.mime_type;
                        materialObj.type = dataMaterialUrl.attributes.type;
                    }
                    filesData.push(materialObj);
                    materialsSign.push(materialObj);
                    if (materials.length == materialsSign.length) {
                        manifestData.materials = filesData;
                        downloadFile(manifestData, filesData, albumsSign);
                    }

                })
            })(i);
        }
    }

    function downloadFile(manifestData, filesData, albumsSign) {  //创建一个下载文件夹并清空该文件夹
        if (!fs.existsSync('download')) {
            fs.mkdirSync('download')
        }
        fs.rmrfSync(path.join('download', lesson_id));
        fs.rmrfSync(path.join('download', lesson_id + '-zip'));
        fs.rmrfSync(path.join('download', lesson_id + '.zip'));
        fs.mkdirSync(path.join('download', lesson_id));
        fs.mkdirSync(path.join('download', lesson_id + '-zip'));
        downloadData(manifestData, filesData, albumsSign)
    }

    function downloadData(manifestData, filesData, albumsSign) {  //开始根据获取到的materials的URL来下载materials
        // console.log(filesData);
        console.log('materials数量　' + filesData.length);
        var files = [];
        for (var i = 0; i < filesData.length; i++) {
            (function (i) {
                var file = filesData[i];
                var filename = path.join('download', lesson_id, file.id);
                if (file.url) {
                    download(file.url).then(function (data) {  //下载完成之后的回调
                        console.log('download' + JSON.stringify(file.url));
                        fs.writeFileSync(filename, data);
                        files.push(filename);
                        if (filesData.length == files.length + albumsSign.length && albumsSign.length > 0) {
                            console.log('已下载文件的个数　' + files.length);
                            pack(manifestData);
                        } else if (filesData.length == files.length && albumsSign.length == 0) {
                            pack(manifestData);
                        }
                    });
                }
            })(i)
        }
    }

    function packPlan(manifestData) {  //这里对没有素材的课程进行打包
        fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
        var archive = archiver(path.join('download', lesson_id + '.zip'), {
            store: true
        });
        archive.file('download/' + lesson_id + '-zip/' + 'manifest.json', {name: 'manifest.json'});
        archive.finalize().then(function () {
            console.log('教案打包成功！开始上传文件！');
            uploadZip(lesson_id)
        })
    }

    function pack(manifestData) {  //现在开始对该课程的所有数据进行打包
        fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
        console.log('现在开始归档文件！');
        var archive = archiver(path.join('download', lesson_id + '.zip'), {
            store: true
        });
        archive.directory('download/' + lesson_id, 'materials');
        archive.file('download/' + lesson_id + '-zip/' + 'manifest.json', {name: 'manifest.json'});
        archive.finalize().then(function () {
            console.log('课程打包成功！开始上传文件！');
            uploadZip(lesson_id);
        })
    }

    function uploadZip(lesson_id) {  //上传课程压缩包到该课程的package域下
        fs.readFile('download/' + lesson_id + '.zip', function (err, data) {  //读取压缩包数据并上传文件
            fs.readFile('download/' + lesson_id + '-zip/manifest.json', function (err, data1) {
                var file = new AV.File(lesson_id + '.zip', data);
                var file1 = new AV.File(lesson_id + '_manifest.json', data1);

                var query = new AV.Query('Lesson');   //查询该课程的当前信息并更新信息，将压缩包保存到当前id的lesson下
                query.get(lesson_id).then(function (value1) {
                    var draft_version_code = value1.attributes.draft_version_code;
                    var update = AV.Object.createWithoutData('Lesson', lesson_id); //保存到Lesson
                    update.set('isChecked', 1);
                    update.set('staging_package', file);
                    update.set('manifest_json', file1);
                    update.set('complier', complier);
                    update.save().then(function (value3) {
                        console.log('成功保存');
                        var snapshotQuery = new AV.Query('LessonSnapshot');
                        snapshotQuery.equalTo('lessonId', lesson_id);
                        snapshotQuery.equalTo('draft_version_code', draft_version_code);
                        snapshotQuery.find().then(function (value) {
                            var snapshotId = value[0].id;
                            var snapshotUpdate = AV.Object.createWithoutData('LessonSnapshot', snapshotId); //同步到snapshot
                            snapshotUpdate.set('isPublished', false);
                            snapshotUpdate.set('isChecked', 1);

                            snapshotUpdate.save().then(function (value3) {
                                console.log('同步历史版本完成！')
                            });
                        })
                    }, function (err) {
                        console.log(err);
                    });
                })
            });
        })
    }
});

//审核未通过云函数
AV.Cloud.define('notThrough', function (request) {
    //审核状态改为2，同步修改snapshot历史版本的审核状态为2
    var snapshot_id = request.params.snapshot_id;
    var status_code = 2;
    //验证用户信息---------------->
    var phonesArr = [];
    var admin1 = AV.Object.createWithoutData('_Role', '5ab6000d17d0096887783cd6');
    var relation = admin1.relation('users');
    var query = relation.query();
    return query.find().then(function (results) {
        results.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });
        var user = request.currentUser;
        if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
            console.log('===');
            console.log('未通过！');
            return checkLesson(snapshot_id, status_code);
        } else {
            console.log('用户没有权限');
            var result = {'result': 401, 'data': {}};
            return result
        }
    }, function (error) {
        console.log(error)
    });

});

//审核通过云函数
AV.Cloud.define('isApproved', function (request) {
    //审核状态改为3，创建json文件，同步修改snapshot历史版本的审核状态为3
    var snapshot_id = request.params.snapshot_id;
    var status_code = 3;
    //验证用户信息---------------->
    var phonesArr = [];
    var admin1 = AV.Object.createWithoutData('_Role', '5ab6000d17d0096887783cd6');
    var relation = admin1.relation('users');
    var query = relation.query();
    return query.find().then(function (results) {
        results.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });
        var user = request.currentUser;
        if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
            console.log('===');
            console.log('通过！');
            return checkLesson(snapshot_id, status_code);
        } else {
            console.log('用户没有权限');
            var result = {'result': 401, 'data': {}};
            return result
        }
    }, function (error) {
        console.log(error)
    });
});

//发布云函数
AV.Cloud.define('publish', function (request) {   //打包
    console.log('====');
    console.log('发布课程！');
    var lesson_id = request.params.lesson_id;
    var draft_version_code = request.params.draft_version_code;
    var manifestData = {};
    var materials = [];
    manifestData.id = lesson_id;    //这里将课程id添加json

    //验证用户信息---------------->
    var phonesArr = [];
    var admin1 = AV.Object.createWithoutData('_Role', '5ab6000d17d0096887783cd6');
    var relation = admin1.relation('users');
    var query = relation.query();
    return query.find().then(function (results) {
        results.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });
        var user = request.currentUser;
        if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
            queryAllData(manifestData, materials);
            var result = {'result': 200, 'data': {}};
            return result
        } else {
            console.log('用户没有权限');
            var result = {'result': 401, 'data': {}};
            return result
        }
    }, function (error) {
        console.log(error)
    });

    //到这里结束<--------------------

    function queryAllData(manifestData, materials) {　　//根据传入的lesson_id查询Lesson表
        var queryAll = new AV.Query('Lesson');
        queryAll.get(lesson_id).then(function (dataAll) {
            if (draft_version_code < dataAll.attributes.draft_version_code) {
                //发布历史版本的课程包
                queryLessonSnapshot(lesson_id, draft_version_code);
            } else {
                //打包发布最新版本的课程
                getLessonData(manifestData, materials, dataAll);
            }
        })
    }

    function queryLessonSnapshot(lesson_id, draft_version_code) {
        var snapshotQuery = new AV.Query('LessonSnapshot');
        snapshotQuery.equalTo('lessonId', lesson_id);
        snapshotQuery.equalTo('draft_version_code', draft_version_code);
        snapshotQuery.greaterThan('isChecked', 0);
        snapshotQuery.find().then(function (value2) {
            var snapshotId = value2[0].id;
            var package = value2[0].staging_package;
            var lessonUpdate = AV.Object.createWithoutData('Lesson', lesson_id); //同步到Lesson
            lessonUpdate.set('package', package);
            lessonUpdate.set('version_code', draft_version_code);
            lessonUpdate.set('isPublished', true);
            lessonUpdate.save().then(function (value3) {
                console.log('发布完成！');
            });

            var snapshotUpdate = AV.Object.createWithoutData('LessonSnapshot', snapshotId);
            snapshotUpdate.set('isPublished', true);
            snapshotUpdate.save();
        })
    }

    function getLessonData(manifestData, materials, dataAll) {
        manifestData.name = dataAll.attributes.name;  //这里将lesson_name添加到json
        manifestData.version_code = dataAll.attributes.draft_version_code;
        var tags = dataAll.attributes.tags;
        manifestData.tags = dataAll.attributes.tags;　　//这里将tags添加到json
        if (tags.length > 0) {
            tags.forEach(function (tag) {
                if (tag.indexOf('source') != -1) {
                    manifestData.source = tag.split('.')[1]  //这里将source添加到json
                }
            })
        }
        manifestData.planId = dataAll.attributes.plan.id;
        manifestData.subjectId = dataAll.attributes.subject.id;
        var lessonPlan_id = dataAll.attributes.plan.id;
        //根据记录的lessonPlan_id查询课程下的lessonPlan
        var queryLessonPlan = new AV.Query('LessonPlan');
        queryLessonPlan.get(lessonPlan_id).then(function (dataLessonPlan) {
            manifestData.content = dataLessonPlan.attributes.content;   //这里将content添加到json
            manifestData.author = dataLessonPlan.attributes.author;    //这里将author添加到json
            queryLessonMaterialData(manifestData, materials, dataAll);
        })
    }

    function queryLessonMaterialData(manifestData, materials, lesson) {     //这里获取materials的id信息
        var queryLessonMaterial = new AV.Query('LessonMaterial');
        queryLessonMaterial.equalTo('lesson', lesson);
        queryLessonMaterial.find().then(function (dataLessonMaterials) {
            console.log(dataLessonMaterials.length);
            if (dataLessonMaterials.length == 0) {
                console.log('没有检测到material，直接打包上传教案');
                if (!fs.existsSync('download')) {
                    fs.mkdirSync('download')
                }
                fs.rmrfSync(path.join('download', lesson_id + '-zip'));
                fs.mkdirSync(path.join('download', lesson_id + '-zip'));
                packPlan(manifestData)
            } else {
                for (var i = 0; i < dataLessonMaterials.length; i++) {
                    var material = dataLessonMaterials[i];
                    var materialObj = {};
                    materialObj.id = material.attributes.material.id;
                    materialObj.file_index = material.attributes.index;
                    materials.push(materialObj);

                    if (dataLessonMaterials.length == i + 1) {
                        // console.log('materials的数量－' + materials.length);
                        checkAlbumNum(manifestData, materials)
                    }
                }
            }
        })
    }

    function checkAlbumNum(manifestData, materials) {
        // console.log('检查图集数量');
        var albumsSign = [];
        var len = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryAlbumUrl = new AV.Query('Material');
                queryAlbumUrl.get(materialObj.id).then(function (dataMaterialUrl) {
                    len.push(materialObj.id);
                    if (dataMaterialUrl.attributes.type == 0) {
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.type = 'album';
                        albumsSign.push(materialObj.id);
                    }
                    if (len.length == materials.length) {
                        // console.log(albumsSign) 这里判断没有图集的情况
                        if (albumsSign.length == 0) {
                            var filesData = [];
                            queryMaterialUrl(manifestData, materials, albumsSign, filesData)
                        } else {
                            // console.log('从这里开始３－图集数量－' + albumsSign.length);
                            // console.log('从这里开始４－materials数量－' + materials.length);
                            getAlbum(albumsSign, manifestData, materials)
                        }
                    }
                })
            })(i);
        }
    }

    function getAlbum(albumsSign, manifestData, materials) {
        var filesData = [];
        for (var i = 0; i < albumsSign.length; i++) {
            (function (i) {
                var albumId = albumsSign[i];
                var queryMaterial = new AV.Query('Material');
                queryMaterial.get(albumId).then(function (dataAlbum) {
                    (function (i) {
                        var query = new AV.Query('Material');
                        query.equalTo('parent', dataAlbum);
                        query.find().then(function (dataAlbums) {
                            for (var j = 0; j < dataAlbums.length; j++) {
                                var materialObj = {};
                                materialObj.url = dataAlbums[j].attributes.file.attributes.url;
                                materialObj.id = dataAlbums[j].id;
                                materialObj.filename = dataAlbums[j].id;
                                materialObj.parent = dataAlbums[j].attributes.parent.id;
                                materialObj.album_index = dataAlbums[j].attributes.index;
                                materialObj.album_name = dataAlbums[j].attributes.name;
                                materialObj.mime_type = dataAlbums[j].attributes.file.attributes.mime_type;
                                materialObj.type = dataAlbums[j].attributes.type;
                                filesData.push(materialObj)
                            }
                            if (albumsSign.length == i + 1) {
                                queryMaterialUrl(manifestData, materials, albumsSign, filesData)
                            }
                        })
                    })(i);
                })
            })(i)
        }
    }

    function queryMaterialUrl(manifestData, materials, albumsSign, filesData) {  //根据上边获取到的materials的id信息在Material的数据表中获取materials的信息
        console.log('检测到' + albumsSign.length + '个图集');
        var materialsSign = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryMaterialUrl = new AV.Query('Material');
                queryMaterialUrl.get(materialObj.id).then(function (dataMaterialUrl) {
                    if (dataMaterialUrl.attributes.type == 0) {
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.mime_type = 'album';
                        materialObj.type = dataMaterialUrl.attributes.type;
                    } else {
                        materialObj.url = dataMaterialUrl.attributes.file.attributes.url;
                        materialObj.filename = materialObj.id;
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.mime_type = dataMaterialUrl.attributes.file.attributes.mime_type;
                        materialObj.type = dataMaterialUrl.attributes.type;
                    }
                    filesData.push(materialObj);
                    materialsSign.push(materialObj);
                    if (materials.length == materialsSign.length) {
                        manifestData.materials = filesData;
                        downloadFile(manifestData, filesData, albumsSign);
                    }

                })
            })(i);
        }
    }

    function downloadFile(manifestData, filesData, albumsSign) {  //创建一个下载文件夹并清空该文件夹
        if (!fs.existsSync('download')) {
            fs.mkdirSync('download')
        }
        fs.rmrfSync(path.join('download', lesson_id));
        fs.rmrfSync(path.join('download', lesson_id + '-zip'));
        fs.rmrfSync(path.join('download', lesson_id + '.zip'));
        fs.mkdirSync(path.join('download', lesson_id));
        fs.mkdirSync(path.join('download', lesson_id + '-zip'));
        downloadData(manifestData, filesData, albumsSign)
    }

    function downloadData(manifestData, filesData, albumsSign) {  //开始根据获取到的materials的URL来下载materials
        // console.log(filesData);
        console.log('materials数量　' + filesData.length);
        var files = [];
        for (var i = 0; i < filesData.length; i++) {
            (function (i) {
                var file = filesData[i];
                var filename = path.join('download', lesson_id, file.id);
                if (file.url) {
                    download(file.url).then(function (data) {  //下载完成之后的回调
                        console.log('download' + JSON.stringify(file.url));
                        fs.writeFileSync(filename, data);
                        files.push(filename);
                        if (filesData.length == files.length + albumsSign.length && albumsSign.length > 0) {
                            console.log('已下载文件的个数　' + files.length);
                            pack(manifestData);
                        } else if (filesData.length == files.length && albumsSign.length == 0) {
                            pack(manifestData);
                        }
                    });
                }
            })(i)
        }
    }

    function packPlan(manifestData) {  //这里对没有素材的课程进行打包
        fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
        var archive = archiver(path.join('download', lesson_id + '.zip'), {
            store: true
        });
        archive.file('download/' + lesson_id + '-zip/' + 'manifest.json', {name: 'manifest.json'});
        archive.finalize().then(function () {
            console.log('教案打包成功！开始上传文件！');
            uploadZip(lesson_id)
        })
    }

    function pack(manifestData) {  //现在开始对该课程的所有数据进行打包
        fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
        console.log('现在开始归档文件！');
        var archive = archiver(path.join('download', lesson_id + '.zip'), {
            store: true
        });
        archive.directory('download/' + lesson_id, 'materials');
        archive.file('download/' + lesson_id + '-zip/' + 'manifest.json', {name: 'manifest.json'});
        archive.finalize().then(function () {
            console.log('课程打包成功！开始上传文件！');
            uploadZip(lesson_id);
        })
    }

    function uploadZip(lesson_id) {  //上传课程压缩包到该课程的package域下
        fs.readFile('download/' + lesson_id + '.zip', function (err, data) {  //读取压缩包数据并上传文件
            fs.readFile('download/' + lesson_id + '-zip/manifest.json', function (err, data1) {
                var file = new AV.File(lesson_id + '.zip', data);
                var file1 = new AV.File(lesson_id + '_manifest.json', data1);

                var query = new AV.Query('Lesson');   //查询该课程的当前信息并更新信息，将压缩包保存到当前id的lesson下
                query.get(lesson_id).then(function (value1) {
                    var version_code = value1.attributes.draft_version_code;
                    var update = AV.Object.createWithoutData('Lesson', lesson_id); //保存到Lesson
                    update.set('version_code', version_code);
                    update.set('isPublished', true);
                    update.set('isChecked', 3);
                    update.set('package', file);
                    update.set('manifest_json', file1);
                    update.save().then(function (value3) {
                        console.log('成功保存');
                        // publishSnapshot(lesson_id, draft_version_code);
                        var snapshotQuery = new AV.Query('LessonSnapshot');
                        snapshotQuery.equalTo('lessonId', lesson_id);
                        snapshotQuery.equalTo('draft_version_code', draft_version_code);
                        snapshotQuery.find().then(function (value) {
                            var snapshotId = value[0].id;
                            var snapshotUpdate = AV.Object.createWithoutData('LessonSnapshot', snapshotId); //同步到snapshot
                            snapshotUpdate.set('isPublished', true);
                            snapshotUpdate.set('isChecked', 3);
                            snapshotUpdate.set('version_code', draft_version_code);
                            snapshotUpdate.save().then(function (value3) {
                                console.log('同步到历史版本！')
                            });
                        })
                    }, function (err) {
                        console.log(err);
                    });
                })
            });
        })
    }

});

//阳光盒子1.0版本的发布云函数
AV.Cloud.define('pack', function (request) {   //打包
    console.log('发布课程！');
    console.log('====');
    var lesson_id = request.params.lesson_id;
    var manifestData = {};
    var materials = [];
    manifestData.id = lesson_id;    //这里将课程id添加json

    //验证用户信息---------------->
    var phonesArr = [];
    var admin = AV.Object.createWithoutData('_Role', '5a76ad890b61601d10938457');
    var relation = admin.relation('users');
    var query = relation.query();
    return query.find().then(function (results) {
        results.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });
        var user = request.currentUser;
        if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
            console.log('该用户是admin,可以发布课程');
            queryAllData(manifestData, materials);
            return 'pcackage is OK'
        } else {
            console.log('用户没有权限发布课程');
            return 'user is not admin'
        }
    }, function (error) {
    });

    //到这里结束<--------------------

    function queryAllData(manifestData, materials) {　　//根据传入的lesson_id查询Lesson表
        // console.log('11开始查询该课程的数据');
        var queryAll = new AV.Query('Lesson');
        queryAll.get(lesson_id).then(function (dataAll) {
            manifestData.name = dataAll.attributes.name;  //这里将lesson_name添加到json
            manifestData.version_code = dataAll.attributes.draft_version_code;
            var tags = dataAll.attributes.tags;
            manifestData.tags = dataAll.attributes.tags;　　//这里将tags添加到json
            if (tags.length > 0) {
                tags.forEach(function (tag) {
                    if (tag.indexOf('source') != -1) {
                        manifestData.source = tag.split('.')[1]  //这里将source添加到json
                    }
                })
            }
            manifestData.planId = dataAll.attributes.plan.id;
            manifestData.subjectId = dataAll.attributes.subject.id;
            var lessonPlan_id = dataAll.attributes.plan.id;
            //根据记录的lessonPlan_id查询课程下的lessonPlan
            var queryLessonPlan = new AV.Query('LessonPlan');
            queryLessonPlan.get(lessonPlan_id).then(function (dataLessonPlan) {
                // console.log(dataLessonPlan.attributes.title);

                manifestData.content = dataLessonPlan.attributes.content;   //这里将content添加到json
                manifestData.author = dataLessonPlan.attributes.author;    //这里将author添加到json
                // console.log('从这里开始１－－' + JSON.stringify(manifestData));
                queryLessonMaterialData(manifestData, materials, dataAll);
            })
        })
    }

    function queryLessonMaterialData(manifestData, materials, lesson) {     //这里获取materials的id信息
        var queryLessonMaterial = new AV.Query('LessonMaterial');
        queryLessonMaterial.equalTo('lesson', lesson);
        queryLessonMaterial.find().then(function (dataLessonMaterials) {
            console.log(dataLessonMaterials.length);
            if (dataLessonMaterials.length == 0) {
                console.log('没有检测到material，直接打包上传教案');
                if (!fs.existsSync('download')) {
                    fs.mkdirSync('download')
                }
                fs.rmrfSync(path.join('download', lesson_id + '-zip'));
                fs.mkdirSync(path.join('download', lesson_id + '-zip'));
                packPlan(manifestData)
            } else {
                for (var i = 0; i < dataLessonMaterials.length; i++) {
                    var material = dataLessonMaterials[i];
                    var materialObj = {};
                    materialObj.id = material.attributes.material.id;
                    materialObj.file_index = material.attributes.index;
                    materials.push(materialObj);

                    if (dataLessonMaterials.length == i + 1) {
                        // console.log('materials的数量－' + materials.length);
                        checkAlbumNum(manifestData, materials)
                    }
                }
            }
        })
    }

    function checkAlbumNum(manifestData, materials) {
        // console.log('检查图集数量');
        var albumsSign = [];
        var len = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryAlbumUrl = new AV.Query('Material');
                queryAlbumUrl.get(materialObj.id).then(function (dataMaterialUrl) {
                    len.push(materialObj.id);
                    if (dataMaterialUrl.attributes.type == 0) {
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.type = 'album';
                        albumsSign.push(materialObj.id);
                    }
                    if (len.length == materials.length) {
                        // console.log(albumsSign) 这里判断没有图集的情况
                        if (albumsSign.length == 0) {
                            var filesData = [];
                            queryMaterialUrl(manifestData, materials, albumsSign, filesData)
                        } else {
                            // console.log('从这里开始３－图集数量－' + albumsSign.length);
                            // console.log('从这里开始４－materials数量－' + materials.length);
                            getAlbum(albumsSign, manifestData, materials)
                        }
                    }
                })
            })(i);
        }
    }

    function getAlbum(albumsSign, manifestData, materials) {
        var filesData = [];
        for (var i = 0; i < albumsSign.length; i++) {
            (function (i) {
                var albumId = albumsSign[i];
                var queryMaterial = new AV.Query('Material');
                queryMaterial.get(albumId).then(function (dataAlbum) {
                    (function (i) {
                        var query = new AV.Query('Material');
                        query.equalTo('parent', dataAlbum);
                        query.find().then(function (dataAlbums) {
                            for (var j = 0; j < dataAlbums.length; j++) {
                                var materialObj = {};
                                materialObj.url = dataAlbums[j].attributes.file.attributes.url;
                                materialObj.id = dataAlbums[j].id;
                                materialObj.filename = dataAlbums[j].id;
                                materialObj.parent = dataAlbums[j].attributes.parent.id;
                                materialObj.album_index = dataAlbums[j].attributes.index;
                                materialObj.album_name = dataAlbums[j].attributes.name;
                                materialObj.mime_type = dataAlbums[j].attributes.file.attributes.mime_type;
                                materialObj.type = dataAlbums[j].attributes.type;
                                filesData.push(materialObj)
                            }
                            if (albumsSign.length == i + 1) {
                                // console.log('从这里开始5－图集图片数量－' + filesData.length);
                                queryMaterialUrl(manifestData, materials, albumsSign, filesData)
                            }
                        })
                    })(i);
                })
            })(i)
        }
    }

    function queryMaterialUrl(manifestData, materials, albumsSign, filesData) {  //根据上边获取到的materials的id信息在Material的数据表中获取materials的信息
        // console.log('33根据上边获取到的materials的id信息在Material的数据表中获取materials的信息');
        console.log('检测到' + albumsSign.length + '个图集');
        // console.log('从这里开始６－－图集图片数量：'+filesData.length + '　－materials数量：'+materials.length);
        var materialsSign = [];
        for (var i = 0; i < materials.length; i++) {
            (function (i) {
                var materialObj = materials[i];
                var queryMaterialUrl = new AV.Query('Material');
                queryMaterialUrl.get(materialObj.id).then(function (dataMaterialUrl) {
                    if (dataMaterialUrl.attributes.type == 0) {
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.mime_type = 'album';
                        materialObj.type = dataMaterialUrl.attributes.type;
                    } else {
                        materialObj.url = dataMaterialUrl.attributes.file.attributes.url;
                        materialObj.filename = materialObj.id;
                        materialObj.name = dataMaterialUrl.attributes.name;
                        materialObj.mime_type = dataMaterialUrl.attributes.file.attributes.mime_type;
                        materialObj.type = dataMaterialUrl.attributes.type;
                    }
                    filesData.push(materialObj);
                    materialsSign.push(materialObj);
                    if (materials.length == materialsSign.length) {
                        manifestData.materials = filesData;
                        downloadFile(manifestData, filesData, albumsSign);
                    }

                })
            })(i);
        }
    }


    function downloadFile(manifestData, filesData, albumsSign) {  //创建一个下载文件夹并清空该文件夹
        // console.log('44创建一个下载文件夹并清空该文件夹');
        if (!fs.existsSync('download')) {
            fs.mkdirSync('download')
        }
        fs.rmrfSync(path.join('download', lesson_id));
        fs.rmrfSync(path.join('download', lesson_id + '-zip'));
        fs.rmrfSync(path.join('download', lesson_id + '.zip'));
        fs.mkdirSync(path.join('download', lesson_id));
        fs.mkdirSync(path.join('download', lesson_id + '-zip'));

        downloadData(manifestData, filesData, albumsSign)
    }

    function downloadData(manifestData, filesData, albumsSign) {  //开始根据获取到的materials的URL来下载materials
        // console.log('55开始根据获取到的materials的URL来下载materials');
        // console.log(filesData);
        console.log('materials数量　' + filesData.length);
        var files = [];
        for (var i = 0; i < filesData.length; i++) {
            (function (i) {
                var file = filesData[i];
                var filename = path.join('download', lesson_id, file.id);
                if (file.url) {
                    download(file.url).then(function (data) {  //下载完成之后的回调
                        console.log('download' + JSON.stringify(file.url));
                        fs.writeFileSync(filename, data);
                        files.push(filename);
                        if (filesData.length == files.length + albumsSign.length && albumsSign.length > 0) {
                            console.log('已下载文件的个数　' + files.length);
                            pack(manifestData);
                        } else if (filesData.length == files.length && albumsSign.length == 0) {
                            pack(manifestData);
                        }
                    });
                }
            })(i)
        }
    }

    function packPlan(manifestData) {  //这里对没有素材的课程进行打包
        fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
        var archive = archiver(path.join('download', lesson_id + '.zip'), {
            store: true
        });
        archive.file('download/' + lesson_id + '-zip/' + 'manifest.json', {name: 'manifest.json'});
        archive.finalize().then(function () {
            console.log('教案打包成功！开始上传文件！');
            uploadZip(lesson_id)
        })
    }

    function pack(manifestData) {  //现在开始对该课程的所有数据进行打包
        // console.log('66现在开始写json文件！');
        fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
        console.log('现在开始归档文件！');
        var archive = archiver(path.join('download', lesson_id + '.zip'), {
            store: true
        });
        archive.directory('download/' + lesson_id, 'materials');
        archive.file('download/' + lesson_id + '-zip/' + 'manifest.json', {name: 'manifest.json'});
        archive.finalize().then(function () {
            console.log('课程打包成功！开始上传文件！');
            uploadZip(lesson_id);
        })
    }

    function uploadZip(lesson_id) {  //上传课程压缩包到该课程的package域下
        fs.readFile('download/' + lesson_id + '.zip', function (err, data) {  //读取压缩包数据并上传文件
            var file = new AV.File(lesson_id + '.zip', data);
            var query = new AV.Query('Lesson');   //查询该课程的当前信息并更新信息，将压缩包保存到当前id的lesson下
            query.get(lesson_id).then(function (value1) {
                var draft_version_code = value1.attributes.draft_version_code;
                var update = AV.Object.createWithoutData('Lesson', lesson_id);
                update.set('version_code', draft_version_code);
                update.set('isPublished', true);
                update.set('package', file);
                update.save().then(function (value2) {
                    console.log('成功保存');
                }, function (err) {
                    console.log(err);
                });
            })

        })
    }

});

//下架云函数
AV.Cloud.define('cancelRelease', function (request) {
    //保存当前课程的状态到snapshot
    var lesson_id = request.params.lesson_id;
    //验证用户信息---------------->
    var phonesArr = [];
    var admin1 = AV.Object.createWithoutData('_Role', '5ab6000d17d0096887783cd6');
    var relation = admin1.relation('users');
    var query = relation.query();
    return query.find().then(function (results) {
        results.forEach(function (data) {
            phonesArr.push(data.attributes.mobilePhoneNumber);
        });
        var user = request.currentUser;
        if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
            cancelRelease(lesson_id);
            var result = {'result': 200, 'data': {}};
            return result
        } else {
            console.log('用户没有权限');
            var result = {'result': 401, 'data': {}};
            return result
        }
    }, function (error) {
        console.log(error)
    });
});


//草稿版本号控制
function draftVersionCodeControl(lesson_id, cb) {
    var lessonQuery = new AV.Query('Lesson');
    lessonQuery.get(lesson_id).then(function (value) {
        var draft_version_code = value.attributes.draft_version_code;
        var lessonUpdate = AV.Object.createWithoutData('Lesson', lesson_id);
        lessonUpdate.set('draft_version_code', draft_version_code + 1);
        lessonUpdate.save().then(function (value2) {
            cb();
        });
    });
}

//下架并同步到历史版本
function cancelRelease(lesson_id) {
    var lessonUpdate = AV.Object.createWithoutData('Lesson', lesson_id);
    lessonUpdate.set('isPublished', false);
    lessonUpdate.save();
    var query = new AV.Query('Lesson');
    query.get(lesson_id).then(function (value) {
        var draft_version_code = value.attributes.draft_version_code;
        var snapshotQuery = new AV.Query('LessonSnapshot');
        snapshotQuery.equalTo('lessonId', lesson_id);
        snapshotQuery.equalTo('draft_version_code', draft_version_code);
        snapshotQuery.find().then(function (value2) {
            console.log(value2[0].id);
            var snapshotId = value2[0].id;
            var snapshotUpdate = AV.Object.createWithoutData('LessonSnapshot', snapshotId); //同步到snapshot
            snapshotUpdate.set('isPublished', false);
            snapshotUpdate.save().then(function (value3) {
                console.log('下架完成！')
            });
        })
    })
}

//审核课程并且将审核状态同步到历史版本
function checkLesson(snapshot_id, status_code) {
    var query = new AV.Query('LessonSnapshot');
    return query.get(snapshot_id).then(function (value) {
        var lesson_id = value.attributes.lessonId;
        var draft_version_code = value.attributes.draft_version_code;
        var snapshotUpdate = AV.Object.createWithoutData('LessonSnapshot', snapshot_id); //同步到snapshot
        snapshotUpdate.set('isChecked', status_code);
        return snapshotUpdate.save().then(function (value3) {
            console.log('审核完成！');
            console.log('===');
            var lessonQuery = new AV.Query('Lesson');
            lessonQuery.get(lesson_id).then(function (value2) {
                if (draft_version_code == value2.attributes.draft_version_code) {
                    var update = AV.Object.createWithoutData('Lesson', lesson_id);
                    update.set('isChecked', status_code);
                    update.save();
                }
            });
            var result = {'result': 200, 'data': value3};
            return result;
        });
    })
}

//保存课程的历史版本
function getSnapshot(lesson_id, isChecked) {
    var query = new AV.Query('Lesson');
    query.get(lesson_id).then(function (value) {
        var HistoryLesson = AV.Object.extend('LessonSnapshot');
        var historyLesson = new HistoryLesson();
        historyLesson.set('lessonId', lesson_id); //课程id
        historyLesson.set('isChecked', isChecked); //***审核状态
        historyLesson.set('isPublished', false); //***发布状态
        historyLesson.set('draft_version_code', value.attributes.draft_version_code); //***草稿版本
        historyLesson.set('version_code', value.attributes.version_code); //发布版本
        historyLesson.set('staging_package', value.attributes.staging_package); //提交审核暂存包
        historyLesson.set('package', value.attributes.package); //课程zip包
        historyLesson.set('manifest_json', value.attributes.manifest_json); //课程json文件
        historyLesson.set('complier', value.attributes.complier); //编辑者
        historyLesson.save().then(function (value2) {
            console.log('课程历史版本已保存！');
            console.log('====');
        }, function (reason) {
            console.log(reason);
        })
    });
}

//新注册的用户默认创建teacher角色的hook函数
AV.Cloud.afterSave('_User', function (request) {
    console.log('设置当前用户为teacher');
    var teacher = AV.Object.createWithoutData('_Role', '5a76ada2ee920a0045e23e17');
    var users1 = [request.object];
    var relation1 = teacher.relation('users');
    users1.map(relation1.add.bind(relation1));
    return teacher.save().then(function (value1) {
        console.log(value1)
    }, function (reason1) {
        console.log(reason1)
    });
});