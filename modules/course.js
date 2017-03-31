const TIME_OUT_A_DAY = process.env.NODE_ENV == 'production' ?
                        24 * 60 * 60 * 1000 :
                        5000;

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
  return this;
}
CourseCrawler.prototype.crawl = function() {
  logger.info(`[COURSE] crawl_start ${this.config.label}`);
  console.log(this.config.options);
  var pro = this.config.options.port == 80 ?
            http :
            (this.config.options.port == 443 ? https : undefined);
  var req = pro.request(this.config.options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
          logger.info(`[COURSE] crawl_onData ${this.config.label}`);
          this.rawData += chunk;
      });
      response.on('end', () => {
          logger.info(`[COURSE] crawl_onEnd ${this.config.label}`);
          if (iNoodle.env === 'development') {
              testUtil.saveIntoFile(`course_${this.config.label}.html`, this.rawData);
          }
          this.parse().update();
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
  console.log(`[COURSE] get term ${strTerm}`);
  var words = strTerm.split(' ');
  this.config.term = [words[5], words[3]].join('-');
  return this;
}
CourseCrawler.prototype.parse = function() {
  logger.info("[COURSE] parsing");
  console.time('[COURSE] parsing');
  var $ = cheerio.load(this.rawData);
  this.getTerm($('h2').eq(0).text().trim());

  var table = $("[name='slt_mamonhoc_filter']").parent().parent().parent();
  // logger.info(table.find('tr').eq(1).find('td').eq(1).text());
  this.data = $('tr', table).map((row_idx, row) => {
      return $('td, th', row).map((col_idx, col) => {
          return $(col).text().trim() || '';
      })
  });
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
  var course;
  for (var i = 0; i < this.data.length; i++) {
      course = {};
      Object.keys(courseKey).forEach( (k) => {
          course[k] = this.data[i][courseKey[k]];
      })
      course = Course.refine(course);
      courseHelper.saveIfNotExist(course, i);
  }
  console.timeEnd('[COURSE] updating');
  this.emit('end');
  return this;
}

// module contain 4 method
// run: main flow of this module
// crawl: request and get back raw data(html data)
// parse: parse raw data into a array of object
// update: update data on database
module.exports = {
    crawlers: [],
    curCrawler: 0,
    reqDatas: [],
    start: function() {
      logger.info('[COURSE] start');
        this.reqDatas = [
          {
            path: '/tkb'
          }
        ];
        var config = {
          options: inoodle.deepCopy(iNoodle.config.resource.course)
        };
        var crawler;
        this.crawlers = this.reqDatas.map((reqData, idx) => {
          config.options.path = reqData.path;
          config.label = idx;
          crawler = (new CourseCrawler()).
                    init(config).
                    on('end', () => this.run());
          return crawler;
        });
        this.run();
    },
    run: function() {
      logger.info('[COURSE] run');
      this.crawlers[this.curCrawler].crawl();
      this.curCrawler = (this.curCrawler + 1) % this.crawlers.length;
      return this;
    }
}
