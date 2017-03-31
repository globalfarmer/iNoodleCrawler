module.exports = {
  deepCopy: function(object) {
    var res = {};
    Object.keys(object).forEach((key, idx) => {
      if(typeof(object[key]) == 'object' ) {
        res[key] = this.deepCopy(object[key]);
      }
      else {
        res[key] = object[key];
      }
    });
    return res;
  }
}
