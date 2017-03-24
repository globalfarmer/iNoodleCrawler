var https = require('https');
var fs = require('fs');
var testUtil = require('./testUtil.js');
var logger = iNoodle.logger;
var db = undefined;
var querystring = require('querystring');
var cheerio = require('cheerio');

var FinalTestSession = require('../models/FinalTestSession');
var Course = require('../models/Course');
var Students = require('../models/Students');
var finalTestSessionHelper = require('../helpers/finalTestSessionHelper');

var term;
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
    logger.info('[FINAL_TEST_SESSION] start crawling');
    this.options = iNoodle.config.resource.finalTestSession;
    this.options.path = this.reqDatas[this.nextCrawler].path;
    this.crawl(this.reqDatas[this.nextCrawler].keysearch);
  },
  init: function() {
  	db = global.iNoodle.db;
  	var final = this;
  	final.reqDatas = [];
  	db.collection('slot').distinct('student.code').then(function (results) {
  		for (var i = 0; i < results.length; i++) {
		    var data = 
		    {
		        path: '/congdaotao/module/dsthi_new/index.php?r=lopmonhoc/napmonthi',
		        keysearch: results[i]
		    };
		    final.reqDatas.push(data);
  		}
  		final.nextCrawler = 0;
  		final.run();
	    return final;
  	});
  },
  crawl: function(keysearch) {
    logger.info("[FINAL_TEST_SESSION] crawl");
    var dataPost = querystring.stringify({
      keysearch: '16020031'
    });
    console.log(this.options);
    this.rawData = '';
    var req = https.request(this.options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        logger.info("[FINAL_TEST_SESSION] crawl_onData_"+this.nextCrawler);
        this.rawData += chunk;
      });
      response.on('end', () => {
        logger.info("[FINAL_TEST_SESSION] crawl_onEnd_"+this.nextCrawler);
        this.parse().update();
        if( iNoodle.env === 'development') {
          testUtil.saveIntoFile(`final_test_session_${this.nextCrawler}.html`, this.rawData);
        }
        this.nextCrawler = (this.nextCrawler + 1) % this.reqDatas.length;
        // setTimeout(this.run(), iNoodle.TIME_OUT);
      });
    });
    req.write(dataPost);
    req.end();
    return this;
  },
  parse: function() {
    this.data = [];
    var $ = cheerio.load(this.rawData);

    term = $('.span-19 h1').text().trim();
    if (term.search('I')){
    	term = term.slice(term.length-9, term.length) + '-1';
    }else term = term.slice(term.length-9, term.length) + '-2';

    var table = $('table.items tbody');
    var rows = $('tr', table);
    for (var i = 0; i < rows.length; i++) {
    	var final = [];
    	$('td',rows[i]).each((idx, col) => {
    		final.push($(col).text().trim() || "");
    	});
    	this.data.push(final);
    }
    return this;
  },
  update: function() {
  	if (this.data[0][0] != 'No results found.'){
	  	var studentKey = {"code": 1, "fullname": 2, "birthday": 3, "klass": 4};
	    var courseKey = {"code": 6, "name": 7};
	    var student, course, final;
	    for (var i = 0; i < this.data.length; i++) {
	    	student = {};
	    	Object.keys(studentKey).forEach((k) => {
	    		student[k] = this.data[i][studentKey[k]];
	    	})
	    	student = Students.refine(student);

	    	course = {};
	    	Object.keys(courseKey).forEach((k) => {
	    		course[k] = this.data[i][courseKey[k]];
	    	})
	    	course = Course.refine(course);

	    	var datePart = this.data[i][8].split('/');
	    	var date = datePart[1] + "/" + datePart[0] + "/" + datePart[2];
	    	final = FinalTestSession.refine({
	    		course: course,
	    		student: student,
	    		seat: this.data[i][5],
				time: new Date(date + ' ' + this.data[i][9]),
				sessionNo: this.data[i][10],
				room: this.data[i][11],
				area: this.data[i][12],
				type: this.data[i][13],
				term: term,
	    	});

	    	console.log(`row ${i}`);
	      	finalTestSessionHelper.saveIfNotExist(final, i);
	    }
	}
    return this;
  }
}
