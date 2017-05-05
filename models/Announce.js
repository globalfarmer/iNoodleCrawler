var FIELD = [
  '_id',
  'name',
  'link',
  'uploadtime',
  'createdAt',
  'updatedAt'
];
module.exports = {
  /**
  * @param object obj
  * @return Announce announce
  */
  refine: function(obj) {
    var announce = {};
    FIELD.forEach((attr) => {
      if(obj.hasOwnProperty(attr))
        announce[attr] = obj[attr];
    });
    return announce;
  }
};
