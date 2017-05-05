const DISCOVER_TIMEOUT = 1000 * 60 * 5;
const SCOREBOARD_CRAWLER_TIMEOUT = 1000 * 5;
const NUMBER_OF_LATEST = 30;

var querystring = require('querystring');
var http = require('http');
var fs = require('fs');
var cheerio = require('cheerio');
var util = require('util');
var events = require('events');
var testUtil = require('./testUtil.js');
var inoodleUtil = require('../utils/inoodleUtil');
var logger;

var ScoreboardCrawler = function()
{
    events.EventEmitter.call(this);
}
util.inherits(ScoreboardCrawler, events.EventEmitter);
ScoreboardCrawler.prototype.download = function(scoreboard) {
    logger.info(`[SCOREBOARD >> SCOREBOARD_CRAWLER >> DOWNLOAD] ${scoreboard.file.filename}`);
    if(!fs.existsSync(scoreboard.file.path))
      fs.mkdirSync(scoreboard.file.path);
    var outputFile = [scoreboard.file.path, scoreboard.file.filename].join('/');
    var file = fs.createWriteStream(outputFile);
    var request = http.get(scoreboard.href, (res) => {
      res.pipe(file);
      res.on('end', () => {
        logger.info(`have downloaded successfully ${outputFile} ${res.statusCode} ${typeof(res.statusCode)}`);
        if( res.statusCode == 200) {
            scoreboard.file.available = true;
            iNoodle.db.collection('scoreboard')
            .update({'course.code': scoreboard.course.code, 'term': scoreboard.term}, {$set: scoreboard, $currentDate: {updatedAt:true}});
        }
      });
    }).on('error', (err) => {
      logger.error(err);
    });
}
var DiscoverScoreboard = function()
{
    events.EventEmitter.call(this);
}
util.inherits(DiscoverScoreboard, events.EventEmitter);
// adhoc method
//antoànvàanninhmạng-int3307(lênmạng:22/01/2016,15:32)
//@return {course: {}, uploadTime}
DiscoverScoreboard.prototype.getInfo = function(label) {
    while(true) {
        var idx = label.indexOf('-');
        if( idx != -1)
            label = label.slice(idx+1);
        else
            break;
    }
    var code = label.slice(0, label.indexOf('('));
    var labels = label.slice(label.indexOf(':')+1,-1).split(',');
    var days = labels[0].split('/');
    var times = labels[1].split(':');
    var ret = {
        course: {
            code: code
        },
        uploadTime: new Date(days[2], days[1], days[0], times[0], times[1])
    }
    return ret;
}
DiscoverScoreboard.prototype.crawl = function(_config, reqDatas) {
    logger.info('[SCOREBOARD >> DISCOVER_SCOREBOARD >> CRAWL]');
    this.data = [];
    var config = inoodleUtil.deepCopy(_config);
    var postData = querystring.stringify(config.params);
    config.options.headers['Content-Length'] = Buffer.byteLength(postData);
    var pro = http;
    var rawData = "";
    if( config.options.port == 443 ) pro = https;
    var req = pro.request(config.options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            rawData += chunk;
        });
        res.on('end', () => {
            if(iNoodle.env == 'development') {
                testUtil.saveIntoFile(config.label+'.html', rawData);
            }
            $ = cheerio.load(rawData);
            var tables = $('form[name=frm]').find("table");
            if(tables.length === 2) {
                var rows = $('a', tables[1]);
                rows.each((row_idx, row) => {
                    var info = this.getInfo($(row).text().toLowerCase().split(' ').join(''));
                    this.data.push({
                        href: ['http://coltech.vnu.edu.vn/news4st', $(row).attr('href')].join('/'),
                        course: info.course,
                        term: config.term,
                        uploadTime: info.uploadTime
                    });
                });
                this.parse(reqDatas);
            }
            else
            {
                logger.error('number of table abnormally');
                console.log('number of table abnormally');
            }
        });
    });
    req.write(postData);
    req.end();
}
DiscoverScoreboard.prototype.parse = function(reqDatas) {
    logger.info('[SCOREBOARD >> DISCOVER_SCOREBOARD >> PARSE]');
    this.data = this.data.sort((e1, e2) => e2.uploadTime - e1.uploadTime);
    this.data = this.data.slice(0, NUMBER_OF_LATEST);
    // console.log(this.data);
    this.data.forEach((sb) => {
        iNoodle.db.collection('scoreboard').find({'course.code': sb.course.code, 'term': sb.term}).limit(1).toArray((err, results) =>
        {
            if( err)
                logger.error(err);
            else
            {
                sb.file = {
                    available: false,
                    filename: `${sb.course.code}_${sb.term}.pdf`,
                    path: `public/scoreboard/${sb.term}`
                };
                if( results.length == 0) {
                    sb.createdAt = sb.updatedAt = new Date();
                    iNoodle.db.collection('scoreboard').insert(sb);
                    reqDatas.push(sb);
                }
                else if(results[0].file.available == false)
                {
                    reqDatas.push(sb);
                }
            }
        });
    });
};
module.exports =
{
    reqDatas: [],
    start: function() {
        logger = iNoodle.logger;
        logger.info('[SCOREBOARD >> START]');
        this.discover().scoreboardCrawling();
        return this;
    },
    // adhoc method
    getCurrentTerm: function(date) {
        var now = date;
        if( now.getMonth() < 8) {
            var y = [parseInt(now.getFullYear())-1, now.getFullYear()].join('-');
            if( now.getMonth() >= 3) {
                return [['hkii',y].join(''), [y,'2'].join('-')];
            }
            return [['hki',y].join(''), [y,'1'].join('-')]
        }
        var y = [now.getFullYear(), parseInt(now.getFullYear())+1].join('-');
        return [['hki',y].join(''), [y,'1'].join('-')];
    },
    discover: function() {
        logger.info('[SCOREBOARD >> DISCOVER]');
        var rawData = "";
        http.get('http://www.coltech.vnu.edu.vn/news4st/kqdh.php', (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                rawData += chunk;
            });
            res.on('end', () => {
                if( iNoodle.env === 'development') {
                    testUtil.saveIntoFile('kqdh.html', rawData);
                }
                var $ = cheerio.load(rawData);
                var lstClass = $('select[name=lstClass]');
                var currentTerm = this.getCurrentTerm();
                logger.info('current term');
                logger.info(JSON.stringify(currentTerm));
                $('option', lstClass).each((opt_idx, opt) => {
                    // logger.info(`value option ${$(opt).text().trim()} ${$(opt).attr('value')} ${opt_idx}`);
                    var title = ($(opt).text() || "").toLowerCase().split(" ").join('');
                    if( title === currentTerm[0] )
                    {
                        var config =
                        {
                            params: {lstClass: $(opt).attr('value').trim() },
                            options: {
                                "host": "coltech.vnu.edu.vn",
                                "port": "80",
                                "method": "POST",
                                "path": "/news4st/test.php",
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                }
                            },
                            label: `${currentTerm[0]}_scoreboard`,
                            term: currentTerm[1]
                        };
                            (new DiscoverScoreboard()).crawl(config, this.reqDatas);
                        }
                });
            });
        });
        setTimeout(() => this.discover(), DISCOVER_TIMEOUT);
        return this;
    },
    scoreboardCrawling: function() {
        logger.info('[SCOREBOARD >> SCOREBOARD_CRAWLING]');
        if( this.reqDatas.length > 0)
        {
            var scoreboard = this.reqDatas.shift();
            (new ScoreboardCrawler()).download(scoreboard);
        }
        setTimeout(() => this.scoreboardCrawling(), SCOREBOARD_CRAWLER_TIMEOUT);
        return this;
    }
}
