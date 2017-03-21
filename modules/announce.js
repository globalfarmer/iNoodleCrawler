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
    countAnnounce: 0,
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
                this.parse();
                if (iNoodle.env === 'development') {
                    //testUtil.saveIntoFile(`announce_${this.nextCrawler}.html`, this.rawData);
                }
                this.nextCrawler = (this.nextCrawler + 1) % this.reqDatas.length;
                setTimeout(this.run(), iNoodle.TIME_OUT);
            });
        });
        req.end();
        return this;
    },
    parse: function() {
        var $ = cheerio.load(this.rawData);
        count = $('.view-content').children().length;
        logger.info(count);
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
            uploadtime = this.UpLoadTime(path, count, i-1);
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
                updatetime: new Date()
            }
            db.collection('announce').insert(item);
        }
        return this;
    },
    UpLoadTime: function(path, count, i){
        option = iNoodle.config.resource.announce;
        option.path = path;
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
                this.countAnnounce++;
                if (this.countAnnounce == count - 1){
                    this.countAnnounce = 0;
                    this.update();
                }
            });
        });
        req.end();
        return this;
    }
}
