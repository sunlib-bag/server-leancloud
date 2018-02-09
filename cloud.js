var AV = require('leanengine');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function (request) {
    return 'Hello world!';
});


AV.Cloud.define('pack', function (request) {
    return '这里是一个打包'
});

AV.Cloud.afterSave('Lesson', function (request) {
    console.log('--这里是afterSave');

    var query = new AV.Query('Lesson');
    return query.get(request.object.id).then(function (value) {
        var draft_version_code = value.attributes.draft_version_code;

        var update = AV.Object.createWithoutData('Lesson', request.object.id);
        update.set('draft_version_code', draft_version_code);
        update.save();
    }, function (error) {
        console.log(error)
    });
});


AV.Cloud.afterUpdate('Lesson', function (request) {
    console.log('--这里是afterUpdate');

    var query = new AV.Query('Lesson');
    return query.get(request.object.id).then(function (value) {
        var draft_version_code = value.attributes.draft_version_code + 1;

        console.log('111 ' + value.attributes.draft_version_code);
        console.log('222 ' + draft_version_code);

        var update = AV.Object.createWithoutData('Lesson', request.object.id);
        update.disableAfterHook();
        update.set('foo', 'bar');
        update.set('draft_version_code', draft_version_code);
        update.save().then(function (value) {
            console.log('成功保存！！')
        }, function (err) {
            console.log(err)
        });
    });
});





