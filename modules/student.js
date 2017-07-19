var inoodleUtil = require('../utils/inoodleUtil.js');
var fsUtil = require("./testUtil.js");
var cheerio = require('cheerio');
var querystring = require('querystring');
var PERIOD = {
    DISCOVER_TIME: 2 * 60 * 60 * 1000,
    CRAWL_TIME: 20 * 60 * 1000
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
    .then((crawler) => crawler.parse()).catch((e) => iNoodle.logger.error(e))
    .then((crawler) => crawler.saveToDB()).catch((e) => iNoodle.logger.error(e));
}
StudentCrawler.prototype.parse = function() {
    var logger = iNoodle.logger;
    var production = (iNoodle.env == 'production');
    var parseLabel = "parse_" + (new Date()).getTime();
    console.time(parseLabel);
    if( !production ) {
        logger.info('[STUDENT_CRAWLER] parse');
    }
    this.students = {};
    $ = cheerio.load(this.htmlContent);
    var tables = $('table.items');
    var term = this.config.term;
    // console.log(tables);
    if( tables.length === 1) {
        $('tr',tables).each( (row_idx, row) => {
            var slot = [];
            $('td', row).each( (col_idx, col) => {
                slot.push($(col).text().trim() || "");
            });
            if( row_idx > 1 && !this.students.hasOwnProperty(slot[1])) {
                // var studentKey = {"code": 1, "fullname": 2, "birthday": 3, "klass": 4};
                [day, month, year] = slot[3].split("/");
                this.students[slot[1]] = {
                    'code': slot[1],
                    'fullname': slot[2],
                    'birthday': new Date(year, parseInt(month)-1, day, -7), // UTC time
                    'klass': slot[4],
                    'term': term,
                }
            }
        });
        if( !production )
            logger.info(`number of students ${Object.keys(this.students).length}`);
    }
    else
    {
        if( !production )
            logger.info("[STUDENT_CRAWLER] parse: have no table.items or more than one");
    }
    console.timeEnd(parseLabel);
    return this;
}
StudentCrawler.prototype.saveToDB = function() {
    var production = ( iNoodle.env == 'production');
    var logger = iNoodle.logger;
    var saveLabel = 'save_' + (new Date()).getTime();
    console.time(saveLabel);
    if( !production ) {
        console.log(this.students['13020752']);
    }
    var studentCollection = iNoodle.db.collection('student');
    studentCollection.find({term: this.config.term}).toArray((err, items) => {
        if( !production)
            console.info(`10 items in list items of ${items.length}`)
            console.log(items.slice(0,10));
        if( err )
        {
            logger.error(err);
        }
        else {
            for(student of items) {
                if( this.students.hasOwnProperty(student.code)) {
                    delete this.students[student.code];
                }
            }
            var bulk = studentCollection.initializeUnorderedBulkOp();
            for(code in this.students) {
                this.students[code].version =
                {
                    "slot": new Date(),
                    "finaltest": new Date(),
                    "session": new Date()
                }
                this.students[code].slots = {};
                bulk.insert(this.students[code]);
            }
            if( bulk.length > 0 ) {
                bulk.execute((err, result) => {
                    if(err) {
                        logger.error(err);
                    }
                    else {
                        if( !production ) {
                            logger.info(this.packID);
                        }
                        console.timeEnd(saveLabel);
                        iNoodle.db.collection('student_pack').remove({
                            _id: this.packID
                        });
                    }
                });
            }
            else {
                iNoodle.db.collection('student_pack').remove({
                    _id: this.packID
                });
                console.timeEnd(saveLabel);
            }
        }
    })
    return this;
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
            iNoodle.db.collection('student_pack').find().toArray((err, packs) => {
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
                        options.path = config.options.path + querystring.stringify(params);
                        if( studentPack == undefined || term.split('-').slice(-1)[0] === '2' ) {
                            studentPack = {
                                config: {
                                    options: options,
                                    params: params,
                                    term: term
                                }
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
