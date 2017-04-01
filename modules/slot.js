const TIME_OUT = process.env.NODE_ENV == 'production' ?
                 60 * 1000 : // a minute
                 10 * 1000;

var https = require('https');
var http = require('http');
var fs = require('fs');
var events = require('events');
var util = require('util');
var cheerio = require('cheerio');
var testUtil = require('./testUtil.js');
var inoodleUtil = require('../utils/inoodleUtil.js');
var logger = undefined;

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
  var pro = this.config.options.port == 80 ?
            http :
            (this.config.options.port == 443 ? https: undefined);
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
  this.data.forEach((slotData, idx) => {
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
  bulk.execute((err, result) => {
    if( err ) {
      logger.info(err);
    } else {
      logger.info('update done');
    }
    console.timeEnd('slot_update');
  });
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
  isContinueToRun: function() {
    return true;
  },
  run: function() {
    logger.info('[SLOT_MODULE] run')
    var config = {
      options: inoodleUtil.deepCopy(iNoodle.config.resource.slot)
    };
    config.options.path = this.reqDatas[this.currentIndex].path;
    config.term = this.reqDatas[this.currentIndex].term;
    config.label = this.currentIndex;
    (new (SlotCrawler)).init(config).crawl();
    this.currentIndex = (this.currentIndex + 1) % this.reqDatas.length;
    if( this.isContinueToRun() ) {
      setTimeout(() => this.run(), TIME_OUT);
    }
    return this;
  },
  start: function() {
    logger = global.iNoodle.logger;
    logger.info('[SLOT_MODULE] start');
    // term
    //
    this.reqDatas =
    [
      {
        path:'/congdaotao/module/qldt/index.php?r=sinhvienLmh/'+
             'admin&SinhvienLmh%5Bterm_id%5D=021&SinhvienLmh_page=50&pageSize=500',
        term: '2016-2017-1'
      },
      {
        path:'/congdaotao/module/qldt/index.php?r=sinhvienLmh/'+
             'admin&SinhvienLmh%5Bterm_id%5D=022&SinhvienLmh_page=50&pageSize=500',
        term: '2016-2017-2'
      }
    ];
    this.run();
    return this;
  }
}
