var https = require('https');
var logger = global.iNoodle.logger;
var db = global.iNoodle.db;
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
        logger.info('[COURSE_CLASS] start crawling');
        this.options = iNoodle.config.resource.course;
        this.options.path = this.reqDatas[this.nextCrawler].path;
        this.crawl();
    },
    init: function() {
        this.reqDatas = [{
            path: '/tkb'
        }];
        this.nextCrawler = 0;
        this.run();
        return this;
    },
    crawl: function() {
        logger.info("[COURSE_CLASS] crawl");
        console.log(this.options);
        this.rawData = '';
        var req = https.request(this.options, (response) => {
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
                //setTimeout(this.run(), iNoodle.TIME_OUT);
            });
        });
        req.end();
        return this;
    },
    parse: function() {
        var $ = cheerio.load(this.rawData);
        var i = 1;
        this.data = [];

        var table = $("[name='slt_mamonhoc_filter']").parent().parent().parent();
        // logger.info(table.find('tr').eq(1).find('td').eq(1).text());

        while (!(table.find('tr').eq(i).text() === "")) {
            code = table.find('tr').eq(i).find('td').eq(1).text();
            name = table.find('tr').eq(i).find('td').eq(2).text();
            TC = table.find('tr').eq(i).find('td').eq(3).text();
            classNo = table.find('tr').eq(i).find('td').eq(4).text().split(" ");
            classNo = classNo[1];
            teacher = table.find('tr').eq(i).find('td').eq(5).text();
            students = table.find('tr').eq(i).find('td').eq(6).text();
            dayPart = table.find('tr').eq(i).find('td').eq(7).text();
            dayInWeek = table.find('tr').eq(i).find('td').eq(8).text();
            session = table.find('tr').eq(i).find('td').eq(9).text();
            amphitheater = table.find('tr').eq(i).find('td').eq(10).text();
            note = table.find('tr').eq(i).find('td').eq(11).text();

            this.data[i - 1] = {
                code: code,
                name: name,
                TC: TC,
                classNo: classNo,
                teacher: teacher,
                students: students,
                dayPart: dayPart,
                dayInWeek: dayInWeek,
                session: session,
                amphitheater: amphitheater,
                note: note
            }
            // logger.info(this.data[i - 1]);
            i++;
        }
        return this;
    },
    update: function() {
        // var course = db.collection('course');
        for (var i = 0; i < this.data.length; i++) {
            db.collection('course').insertOne({
                code: this.data[i].code,
                name: this.data[i].name,
                TC: this.data[i].TC,
                classNo: this.data[i].classNo,
                teacher: this.data[i].teacher,
                students: this.data[i].students,
                dayPart: this.data[i].dayPart,
                dayInWeek: this.data[i].dayInWeek,
                session: this.data[i].session,
                amphitheater: this.data[i].amphitheater,
                note: this.data[i].note
            }, function(err, result) {
                assert.equal(err, null);
                logger.info("Inserted a document into the course collection.");
            });
        }
        return this;
    }
}
