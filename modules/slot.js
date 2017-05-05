// time out for crawling slot table
const TIME_OUT = 1000 * 10;
const DISCOVER_TIME_OUT = 1000 * 60 * 30;
const ACTIVE_TIME = [12, 14, 16];
const PAGE_SIZE = 250;
var querystring = require('querystring');
var https = require('https');
var http = require('http');
var fs = require('fs');
var events = require('events');
var util = require('util');
var cheerio = require('cheerio');
var testUtil = require('./testUtil.js');
var inoodleUtil = require('../utils/inoodleUtil.js');
var logger;

//models
var Student = require('../models/Student.js');
var Course = require('../models/Course.js');
var Slot = require('../models/Slot.js');


var SlotCrawler = function() {
  events.EventEmitter.call(this);
}
util.inherits(SlotCrawler, events.EventEmitter);

SlotCrawler.prototype.init = function(config)
{
  this.config = inoodleUtil.deepCopy(config);
  this.rawData = '';
  this.data = [];
  this.term = undefined;
  return this;
}

SlotCrawler.prototype.crawl = function()
{
  logger.info("[SLOTCRAWLER] crawl");
  console.time('slot_crawl');
  console.log(this.config.options);
  var pro = this.config.options.port == 443 ? https : http;
  var req = pro.request(this.config.options, (response) => {
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      this.rawData += chunk;
    });
    response.on('end', () => {
      logger.info("[SLOTCRAWLER] crawl_onEnd_"+this.config.label);
      if( iNoodle.env === 'development') {
        testUtil.saveIntoFile(`slot_${this.config.label}.html`, this.rawData);
      }
      console.timeEnd('slot_crawl');
      this.parse().update();
    });
  });
  req.end();
  return this;
}
SlotCrawler.prototype.parse = function()
{
  logger.info('[SLOTCRAWLER] parse');
  console.time('slot_parse');
  $ = cheerio.load(this.rawData);
  var tables = $('table.items');
  // console.log(tables);
  if( tables.length === 1) {
    $('tr',tables).each( (row_idx, row) => {
      var slot = [];
      $('td', row).each( (col_idx, col) => {
        // console.log(`    col ${$(col).text()}`);
        slot.push($(col).text().trim() || "");
      });
      // console.log(slot);
      this.data.push(slot);
    });
    this.data = this.data.slice(2);
    logger.info(`number of slots ${this.data.length}`);
  }
  else
  {
    logger.info("[SLOTCRAWLER] parse: have no table.items or more than one");
  }
  console.timeEnd('slot_parse');
  return this;
}
SlotCrawler.prototype.update = function()
{
    logger.info('[SLOTCRAWLER] update');
    console.time('slot_update');
    var studentKey = {"code": 1, "fullname": 2, "birthday": 3, "klass": 4};
    var courseKey = {"code": 5, "name": 6, "group": 7, "tc": 8};
    var bulk = iNoodle.db.collection('slot').initializeOrderedBulkOp();
    this.data.forEach((slotData, idx) =>
    {
        // student
        var student = {};
        Object.keys(studentKey).forEach( (k) => {
          student[k] = slotData[studentKey[k]];
        });
        student = Student.refine(student);
        // console.log(student);
        // course
        var course = {};
        Object.keys(courseKey).forEach( (k) => {
          course[k] = slotData[courseKey[k]];
        })
        course.term = this.config.term;
        course.code = course.code.split(' ').join('').toLowerCase();
        course = Course.refine(course);
        // console.log(course);
        // slot
        var slot = Slot.refine(
          {
            student: student,
            course: course,
            note: slotData[9]
          }
        );
        // console.log(slot);
        // console.log(`row ${idx}`);
        bulk.find(slot)
        .upsert()
        .update({$set: slot, $currentDate: {updatedAt: true}});
    });
    if( bulk.length > 0)
        bulk.execute();
    // bulk.execute((err, result) => {
      // if( err ) {
        // logger.info(err);
      // } else {
        // logger.info('update done');
      // }
      // console.timeEnd('slot_update');
    // });
    return this;
}

