var AV = require('leanengine');
var download = require('download');
var fs = require('fs.extra');
var path = require('path');
var archiver = require('archiver-promise');
var xlsx = require('node-xlsx');
var requests = require("request");
var md5 = require('md5');
var Promise = require('promise');


// AV.Cloud.define('getALesson', function (request, res) {
//     var query = new AV.Query('Lesson');
//     query.get('5b6abcf6756571003b8f8496').then(function (value) {
//         console.log('test: ');
//         if(value.attributes.coverImage){
//             console.log(value.attributes.coverImage);
//         }
//         return res.success({status: true, data: value.attributes.coverImage});
//     }, function (reason) {
//         console.log(reason);
//     })
// });


//// 阳光盒子1.0版本的发布云函数
// AV.Cloud.define('pack', function (request) {   //打包
//     console.log('发布课程！');
//     console.log('====');
//     var lesson_id = request.params.lesson_id;
//     var manifestData = {};
//     var materials = [];
//     manifestData.id = lesson_id;    //这里将课程id添加json
//
//     //验证用户信息---------------->
//     var phonesArr = [];
//     var admin = AV.Object.createWithoutData('_Role', '5a76ad890b61601d10938457');
//     var relation = admin.relation('users');
//     var query = relation.query();
//     return query.find().then(function (results) {
//         results.forEach(function (data) {
//             phonesArr.push(data.attributes.mobilePhoneNumber);
//         });
//         var user = request.currentUser;
//         if (phonesArr.indexOf(user.attributes.mobilePhoneNumber) != -1) {
//             console.log('该用户是admin,可以发布课程');
//             queryAllData(manifestData, materials);
//             return 'pcackage is OK'
//         } else {
//             console.log('用户没有权限发布课程');
//             return 'user is not admin'
//         }
//     }, function (error) {
//     });
//
//     //到这里结束<--------------------
//
//     function queryAllData(manifestData, materials) {　　//根据传入的lesson_id查询Lesson表
//         // console.log('11开始查询该课程的数据');
//         var queryAll = new AV.Query('Lesson');
//         queryAll.get(lesson_id).then(function (dataAll) {
//             manifestData.name = dataAll.attributes.name;  //这里将lesson_name添加到json
//             manifestData.version_code = dataAll.attributes.draft_version_code;
//             var tags = dataAll.attributes.tags;
//             manifestData.tags = dataAll.attributes.tags;　　//这里将tags添加到json
//             if (tags.length > 0) {
//                 tags.forEach(function (tag) {
//                     if (tag.indexOf('source') != -1) {
//                         manifestData.source = tag.split('.')[1]  //这里将source添加到json
//                     }
//                 })
//             }
//             manifestData.planId = dataAll.attributes.plan.id;
//             manifestData.subjectId = dataAll.attributes.subject.id;
//             var lessonPlan_id = dataAll.attributes.plan.id;
//             //根据记录的lessonPlan_id查询课程下的lessonPlan
//             var queryLessonPlan = new AV.Query('LessonPlan');
//             queryLessonPlan.get(lessonPlan_id).then(function (dataLessonPlan) {
//                 // console.log(dataLessonPlan.attributes.title);
//
//                 manifestData.content = dataLessonPlan.attributes.content;   //这里将content添加到json
//                 manifestData.author = dataLessonPlan.attributes.author;    //这里将author添加到json
//                 // console.log('从这里开始１－－' + JSON.stringify(manifestData));
//                 queryLessonMaterialData(manifestData, materials, dataAll);
//             })
//         })
//     }
//
//     function queryLessonMaterialData(manifestData, materials, lesson) {     //这里获取materials的id信息
//         var queryLessonMaterial = new AV.Query('LessonMaterial');
//         queryLessonMaterial.equalTo('lesson', lesson);
//         queryLessonMaterial.find().then(function (dataLessonMaterials) {
//             console.log(dataLessonMaterials.length);
//             if (dataLessonMaterials.length == 0) {
//                 console.log('没有检测到material，直接打包上传教案');
//                 if (!fs.existsSync('download')) {
//                     fs.mkdirSync('download')
//                 }
//                 fs.rmrfSync(path.join('download', lesson_id + '-zip'));
//                 fs.mkdirSync(path.join('download', lesson_id + '-zip'));
//                 packPlan(manifestData)
//             } else {
//                 for (var i = 0; i < dataLessonMaterials.length; i++) {
//                     var material = dataLessonMaterials[i];
//                     var materialObj = {};
//                     materialObj.id = material.attributes.material.id;
//                     materialObj.file_index = material.attributes.index;
//                     materials.push(materialObj);
//
//                     if (dataLessonMaterials.length == i + 1) {
//                         // console.log('materials的数量－' + materials.length);
//                         checkAlbumNum(manifestData, materials)
//                     }
//                 }
//             }
//         })
//     }
//
//     function checkAlbumNum(manifestData, materials) {
//         // console.log('检查图集数量');
//         var albumsSign = [];
//         var len = [];
//         for (var i = 0; i < materials.length; i++) {
//             (function (i) {
//                 var materialObj = materials[i];
//                 var queryAlbumUrl = new AV.Query('Material');
//                 queryAlbumUrl.get(materialObj.id).then(function (dataMaterialUrl) {
//                     len.push(materialObj.id);
//                     if (dataMaterialUrl.attributes.type == 0) {
//                         materialObj.name = dataMaterialUrl.attributes.name;
//                         materialObj.type = 'album';
//                         albumsSign.push(materialObj.id);
//                     }
//                     if (len.length == materials.length) {
//                         // console.log(albumsSign) 这里判断没有图集的情况
//                         if (albumsSign.length == 0) {
//                             var filesData = [];
//                             queryMaterialUrl(manifestData, materials, albumsSign, filesData)
//                         } else {
//                             // console.log('从这里开始３－图集数量－' + albumsSign.length);
//                             // console.log('从这里开始４－materials数量－' + materials.length);
//                             getAlbum(albumsSign, manifestData, materials)
//                         }
//                     }
//                 })
//             })(i);
//         }
//     }
//
//     function getAlbum(albumsSign, manifestData, materials) {
//         var filesData = [];
//         for (var i = 0; i < albumsSign.length; i++) {
//             (function (i) {
//                 var albumId = albumsSign[i];
//                 var queryMaterial = new AV.Query('Material');
//                 queryMaterial.get(albumId).then(function (dataAlbum) {
//                     (function (i) {
//                         var query = new AV.Query('Material');
//                         query.equalTo('parent', dataAlbum);
//                         query.find().then(function (dataAlbums) {
//                             for (var j = 0; j < dataAlbums.length; j++) {
//                                 var materialObj = {};
//                                 materialObj.url = dataAlbums[j].attributes.file.attributes.url;
//                                 materialObj.id = dataAlbums[j].id;
//                                 materialObj.filename = dataAlbums[j].id;
//                                 materialObj.parent = dataAlbums[j].attributes.parent.id;
//                                 materialObj.album_index = dataAlbums[j].attributes.index;
//                                 materialObj.album_name = dataAlbums[j].attributes.name;
//                                 materialObj.mime_type = dataAlbums[j].attributes.file.attributes.mime_type;
//                                 materialObj.type = dataAlbums[j].attributes.type;
//                                 filesData.push(materialObj)
//                             }
//                             if (albumsSign.length == i + 1) {
//                                 // console.log('从这里开始5－图集图片数量－' + filesData.length);
//                                 queryMaterialUrl(manifestData, materials, albumsSign, filesData)
//                             }
//                         })
//                     })(i);
//                 })
//             })(i)
//         }
//     }
//
//     function queryMaterialUrl(manifestData, materials, albumsSign, filesData) {  //根据上边获取到的materials的id信息在Material的数据表中获取materials的信息
//         // console.log('33根据上边获取到的materials的id信息在Material的数据表中获取materials的信息');
//         console.log('检测到' + albumsSign.length + '个图集');
//         // console.log('从这里开始６－－图集图片数量：'+filesData.length + '　－materials数量：'+materials.length);
//         var materialsSign = [];
//         for (var i = 0; i < materials.length; i++) {
//             (function (i) {
//                 var materialObj = materials[i];
//                 var queryMaterialUrl = new AV.Query('Material');
//                 queryMaterialUrl.get(materialObj.id).then(function (dataMaterialUrl) {
//                     if (dataMaterialUrl.attributes.type == 0) {
//                         materialObj.name = dataMaterialUrl.attributes.name;
//                         materialObj.mime_type = 'album';
//                         materialObj.type = dataMaterialUrl.attributes.type;
//                     } else {
//                         materialObj.url = dataMaterialUrl.attributes.file.attributes.url;
//                         materialObj.filename = materialObj.id;
//                         materialObj.name = dataMaterialUrl.attributes.name;
//                         materialObj.mime_type = dataMaterialUrl.attributes.file.attributes.mime_type;
//                         materialObj.type = dataMaterialUrl.attributes.type;
//                     }
//                     filesData.push(materialObj);
//                     materialsSign.push(materialObj);
//                     if (materials.length == materialsSign.length) {
//                         manifestData.materials = filesData;
//                         downloadFile(manifestData, filesData, albumsSign);
//                     }
//
//                 })
//             })(i);
//         }
//     }
//
//
//     function downloadFile(manifestData, filesData, albumsSign) {  //创建一个下载文件夹并清空该文件夹
//         // console.log('44创建一个下载文件夹并清空该文件夹');
//         if (!fs.existsSync('download')) {
//             fs.mkdirSync('download')
//         }
//         fs.rmrfSync(path.join('download', lesson_id));
//         fs.rmrfSync(path.join('download', lesson_id + '-zip'));
//         fs.rmrfSync(path.join('download', lesson_id + '.zip'));
//         fs.mkdirSync(path.join('download', lesson_id));
//         fs.mkdirSync(path.join('download', lesson_id + '-zip'));
//
//         downloadData(manifestData, filesData, albumsSign)
//     }
//
//     function downloadData(manifestData, filesData, albumsSign) {  //开始根据获取到的materials的URL来下载materials
//         // console.log('55开始根据获取到的materials的URL来下载materials');
//         // console.log(filesData);
//         console.log('materials数量　' + filesData.length);
//         var files = [];
//         for (var i = 0; i < filesData.length; i++) {
//             (function (i) {
//                 var file = filesData[i];
//                 var filename = path.join('download', lesson_id, file.id);
//                 if (file.url) {
//                     download(file.url).then(function (data) {  //下载完成之后的回调
//                         console.log('download' + JSON.stringify(file.url));
//                         fs.writeFileSync(filename, data);
//                         files.push(filename);
//                         if (filesData.length == files.length + albumsSign.length && albumsSign.length > 0) {
//                             console.log('已下载文件的个数　' + files.length);
//                             pack(manifestData);
//                         } else if (filesData.length == files.length && albumsSign.length == 0) {
//                             pack(manifestData);
//                         }
//                     });
//                 }
//             })(i)
//         }
//     }
//
//     function packPlan(manifestData) {  //这里对没有素材的课程进行打包
//         fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
//         var archive = archiver(path.join('download', lesson_id + '.zip'), {
//             store: true
//         });
//         archive.file('download/' + lesson_id + '-zip/' + 'manifest.json', {name: 'manifest.json'});
//         archive.finalize().then(function () {
//             console.log('教案打包成功！开始上传文件！');
//             uploadZip(lesson_id)
//         })
//     }
//
//     function pack(manifestData) {  //现在开始对该课程的所有数据进行打包
//         // console.log('66现在开始写json文件！');
//         fs.writeFileSync(path.join('download', lesson_id + '-zip', 'manifest.json'), JSON.stringify(manifestData));
//         console.log('现在开始归档文件！');
//         var archive = archiver(path.join('download', lesson_id + '.zip'), {
//             store: true
//         });
//         archive.directory('download/' + lesson_id, 'materials');
//         archive.file('download/' + lesson_id + '-zip/' + 'manifest.json', {name: 'manifest.json'});
//         archive.finalize().then(function () {
//             console.log('课程打包成功！开始上传文件！');
//             uploadZip(lesson_id);
//         })
//     }
//
//     function uploadZip(lesson_id) {  //上传课程压缩包到该课程的package域下
//         fs.readFile('download/' + lesson_id + '.zip', function (err, data) {  //读取压缩包数据并上传文件
//             var file = new AV.File(lesson_id + '.zip', data);
//             var query = new AV.Query('Lesson');   //查询该课程的当前信息并更新信息，将压缩包保存到当前id的lesson下
//             query.get(lesson_id).then(function (value1) {
//                 var draft_version_code = value1.attributes.draft_version_code;
//                 var update = AV.Object.createWithoutData('Lesson', lesson_id);
//                 update.set('version_code', draft_version_code);
//                 update.set('isPublished', true);
//                 update.set('package', file);
//                 update.save().then(function (value2) {
//                     console.log('成功保存');
//                 }, function (err) {
//                     console.log(err);
//                 });
//             })
//
//         })
//     }
//
// });