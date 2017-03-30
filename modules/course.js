// var TIME_OUT_A_DAY = 24 * 60 * 60 * 1000;
var TIME_OUT_A_DAY = iNoodle.TIME_OUT;

var https = require('https');
var http = require('http');
var cheerio = require('cheerio');
var testUtil = require('./testUtil.js');
var Course = require('../models/Course');
var courseHelper = require('../helpers/courseHelper');

var logger = global.iNoodle.logger;
var db = undefined;

// module contain 4 method
// run: main flow of this module
// crawl: request and get back raw data(html data)
// parse: parse raw data into a array of object
// update: update data on database
module.exports = {
    options: null,
    reqDatas: [],
    rawData: null,
    data: [],
    nextCrawler: null,
    run: function() {
        logger.info('[COURSE_CLASS] start crawling');
        this.options = iNoodle.config.resource.course;
        this.options.path = this.reqDatas[this.nextCrawler].path;
        this.crawl();
    },
    init: function() {
        db = iNoodle.db;
        this.reqDatas = [
          {
            path: '/tkb',
            term: '2016-2017-2'
          }
        ];
        this.nextCrawler = 0;
        this.run();
        return this;
    },
    crawl: function() {
        logger.info("[COURSE_CLASS] crawl");
        console.log(this.options);
        this.rawData = '';
        var pro = this.options.port == 80 ? http : (this.options.port == 443 ? https : undefined);
        var req = pro.request(this.options, (response) => {
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                logger.info("[COURSE_CLASS] crawl_onData_" + this.nextCrawler);
                this.rawData += chunk;
            });
            response.on('end', () => {
                logger.info("[COURSE_CLASS] crawl_onEnd_" + this.nextCrawler);
                this.parse().update();
                if (iNoodle.env === 'development') {
                    testUtil.saveIntoFile(`course_${this.nextCrawler}.html`, this.rawData);
                }
                this.nextCrawler = (this.nextCrawler + 1) % this.reqDatas.length;
                setTimeout(() => this.run(), TIME_OUT_A_DAY);
            });
        });
        req.end();
        return this;
    },
    parse: function() {
        logger.info("[COURSE_CLASS] parsing");

        var $ = cheerio.load(this.rawData);
        var i = 1;
        this.data = [];

        var table = $("[name='slt_mamonhoc_filter']").parent().parent().parent();
        // logger.info(table.find('tr').eq(1).find('td').eq(1).text());
        var course;
        while (!(table.find('tr').eq(i).text() === "")) {
            course = [];
            for (var j=1; j < 12; j++){
                course.push(table.find('tr').eq(i).find('td').eq(j).text());
            }

            this.data.push(course);
            // logger.info(this.data[i - 1]);
            i++;
        }
        return this;
    },
    update: function() {
        logger.info("[COURSE_CLASS] updating");

        var courseKey = {
          "code": 3, "name": 1, "TC": 2, "teacher": 4, "students": 5,
          "dayPart": 6, "dayInWeek": 7, "session": 8, "amphitheater": 9, "group": 10
        }
        var course;
        for (var i = 0; i < this.data.length; i++) {
            course = {};
            Object.keys(courseKey).forEach( (k) => {
                course[k] = this.data[i][courseKey[k]];
            })
            course.term = this.reqDatas[this.nextCrawler].term;
            course = Course.refine(course);
            courseHelper.saveIfNotExist(course, i);
        }
        return this;
    }
}
