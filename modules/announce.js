var https = require('https');
var logger = global.iNoodle.logger;
var db = undefined;
var cheerio = require('cheerio');
var testUtil = require('./testUtil.js');
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
        logger.info('[ANNOUNCE] start crawling');
        this.options = iNoodle.config.resource.announce;
        this.options.path = this.reqDatas[this.nextCrawler].path;
        this.crawl();
    },
    init: function() {
        db = iNoodle.db;
        this.reqDatas = [];
        for (var i = 0; i < 10; i++) {
            this.reqDatas.push({path: '/coltech/taxonomy/term/53?page=' + i})
        }
        this.nextCrawler = 0;
        this.run();
        return this;
    },
    crawl: function() {
        logger.info("[ANNOUNCE] crawl");
        console.log(this.options);
        this.rawData = '';
        var req = https.request(this.options, (response) => {
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                logger.info("[ANNOUNCE] crawl_onData_" + this.nextCrawler);
                this.rawData += chunk;
            });
            response.on('end', () => {
                logger.info("[ANNOUNCE] crawl_onEnd_" + this.nextCrawler);
                this.parse().UpLoadTime(0);
                if (iNoodle.env === 'development') {
                    //testUtil.saveIntoFile(`announce_${this.nextCrawler}.html`, this.rawData);
                }
                logger.info('done');
            });
        });
        req.end();
        return this;
    },
    parse: function() {
        var $ = cheerio.load(this.rawData);
        var count = $('.view-content').children().length;
        this.data = [];
        for (var i = 1; i < count + 1; i++) {
            name = $('.views-row-' + i + ' .title_term').text();
            path = $('.views-row-' + i + ' a').attr('href');
            link = iNoodle.config.resource.announce.host + path;
            this.data[i-1] = {
                name: name,
                link: link,
                uploadtime: null
            }
        }
        return this;
    },
    update: function() {
        logger.info(1);
        for (var i = 0; i < this.data.length; i++) {
            var item ={
                name: this.data[i].name,
                link: this.data[i].link,
                uploadtime: new Date(this.data[i].uploadtime),
            }
            db.collection('announce').insert(item);
        }

        this.nextCrawler = (this.nextCrawler + 1) % this.reqDatas.length;
        setTimeout(this.run(), iNoodle.TIME_OUT + 5000);
        return this;
    },
    UpLoadTime: function(i){
        option = iNoodle.config.resource.announce;
        option.path = this.data[i].link.substring(iNoodle.config.resource.announce.host.length, this.data[i].link.length);
        // logger.info(i, path);
        var data;
        var req = https.request(this.options, (response) => {
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                var $ = cheerio.load(data);
                var date = $('.submitted').text().replace('-', ' ').split(',');
                this.data[i].uploadtime = date[1];
                // logger.info(i + " " + this.data[i].uploadtime + " " + $('.submitted').text());
                if (this.data.length - 1 == i){
                    this.update();
                    return;
                }
                i++;
                this.UpLoadTime(i);
            });
        });
        req.end();
        return this;
    }
}
