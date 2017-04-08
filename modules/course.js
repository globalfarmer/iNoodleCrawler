const TIME_OUT = process.env.NODE_ENV == 'production' ?
                        30 * 60 * 1000 : // 30 mins
                        10000;
const ACTIVE_TIME = 10;
var https = require('https');
var http = require('http');
var cheerio = require('cheerio');
var testUtil = require('./testUtil.js');
var Course = require('../models/Course');
var courseHelper = require('../helpers/courseHelper');
var events = require('events')
var util = require('util');
var inoodle = require('../utils/inoodleUtil.js');
var logger = global.iNoodle.logger;
var db = undefined;

// course crawler class
var CourseCrawler = function(){
    events.EventEmitter.call(this)
}
util.inherits(CourseCrawler, events.EventEmitter);
// constructor
CourseCrawler.prototype.init = function(config) {
  this.config = inoodle.deepCopy(config) || {};
  this.rawData = '';
  this.data = [];
  this.term = undefined;
  return this;
}
CourseCrawler.prototype.crawl = function() {
  logger.info(`[COURSE] crawl_start ${this.config.label}`);
  console.log(this.config.options);
  var pro = this.config.options.port == 80 ?
            http :
            (this.config.options.port == 443 ? https : undefined);
  if( pro == https) {
    console.log("https");
  }
  else {
    console.log('http');
  }
  var req = pro.request(this.config.options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
          // logger.info(`[COURSE] crawl_onData ${this.config.label}`);
          this.rawData += chunk;
      });
      response.on('end', () => {
          logger.info(`[COURSE] crawl_onEnd ${this.config.label}`);
          if (iNoodle.env === 'development') {
              testUtil.saveIntoFile(`course_${this.config.label}.html`, this.rawData);
          }
          this.
          parse().
          update();
      });
  }).on('error', (err) => {
    logger.error(err);
    console.log(err);
  });
  req.end();
  return this;
}
/**
* @param strTerm a string like 'Hoc ky I nam hoc 2016-2017'
* @return this
*/
CourseCrawler.prototype.getTerm = function(strTerm) {
  logger.info(`[COURSE] get term ${strTerm}`);
  var words = strTerm.split(' ');
  this.term = [words[5], words[2]].join('-');
  logger.info(`[COURSE] ${this.term}`);
  return this;
}
CourseCrawler.prototype.parse = function() {
  logger.info("[COURSE] parsing");
  console.time('[COURSE] parsing');
  var $ = cheerio.load(this.rawData);
  this.getTerm($('h2').eq(0).text().trim());
  var table = $("[name='slt_mamonhoc_filter']").parent().parent().parent();
  $('tr', table).each((row_idx, row) => {
      var course = $('td', row).map((col_idx, col) => {
          return $(col).text().trim() || '';
      }).get();
      this.data.push(course);
  });
  // console.log(`Data ${this.data.length}`);
  // for(var i = 0; i < 10; i++) {
    // console.log(`data index ${i}`);
    // console.log(this.data[i]);
  // }
  // ignore header
  this.data.shift();
  console.timeEnd('[COURSE] parsing')
  return this;
}
CourseCrawler.prototype.update = function() {
  logger.info("[COURSE] updating");
  console.time('[COURSE] updating');
  var courseKey = {
    "code": 4, "name": 2, "tc": 3, "teacher": 5, "students": 6,
    "daypart": 7, "dayInWeek": 8, "session": 9, "amphitheater": 10, "group": 11
  }
  var bulk = iNoodle.db.collection('course').initializeOrderedBulkOp();
  this.data.forEach((data, data_idx) => {
      var course = {};
      Object.keys(courseKey).forEach( (k) => {
          course[k] = data[courseKey[k]];
      })
      course = Course.refine(course);
      course.term = this.term;
      bulk.find(course)
      .upsert()
      .update({$set: course, $currentDate: {updatedAt: true}});
  });
  bulk.execute();
  // bulk.execute((err, result) => {
    // if(err) {
      // logger.error(err);
    // }
    // else {
      // console.log(result);
      // logger.info(`[COURSE] update done`);
    // }
  // });
  console.timeEnd('[COURSE] updating');
  return this;
}

// module contain 4 method
// run: main flow of this module
// crawl: request and get back raw data(html data)
// parse: parse raw data into a array of object
// update: update data on database
module.exports = {
    currentIndex: 0,
    reqDatas: [],
    //TODO this method check condition for running automatically
    isAllowCrawlling: function() {
      var date = new Date();
      return date.getHours() == ACTIVE_TIME;
    },
    start: function() {
      logger.info('[COURSE] start');
      this.reqDatas = [
        {
          path: '/tkb'
        }
      ];
      this.pivot = (new Date()).getTime();
      console.log(`[COURSE][RUN] pivot = ${this.pivot}`);
      this.run();
      return this;
    },
    run: function() {
      // log
      logger.info(`[COURSE][RUN] ${(new Date()).getTime() - this.pivot}`);
      // body
      if( this.isAllowCrawlling())
      {
        //log
        logger.info(`[COURSE][RUN] active at ${ACTIVE_TIME}`);
        var config = {
          options: inoodle.deepCopy(iNoodle.config.resource.course)
        };
        config.options.path = this.reqDatas[this.currentIndex].path;
        config.label = this.currentIndex;
        (new CourseCrawler()).init(config).crawl();
        this.currentIndex = (this.currentIndex + 1) % this.reqDatas.length;
      }
      else
      {
        logger.info(`[COURSE][RUN] sleepping and waitting for ${ACTIVE_TIME}`);
      }
      setTimeout(() => this.run(), TIME_OUT);
      return this;
    }
}
