var FIELD = [
  '_id',
  'student',
  'seat',
  'course',
  'time',
  'sessionNo',
  'room',
  'area',
  'type',
  'term',
  'createdAt',
  'updatedAt'
];
module.exports = {
  /**
  * @param object obj
  * @return FinalTestSession finalTestSession
  */
  refine: function(obj) {
    var finalTestSession = {};
    FIELD.forEach((attr) => {
      if(obj.hasOwnProperty(attr))
        finalTestSession[attr] = obj[attr];
    });
    return finalTestSession;
  }
};
