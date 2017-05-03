var logger = iNoodle.logger;
module.exports = {
  saveIfNotExist: function(course, idx) {
    logger.info('[COURSE_HELPER] isExit');
    iNoodle.db.collection('course')
      .find({code:course.code, term: course.term, group: course.group})
      .limit(1)
      .toArray((err, result) => {
        console.log(`course ${idx}`);
        if(result.length === 0)
          iNoodle.db.collection('course').insert(course);
      });
    return this;
  }
}
