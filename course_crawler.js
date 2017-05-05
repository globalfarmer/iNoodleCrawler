//
global.iNoodle = {};
global.iNoodle.env = process.env.NODE_ENV || "development";
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
var course = require('./modules/course.js');

// helpers
var helpers = global.iNoodle.helpers = {};

(() => {
  logger.info('[COURSE_CRAWLER >> START] crawler start working');
  logger.info(`env ${iNoodle.env}`);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	MongoClient.connect(
    config.db.host,
    (err, db) =>
    {
      if(!err)
      {
        logger.info(`[COURSE_CRAWLER >> DB] connecting ${config.db.host} successfully`);
        global.iNoodle.db = db;
        course.start();
      }
      else
      {
        logger.error(JSON.stringify(err));
      }
    }
  );
})();
