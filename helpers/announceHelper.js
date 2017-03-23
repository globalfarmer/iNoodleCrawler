var logger = iNoodle.logger;
module.exports = {
  saveIfNotExist: function(announce, idx) {
    logger.info('[ANNOUNCE_HELPER] isExit');
    iNoodle.db.collection('announce')
      .find({link: announce.link})
      .limit(1)
      .toArray((err, result) => {
        console.log(`announce ${idx}`);
        if(result.length === 0)
          iNoodle.db.collection('announce').insert(announce);
      });
    return this;
  }
}