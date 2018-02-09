var AV = require('leanengine');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function(request) {
  return 'Hello world!';
});


AV.Cloud.afterSave('Lesson', function(request) {
  console.log('这里是afterSave');
  console.log(request)
  return '这里是afterSave'
});


AV.Cloud.afterUpdate('Lesson', function(request) {
  console.log('这里是afterUpdate');
  console.log(request);
  return '这里是afterUpdate'
  // var query = new AV.Query('Lesson');
  // return query.get(request.object.get('').id).then(function(post) {
  //     post.increment('comments');
  //     return post.save();
  // });
});





