const DISCOVER_TIMEOUT = 1000 * 60 * 60;
const FINAL_TEST_TIMEOUT = 1000 * 60;

var https = require('https');
var fs = require('fs');
var testUtil = require('./testUtil.js');
var logger;
var db = undefined;
var querystring = require('querystring');
var cheerio = require('cheerio');
var util = require('util');
var events = require('events');

var FinalTest = require('../models/FinalTest');
var Course = require('../models/Course');
var Students = require('../models/Students');
var finalTestHelper = require('../helpers/finalTestHelper');

var FinalTestCrawler = function() {
  events.EventEmitter.call(this);
}
util.inherits(FinalTestCrawler, events.EventEmitter);
FinalTestCrawler.prototype.init(config)
{
    this.config = inoodleUtil.deepCopy(config);
    this.rawData = '';
    this.data = [];
    return this;
}
FinalTestCrawler.prototype.crawl()
{
    logger.info("[FINAL_TEST_CRAWLER >> CRAWL");
    console.log(this.config);
    var dataPost = querystring.stringify(this.config.params);
    var pro = http;
    if( this.config.options.port == 443 ) pro = https;
    var req = pro.request(this.config.options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        this.rawData += chunk;
      });
      response.on('end', () => {
        if( iNoodle.env === 'development') {
          testUtil.saveIntoFile(this.config.label+'.html', this.rawData);
        }
        logger.info("[FINAL_TEST_CRAWLER >> CRAWL >> onEnd]");
        this.parse().update();
      });
    });
    req.write(dataPost);
    req.end();
    return this;
}
FinalTestCrawler.prototype.parse()
{
    var $ = cheerio.load(this.rawData);
    var table = $('table.items tbody');
    $('tr', table).each((row_idx, row) =>
    {
        var finaltest = [];
        $('td', row).each((col_idx, col) =>
        {
            finaltest.push($(col).text().trim() || "");
        });
        this.data.push(finaltest);
    });
    return this;
}
FinalTestCrawler.prototype.update()
{
    var bulk = iNoodle.collection('finaltest').initializeOrderedBulkOp();
    var finaltests = this.data.map((finaltest, idx) =>
    {
        return
        {
            student:
            {
                code: finaltest[1],
                fullname: finaltest[2],
                birthday: finaltest[3],
                klass: finaltest[4]
            },
            course:
            {
                code: finaltest[6].split(' ').join(''),
                name: finaltest[7],
                term: this.config.term
            },
            seat: finaltest[5],
            time: this.getFinalTestTime(finaltest[6], finaltest[7]),
            sessionNo: finaltest[10],
            term: this.config.term,
            room: finaltest[11],
            area: finaltest[12],
            type: finaltest[13]
        };
    });
    finaltests.forEach((finaltest, idx) => {
        bulk.find
        (
            {
                'student.code': finaltest.student.code,
                'course.code': finaltest.course.code,
                'term': finaltest.term
            }
        )
        .upsert()
        .update({$set: finaltest, $currentData: {updatedAt: true}});
    });
    bulk.execute();
    return this;
}
FinalTestCrawler.prototype.getFinalTestTime(day, time)
{
    var days = day.split('/');
    var times = time.split(':');
    return new Date(days[2], days[1], days[0], times[0], times[1], 0, 0);
}
module.exports = {
    reqDatas: [],
    lastDiscovery: undefined,
    //TODO this method check condition for running automatically
    isAllowCrawlling: function()
    {
      var now = new Date();
      var discovered = (this.lastDiscovery !== undefined && now.getDay() == this.lastDiscovery.getDay());
      if( now.getDay() % 3 == 0 && now.getHours() == ACTIVE_TIME && !discovered )
      {
          this.lastDiscovery = now;
          return true;
      }
      return false;
    },
    start: function()
    {
        logger = iNoodle.logger;
        logger.info('[FINAL_TEST >> START]');
        this.discover().crawlFinalTest();
        return this;
    },
    discover: function()
    {
        logger.info('[FINAL_TEST >> DISCOVER]');
        if( this.isAllowCrawlling() )
        {
            logger.info('[FINAL_TEST >> DISCOVER]');
            var config =
            {
                options:
                {
                    host: '112.137.129.87',
                    port: 443,
                    path: 'congdaotao/module/dsthi_new',
                    method: GET
                }
            };
            var pro = http;
            var rawData = "";
            if( config.options.port == 443) pro = https;
            var req = pro.request(config.options, (response) => {
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    rawData += chunk;
                });
                response.on('end', () => {
                    logger.info('[FINAL_TEST >> DISCOVER >> onEnd]');
                    if(iNoodle.env === 'development')
                    {
                        testUtil.saveIntoFile('finaltest_discovery.html', rawData);
                    }
                    var $ = cheerio.load(rawData);
                    var term;
                    var termWords = $('#content h1').text().trim().split(' ');
                    if( termWords[5] == '1' || termWords[5] == 'I')
                        term = [termWords[8], '1'].join('-');
                    else
                        term = [termWords[8], '2'].join('-');
                    iNoodle.db.collection('slot').distinct('student.code', {'course.term': term}).then((codes) =>
                    {
                        this.reqDatas = codes.map((code, idx) => {
                            return
                            {
                                params:
                                {
                                    keysearch: code
                                },
                                options:
                                {
                                    host: '112.137.129.87',
                                    method: 'POST',
                                    port: 443,
                                    path: 'congdaotao/module/dsthi_new/index.php?r=lopmonhoc/napmonthi'
                                },
                                label: `finaltest_{term}_{code}`,
                                term: term
                            }
                        })
                    })
                });
            }).on('error', (err) => {
                logger.info('[FINAL_TEST >> DISCOVER >> onError]');
                logger.error(err);
            });
            req.end();
        }
        else
        {
            logger.info(`[FINAL_TEST >> DISCOVER] waiting for {ACTIVE_TIME}`);
        }
        setTimeout(() => this.discover(), DISCOVER_TIMEOUT);
        return this;
    },
    crawlFinalTest: function()
    {
        logger.info('[FINAL_TEST >> CRAWL_FINAL_TEST]');
        if( this.reqDatas.length > 0)
        {
            var config = this.reqDatas.shift();
            config.label = `finaltest_{config.term}_{config.params.studentcode}`;
            (new FinalTest()).init(config).crawl();
        }
        setTimeout(() => this.crawlFinalTest(), FINAL_TEST_TIMEOUT);
        return this;
    }
}
