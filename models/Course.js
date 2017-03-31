var FIELD = [
  '_id',
  'code',
  'name',
  'tc',
  'teacher',
  'students',
  'group',
  'daypart',
  'dayInWeek',
  'session',
  'amphitheater',
  'term',
  'createdAt',
  'updatedAt'
];
module.exports = {
  /**
  * @param object obj
  * @return Course course
  */
  refine: function(obj) {
    var course = {};
    FIELD.forEach((attr) => {
      if(obj.hasOwnProperty(attr))
        course[attr] = obj[attr];
    });
    return course;
  }
};
