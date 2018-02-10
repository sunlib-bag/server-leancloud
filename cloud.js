var AV = require('leanengine');
var download = require('download');
var fs = require('fs.extra');
var path = require('path');
var archiver = require('archiver-promise');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function (request) {
    return 'Hello world!';
});


AV.Cloud.define('pack', function (request) {

    var lesson_id = '5a7da2c99f54540070e04714';
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
    fs.rmrfSync(path.join('download', lesson_id));
    fs.mkdirSync(path.join('download', lesson_id));
    var promises = [];
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
                    console.log('ok')
                    var query = new AV.Query('Lesson');
                    query.get(lesson_id).then(function (value) {
                        var draft_version_code = value.attributes.draft_version_code;
                        var update = AV.Object.createWithoutData('Lesson', lesson_id);
                        update.set('version_code', draft_version_code);
                        update.set('package', {"__type": "File", "objectId": '5a7ec161756571003c6bd3f5'});
                        update.save().then(function (value) {
                            console.log('成功保存！！')
                        }, function (err) {
                            console.log(err)
                        });
                    })
                })
        })

    return 'pcackage is OK'

});

//这里注释掉的是保存版本号的hook函数---------->>>>>>
// AV.Cloud.beforeSave('Lesson', function (request) {
//     console.log('--这里是beforeSave---查看结果111');
//
//     return request.object.set('draft_version_code', 1);
//
// });
// AV.Cloud.afterUpdate('Lesson', function (request) {
//     console.log('--这里是afterUpdate');
//
//     var query = new AV.Query('Lesson');
//     return query.get(request.object.id).then(function (value) {
//         var draft_version_code = value.attributes.draft_version_code + 1;
//
//         console.log('111 ' + value.attributes.draft_version_code);
//         console.log('222 ' + draft_version_code);
//
//         var update = AV.Object.createWithoutData('Lesson', request.object.id);
//         update.disableAfterHook();
//         update.set('foo', 'bar');
//         update.set('draft_version_code', draft_version_code);
//         update.save().then(function (value) {
//             console.log('成功保存！！')
//         }, function (err) {
//             console.log(err)
//         });
//     });
// });
//<<<<<<------------------一直到这里





