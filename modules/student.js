var inoodleUtil = require('../utils/inoodleUtil.js');
var fsUtil = require("./testUtil.js");
var cheerio = require('cheerio');
var querystring = require('querystring');
var PERIOD = {
    DISCOVER_TIME: 2 * 60 * 60 * 1000,
    CRAWL_TIME: 30 * 60 * 1000
}
const FIELDS = {
    config: "config"
}
var StudentCrawler = function(params = {}) {
    this.config = inoodleUtil.deepCopy(params.config) || {};
    this.packID = params._id;
    return this;
}
StudentCrawler.prototype.main = function() {
    inoodleUtil
    .crawl(this)
    .then(this.parse).catch((e) => iNoodle.logger.error(e))
    .then(this.saveToDB).catch((e) => iNoodle.logger.error(e));
}
StudentCrawler.prototype.parse = function(crawler) {
    var logger = iNoodle.env == 'production' ? undefined : iNoodle.logger;
    if( logger ) {
        var parseLabel = "parse_" + (new Date()).getTime();
        logger.info('[STUDENT_CRAWLER] parse');
        console.time(parseLabel);
    }
    crawler.students = {};
    $ = cheerio.load(crawler.htmlContent);
    var tables = $('table.items');
    var term = crawler.config.term;
    // console.log(tables);
    if( tables.length === 1) {
        $('tr',tables).each( (row_idx, row) => {
            var slot = [];
            $('td', row).each( (col_idx, col) => {
                slot.push($(col).text().trim() || "");
            });
            if( row_idx > 1 && !crawler.students.hasOwnProperty(slot[1])) {
                // var studentKey = {"code": 1, "fullname": 2, "birthday": 3, "klass": 4};
                [day, month, year] = slot[3].split("/");
                crawler.students[slot[1]] = {
                    'code': slot[1],
                    'fullname': slot[2],
                    'birthday': new Date(year, parseInt(month)-1, day),
                    'klass': slot[4],
                    'term': term,
                }
            }
        });
        if( logger )
            logger.info(`number of students ${Object.keys(crawler.students).length}`);
    }
    else
    {
        if( logger )
            logger.info("[STUDENT_CRAWLER] parse: have no table.items or more than one");
    }
    console.timeEnd(parseLabel);
    return crawler;
}
StudentCrawler.prototype.saveToDB = function(crawler) {
    console.log(crawler.students);
    var logger = iNoodle.logger;
    var studentCollection = iNoodle.db.collection('student');
    studentCollection.find({term: crawler.config.term}).toArray((err, items) => {
        if( err )
        {
            logger.error(err);
        }
        else {
            for(student of items) {
                if( crawler.students.hasOwnProperty(student.code)) {
                    delete crawler.students[student.code];
                }
            }
            var bulk = studentCollection.initializeUnorderedBulkOp();
            for(code in crawler.students) {
                bulk.insert(crawler.students[code]);
            }
            if( bulk.length > 0 ) {
                bulk.execute((err, result) => {
                    if(err) {
                        logger.error(err);
                    }
                    else {
                        console.log(crawler.packID);
                        iNoodle.db.collection('student_pack').remove({
                            _id: crawler.packID
                        });
                    }
                });
            }
        }
    })
    return crawler;
}

module.exports = {
    getTerm: function(str) {
        var words = str.split(' ');
        return [words[5], words[2]].join('-');
    },
    main: function() {
        var logger = iNoodle.logger;
        this.discover();
        setInterval(() => this.discover, PERIOD.DISCOVER_TIME);
        var crawler = function() {
            iNoodle.db.collection('student_pack').find({status: 'pending'}).toArray((err, packs) => {
                if( err ) {
                    logger.error(err);
                }
                else {
                    for(pack of packs) {
                        pack.config.label = 'stduent_' + pack.version.getTime();
                        (new StudentCrawler(pack)).main();
                    }
                }
            });
        }
        crawler();
        setInterval(() => {
            crawler();
        },
        PERIOD.CRAWL_TIME);
    },
    discover: function() {
        var logger = iNoodle.logger;
        var production = (iNoodle.env == 'production');
        var config = iNoodle.config['resource']['student'];
        if( !config ) {
            logger.error("no environment is available");
        }
        else {
            var discoverOptions = inoodleUtil.deepCopy(config.discover);
            var studentPack = undefined;
            inoodleUtil.crawl({
                config:
                {
                    options: discoverOptions,
                    label: "student_discover"
                }
            }).then((discoverStudent) => {
                if( !production ) {
                    logger.info('[DISCOVER_STUDENT] start');
                }
                var $ = cheerio.load(discoverStudent.htmlContent);
                var element = $('#SinhvienLmh_term_id');
                $('option', element).each((idx, opt) =>
                {
                    if( idx > 0 )
                    {
                        var params = inoodleUtil.deepCopy(config.params);
                        var term = this.getTerm($(opt).text().trim());
                        var options = inoodleUtil.deepCopy(config.options);
                        params['SinhvienLmh[term_id]'] = $(opt).attr('value').trim();
                        // TODO complete options.path with params
                        options.path = config.options.path + querystring.stringify(params);
                        if( studentPack == undefined || term.split('-').slice(-1)[0] === '2' ) {
                            studentPack = {
                                config: {
                                    options: options,
                                    params: params,
                                    term: term
                                },
                                status: 'pending'
                            }
                        }
                    }
                });
                if( studentPack ) {
                    studentPack.version = new Date();
                    iNoodle.db.collection("student_pack").insert(studentPack);
                }
            });
        }
    }
}
