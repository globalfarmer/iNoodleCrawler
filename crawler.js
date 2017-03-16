//
var env = process.env.NODE_ENV || "development";
var config = require('./config.json')[env];
var winston = require('winston');
var MongoClient = require('mongodb').MongoClient;

// modules
var announce = require('./modules/announce.js');
var courseClass = require('./modules/courseClass.js');
var finalTestSession = require('./modules/finalTestSession.js');
var slot = require('./modules/slot.js');
var student = require('./modules/student.js');
var scoreboard = require('./modules/scoreboard');
//logger
var logger = new (winston.Logger)({
transports: [
  new (winston.transports.Console)(),
  new (winston.transports.File)({ filename: '/tmp/inoodle-crawler.log' })
]
});

( () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	MongoClient.connect(
    config.db.host,
    (err, db) => {
      if(!err) {

      }
      else
      {

      }
    }
  );
}());
