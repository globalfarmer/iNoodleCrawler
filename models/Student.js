var FIELD = [
  '_id',
  'code',
  'fullname',
  'sex',
  'birthday',
  'klass',
  'createdAt',
  'updatedAt'
];
module.exports = {
  refine: function(obj) {
    var student = {};
    FIELD.forEach((attr) => {
      if(obj.hasOwnProperty(attr))
        student[attr] = obj[attr];
    });
    return student;
  }
}
