//
global.iNoodle = {};
global.iNoodle.env = process.env.NODE_ENV || "development";
global.iNoodle.TIME_OUT = 50000;
var config = global.iNoodle.config = require('./config.json')[iNoodle.env];
var winston = require('winston');
var MongoClient = require('mongodb').MongoClient;

//logger
var logger = global.iNoodle.logger = new (winston.Logger)({
transports:
[
  new (winston.transports.Console)(),
  new (winston.transports.File)({ filename: 'public/inoodle-crawler.log' })
]
});

// modules
var announce = require('./modules/announce.js');
var course = require('./modules/course.js');
var finalTestSession = require('./modules/finalTestSession.js');
var slot = require('./modules/slot.js');
var student = require('./modules/student.js');
var scoreboard = require('./modules/scoreboard');

// helpers
var helpers = global.iNoodle.helpers = {};
helpers.announceHelper = require('./helpers/announceHelper.js');
helpers.courseHelper = require('./helpers/courseHelper.js');
helpers.finalTestSessionHelper = require('./helpers/finalTestSessionHelper.js');
helpers.courseHelper = require('./helpers/courseHelper.js');
helpers.studentHelper = require('./helpers/studentHelper.js')
helpers.scoreboardHelper = require('./helpers/scoreboardHelper.js');

( () => {
  logger.info('[START] crawler start working');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	MongoClient.connect(
    config.db.host,
    (err, db) =>
    {
      if(!err)
      {
        logger.info(`[DB] connecting ${config.db.host} successfully`);
        global.iNoodle.db = db;
        // announce.initAndRun();
        course.init();
        // finalTestSession.initAndRun();
        slot.init();
        // student.init();
        // scoreboard.init();
      }
      else
      {
        logger.error(JSON.stringify(err));
      }
    }
  );
}());
