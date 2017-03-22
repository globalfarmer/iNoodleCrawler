var https = require('https');
var fs = require('fs');
var cheerio = require('cheerio');
var testUtil = require('./testUtil.js');
var $ = undefined;
var logger = undefined;
var db = undefined;

//models
var Student = require('../models/Student.js');
var Course = require('../models/Course.js');
var Slot = require('../models/Slot.js');

//helpers
var slotHelper = require('../helpers/slotHelper.js');
// module contain 4 method
// run: main flow of this module
// crawl: request and get back raw data(html data)
// parse: parse raw data into a array of object
// update: update data on database
module.exports = {
  options: null,
  reqDatas : [],
  rawData: null,
  data: [],
  nextCrawler: null,
  run: function() {
    logger.info('[SLOT] start crawling');
    this.options = iNoodle.config.resource.slot;
    this.options.path = this.reqDatas[this.nextCrawler].path;
    this.crawl();
  },
  init: function() {
    db = global.iNoodle.db;
    logger = global.iNoodle.logger;
    this.reqDatas =
    [
      {
        path:'/congdaotao/module/qldt/index.php?r=sinhvienLmh/'+
             'admin&SinhvienLmh%5Bterm_id%5D=021&ajax=sinhvien-lmh-grid&SinhvienLmh_page=1&pageSize=30000',
        term: '2016-2017-1'
      },
      {
        path:'/congdaotao/module/qldt/index.php?r=sinhvienLmh/'+
             'admin&SinhvienLmh%5Bterm_id%5D=022&ajax=sinhvien-lmh-grid&SinhvienLmh_page=1&pageSize=30000',
        term: '2016-2017-2'
      }
    ];
    this.nextCrawler = 0;
    this.run();
    return this;
  },
  crawl: function() {
    logger.info("[SLOT] crawl");
    console.log(this.options);
    this.rawData = '';
    var req = https.request(this.options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        logger.info("[SLOT] crawl_onData_"+this.nextCrawler);
        this.rawData += chunk;
      });
      response.on('end', () => {
        logger.info("[SLOT] crawl_onEnd_"+this.nextCrawler);
        if( iNoodle.env === 'development') {
          testUtil.saveIntoFile(`slot_${this.nextCrawler}.html`, this.rawData);
        }
        this.parse().update();
        this.nextCrawler = (this.nextCrawler + 1) % this.reqDatas.length;
        setTimeout(this.run(), iNoodle.TIME_OUT);
      });
    });
    req.end();
    return this;
  },
  parse: function() {
    this.data = [];
    $ = cheerio.load(this.rawData);
    var tables = $('table.items');
    // console.log(tables);
    if( tables.length === 1) {
      var rows = $('tr',tables);
      console.log(`number of rows ${rows.length}`);
      var slot;
      rows.each( (row_idx, row) => {
        // console.log(`row ${row_idx}`);
        slot = [];
        $('th, td', row).each( (col_idx, col) => {
          // console.log(`    col ${$(col).text()}`);
          slot.push($(col).text().trim() || "");
        });
        // console.log(slot);
        this.data.push(slot);
      });
      this.data = this.data.slice(2);
      // console.log(this.data);
      // console.log(`number of slots ${this.data.length}`);
    }
    else
    {
      logger.info("[SLOT][PARSE] have no table.items or more than one");
    }
    return this;
  },
  update: function() {
    var studentKey = {"code": 1, "fullname": 2, "birthday": 3, "klass": 4};
    var courseKey = {"code": 5, "name": 6, "group": 7, "tc": 8};
    var student, course, slot;
    this.data.forEach((slotData, idx) => {
      // student
      student = {};
      Object.keys(studentKey).forEach( (k) => {
        student[k] = slotData[studentKey[k]];
      });
      student = Student.refine(student);
      // console.log(student);
      // course
      course = {};
      Object.keys(courseKey).forEach( (k) => {
        course[k] = slotData[courseKey[k]];
      })
      course.term = this.reqDatas[this.nextCrawler].term;
      course = Course.refine(course);
      // console.log(course);
      // slot
      slot = Slot.refine(
        {
          student: student,
          course: course,
          note: slotData[9]
        }
      );
      // console.log(slot);
      console.log(`row ${idx}`);
      slotHelper.saveIfNotExist(slot, idx);
    });
    return this;
  }
}
