var logger = iNoodle.logger;
module.exports = {
  saveIfNotExist: function(finalTestSession, idx) {
    logger.info('[FINAL_TEST_SESSION_HELPER] isExit');
    iNoodle.db.collection('finalTestSession')
      .find({student:finalTestSession.student, course: finalTestSession.course})
      .limit(1)
      .toArray((err, result) => {
        console.log(`finalTestSession ${idx}`);
        if(result.length === 0)
          iNoodle.db.collection('finalTestSession').insert(finalTestSession);
      });
    return this;
  }
}
