var FIELD = [
  'student',
  'course',
  'term',
  'note'
];
module.exports = {
  refine: function(obj) {
    var slot = {};
    FIELD.forEach((attr) => {
      if(obj.hasOwnProperty(attr))
        slot[attr] = obj[attr];
    });
    return slot;
  }
}
