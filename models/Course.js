var FIELD = [
  '_id',
  'code',
  'name',
  'tc',
  'teacher',
  'students',
  'daypart',
  'dayInWeek',
  'session',
  'amphitheater',
  'group',
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
