const TIME_OUT = 1000 * 60 * 60;
var logger;
module.exports = {
    // adhoc method
    getCurrentTerm: function(date) {
        var now = date;
        if( now.getMonth() < 8) {
            var y = [parseInt(now.getFullYear())-1, now.getFullYear()].join('-');
            if( now.getMonth() >= 3) {
                return [['hkii',y].join(''), [y,'2'].join('-')];
            }
            return [['hki',y].join(''), [y,'1'].join('-')]
        }
        var y = [now.getFullYear(), parseInt(now.getFullYear())+1].join('-');
        return [['hki',y].join(''), [y,'1'].join('-')];
    },
    start: function() {
        logger = iNoodle.logger;
        logger.info("[STUDENT >> START]");
        var currentTerm = this.getCurrentTerm(new Date());
        logger.info(currentTerm.toString());
        iNoodle.db.collection('slot').distinct('student', {'course.term': currentTerm[1]}).then((students)=>
        {
            logger.info(`number of active students in ${currentTerm[1]} are ${students.length}`);
            var bulk = iNoodle.db.collection('student').initializeUnorderedBulkOp();
            students.forEach((student) => {
                bulk.find({code: student.code}).upsert().update({$set: student, $currentDate: {updatedAt: true}});
            });
            if( bulk.length > 0) {
                bulk.execute((err, results) =>
                {
                    if( err )
                        logger.error(err);
                    else {
                        logger.info('update student successfully');
                        logger.info(JSON.stringify(results));
                    }
                });
            }
        });
        setTimeout(() => this.start(), TIME_OUT);
    }
}