var DiscoverSlot = function()
{
  events.EventEmitter.call(this);
}
util.inherits(DiscoverSlot, events.EventEmitter);
DiscoverSlot.prototype.getTerm = function(str) {
  var words = str.split(' ');
  return [words[5], words[2]].join('-');
}
DiscoverSlot.prototype.getParams = function(obj) {
  logger.info('[DISCOVER_SLOT] getParams');
  return Object.keys(obj).map((key, idx) => {
      return `${obj[key][0]}=${obj[key][1]}`;
    }).join('&');
}
DiscoverSlot.prototype.init = function(opts, reqDatas)
{
  // log
  logger.info('[DISCOVER_SLOT >> INIT');
  console.log(opts);
  // body
  var options = inoodleUtil.deepCopy(opts);
  var rawData = '';
  if( reqDatas.length == 0)
  {
    var pro = options.port == 443 ? https : http;
    var req = pro.request(options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        rawData += chunk;
      });
      response.on('end', () => {
        logger.info('[DISCOVER_SLOT >> INIT] onEnd');
        if( iNoodle.env === 'development' ) {
          testUtil.saveIntoFile('qldt.html', rawData)
        }
        var $ = cheerio.load(rawData);
        var element = $('#SinhvienLmh_term_id');
        $('option', element).each((idx, opt) =>
        {
          if( idx > 0 )
          {
            var config = {};
            config.params =
            {
                'SinhvienLmh[term_id]': $(opt).attr('value'),
                'SinhvienLmh_page': 1,
                'pageSize': PAGE_SIZE
            };
            config.prePath = '/congdaotao/module/qldt/index.php?r=sinhvienLmh/admin&';
            config.options = {
              host: options.host,
              method: "GET",
              port: options.port,
            };
            config.options.path = config.prePath + querystring.stringify(config.params);
            config.term = this.getTerm($(opt).text().trim());
            this.crawl(config, reqDatas);
          }
        });
      });
    });
    req.end();
  }
  return this;
}
DiscoverSlot.prototype.crawl = function(config, reqDatas) {
    logger.info('[DISCOVER_SLOT >> CRAWL]');
    console.log(config);
    var config = inoodleUtil.deepCopy(config);
    var rawData = '';
    var pro = config.options.port == 443 ? https : http;
    var req = pro.request(config.options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        rawData += chunk;
      });
      response.on('end', () => {
        logger.info('[DISCOVER_SLOT] crawl onEnd');
        if(iNoodle.env == 'development') {
          testUtil.saveIntoFile(config.term + '.html', rawData);
        }
        var $ = cheerio.load(rawData);
        var numberOfSlot = parseInt($('.summary').text().trim().split(' ').slice(-1));
        console.log(`number of page ${(numberOfSlot+PAGE_SIZE-1)/PAGE_SIZE}`);
        for(var i = 1; i <= (numberOfSlot + PAGE_SIZE - 1) / PAGE_SIZE; i++) {
          var _config = inoodleUtil.deepCopy(config);
          _config.params.SinhvienLmh_page = i;
          _config.options.path = _config.prePath + querystring.stringify(_config.params);
          reqDatas.push(_config);
        }
      });
    });
    req.end();
    return this;
}
module.exports = {
    reqDatas: [],
    //TODO this method check condition for running automatically
    isAllowCrawlling: function() {
      var date = new Date();
      return ACTIVE_TIME.find((hour) => hour == date.getHours());
    },
    start: function() {
      logger = global.iNoodle.logger;
      logger.info('[SLOT_MODULE >> START]');
      this.init();
      this.run();
    },
    run: function() {
      logger.info('[SLOT_MODULE >> RUN]');
      if( this.reqDatas.length > 0 ) {
        var config = this.reqDatas.shift();
        config.label = `${config.term}_page_${config.params.SinhvienLmh_page}.html`;
        (new SlotCrawler()).init(config).crawl();
      }
      setTimeout(() => this.run(), TIME_OUT);
      return this;
    },
    init: function() {
      logger.info('[SLOT_MODULE >> INIT]');
      var allowedTime = this.isAllowCrawlling();
      if( allowedTime != -1)
      {
        logger.info(`[SLOT_MODULE >> INIT] active at ${allowedTime}`);
        var options = inoodleUtil.deepCopy(iNoodle.config.resource.slot);
        options.path = '/congdaotao/module/qldt/';
        (new DiscoverSlot()).init(options, this.reqDatas);
      }
      else
      {
        logger.info(`[SLOT_MODULE >> INIT] sleeping and waitting for ${ACTIVE_TIME.toString()}`);
      }
      setTimeout( () => this.init(), DISCOVER_TIME_OUT);
      return this;
    }
}
