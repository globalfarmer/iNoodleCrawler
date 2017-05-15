const DISCOVER_TIMEOUT = 1000 * 60 * 30;
const FINAL_TEST_TIMEOUT = 1000 * 3;

const ACTIVE_TIME = 5;

var https = require('https');
var http = require('http');
var fs = require('fs');
var testUtil = require('./testUtil.js');
var querystring = require('querystring');
var cheerio = require('cheerio');
var util = require('util');
var events = require('events');
var logger;

var inoodleUtil = require('../utils/inoodleUtil');

var FinalTestCrawler = function()
{
  events.EventEmitter.call(this);
}
util.inherits(FinalTestCrawler, events.EventEmitter);
FinalTestCrawler.prototype.getFinalTestTime = function(day, time)
{
    var days = day.split('/');
    var times = time.split(':');
    return new Date(days[2], parseInt(days[1])-1, days[0], times[0]+7, times[1]);
}
FinalTestCrawler.prototype.init = function(config)
{
    logger.info("[FINAL_TEST_CRAWLER >> INIT");
    this.config = inoodleUtil.deepCopy(config);
    this.rawData = '';
    this.data = [];
    return this;
}
FinalTestCrawler.prototype.crawl = function()
{
    logger.info("[FINAL_TEST_CRAWLER >> CRAWL");
    // console.log(this.config);
    var dataPost = querystring.stringify(this.config.params);
    var pro = http;
    if( this.config.options.port == 443 ) pro = https;
    if (this.config.options.method.toUpperCase() == 'GET') this.config.options.path += '?' + dataPost;
    var req = pro.request(this.config.options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        this.rawData += chunk;
      });
      response.on('end', () => {
        if( iNoodle.env === 'development') {
          testUtil.saveIntoFile(`${this.config.label}.html`, this.rawData);
        }
        logger.info("[FINAL_TEST_CRAWLER >> CRAWL >> onEnd]");
        this.parse().update();
      });
    });
    if (this.config.option.method.toUpperCase() == "POST") req.write(dataPost);
    req.end();
    return this;
}
FinalTestCrawler.prototype.parse = function()
{
    logger.info("[FINAL_TEST_CRAWLER >> PARSE");
    var $ = cheerio.load(this.rawData);
    var table = $('table.items tbody');
    $('tr', table).each((row_idx, row) =>
    {
        var ftest = [];
        $('td', row).each((col_idx, col) =>
        {
            ftest.push($(col).text().trim() || "");
        });
        // console.log(`row ${row_idx} ${JSON.stringify(ftest)}`);
        this.data.push(ftest);
    });
    return this;
}
FinalTestCrawler.prototype.update = function()
{
    logger.info("[FINAL_TEST_CRAWLER >> UPDATE");
    var bulk = iNoodle.db.collection('finaltest').initializeOrderedBulkOp();
    var ftests = this.data.map((ftest, idx) =>
    {
        if( ftest.length < 14 )
        {
            console.log(this.config);
            // console.log(idx);
            return undefined;
        }
        return {
            student:
            {
                code: ftest[1],
                fullname: ftest[2],
                birthday: ftest[3],
                klass: ftest[4],
            },
            course:
            {
                code: ftest[6].split(' ').join('').toLowerCase(),
                name: ftest[7],
                term: this.config.term
            },
            seat: ftest[5],
            time: this.getFinalTestTime(ftest[8], ftest[9]),
            sessionNo: ftest[10],
            term: this.config.term,
            room: ftest[11],
            area: ftest[12],
            type: ftest[13],
        };
    });
    ftests.forEach((ftest, idx) => {
        if( ftest !== undefined)
        {
            bulk.find
            (
                {
                    'student.code': ftest.student.code,
                    'course.code': ftest.course.code,
                    'term': ftest.term
                }
            )
            .upsert()
            .update({$set: ftest, $currentDate: {updatedAt: true}});
        }
    });
    if(bulk.length > 0)
        bulk.execute();
    return this;
}

module.exports =
{
    reqDatas: [],
    lastDiscovery: undefined,
    //TODO this method check condition for running automatically
    isAllowCrawlling: function()
    {
        var now = new Date();
        var discovered = (this.lastDiscovery !== undefined && now.getDay() == this.lastDiscovery.getDay());
    //   console.log(now.getDay());
        if( now.getDay() % 2 == 1 && now.getHours() == ACTIVE_TIME && !discovered )
        // if(this.lastDiscovery === undefined)
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
            var config = {
                option: iNoodle.config.discover.finaltest
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
                    // begin adhoc work
                    var term;
                    var termWords = $('#content h1').text().trim().split(' ');
                    if( termWords[5] == '1' || termWords[5] == 'I')
                        term = [termWords[8], '1'].join('-');
                    else
                        term = [termWords[8], '2'].join('-');
                    // end adhoc work
                    iNoodle.db.collection('slot').distinct('student.code', {'course.term': term}).then((codes) =>
                    {
                        console.log('number of students ' + codes.length);
                        // codes = codes.slice(0, 3);
                        // console.log('number of stduents ' + codes.length);
                        // codes = ['12020300'];
                        this.reqDatas = codes.map((code, idx) => {
                            return {
                                params:
                                {
                                    keysearch: code
                                },
                                options: iNoodle.config.resource.finaltest,
                                label: `finaltest_${term}_${code}`,
                                term: term
                            };
                        })
                        // console.log(this.reqDatas);
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
            logger.info(`[FINAL_TEST >> DISCOVER] waiting for ${ACTIVE_TIME}`);
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
            config.label = `finaltest_${config.term}_${config.params.keysearch}`;
            (new FinalTestCrawler()).init(config).crawl();
        }
        setTimeout(() => this.crawlFinalTest(), FINAL_TEST_TIMEOUT);
        return this;
    }
}
