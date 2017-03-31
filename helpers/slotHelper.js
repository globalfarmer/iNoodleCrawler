var logger = iNoodle.logger;
module.exports = {
  saveIfNotExist: function(slot, idx) {
    logger.info('[SLOT_HELPER] isExit');
    // console.log(slot);
    iNoodle.db.collection('slot')
      .find({student:slot.student, course: slot.course})
      .limit(1)
      .toArray((err, result) => {
        // console.log(`number of slot ${result.length}`);
        console.log(`slot ${idx}`);
        if(result.length === 0)
          iNoodle.db.collection('slot').insert(slot);
      });
    return this;
  }
}
