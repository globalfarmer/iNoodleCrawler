var inoodleUtil = require('../utils/inoodleUtil.js');
var cheerio = require('cheerio');
var querystring = require('querystring');
var PERIOD = {
    DISCOVER_TIME: 4 * 60 * 60 * 1000,
    CRAWL_TIME: 15 * 1000
}
var SlotCrawler = function(params = {}) {
    this.config = inoodleUtil.deepCopy(params.config) || {};
    this.packID = params._id;
    this.student = params.config.student;
    return this;
}
SlotCrawler.prototype.main = function() {
    inoodleUtil
    .crawl(this)
    .then((crawler) => crawler.parse()).catch((e) => iNoodle.logger.error(e))
    .then((crawler) => crawler.saveToDB()).catch((e) => iNoodle.logger.error(e));
}
SlotCrawler.prototype.parse = function() {
    var logger = iNoodle.logger;
    var production = (iNoodle.env == 'production');
    var parseLabel = "parse_" + (new Date()).getTime();
    console.time(parseLabel);
    if( !production ) {
        logger.info('[SLOT_CRAWLER] parse');
    }
    this.slots = {};
    $ = cheerio.load(this.htmlContent);
    var tables = $('table.items');
    var term = this.config.term;
    // console.log(tables);
    if( tables.length === 1) {
        $('tr',tables).each( (row_idx, row) => {
            if( row_idx < 2 ) return;
            var slot = [];
            $('td', row).each( (col_idx, col) => {
                slot.push($(col).text().trim() || "");
            });
            // normalize course_code
            slot[5] = slot[5].split(' ').join('').toLowerCase();
            if( !this.slots.hasOwnProperty(slot[5])) {
                // var courseKey = {"code": 5, "name": 6, "group": 7, "credit": 8, "note": 9};
                this.slots[slot[5]] = {
                    'code': slot[5],
                    'name': slot[6],
                    'group': slot[7],
                    'credit': slot[8],
                    'note': slot[9],
                    'cancel': false

                }
            }
        });
        if( !production ) {
            logger.info(`number of slots ${Object.keys(this.slots).length}`);
            logger.info(`${this.student.code}`);
            for(code in this.slots) {
                logger.info(code);
                logger.info(JSON.stringify(this.slots[code]));
            }
        }
    }
    else
    {
        if( !production )
            logger.info("[SLOT_CRAWLER] parse: have no table.items or more than one");
    }
    console.timeEnd(parseLabel);
    return this;
}
SlotCrawler.prototype.saveToDB = function()
{
    var production = ( iNoodle.env == 'production');
    var logger = iNoodle.logger;
    var saveLabel = 'save_' + (new Date()).getTime();
    console.time(saveLabel);
    var studentCollection = iNoodle.db.collection('student');
    studentCollection.find({_id: this.student._id}).toArray((err, items) => {
        if( !production)
        {
            console.info(`10 items in list items of ${items.length}`)
            console.log(items.slice(0,10));
        }
        if( err || items.length != 1)
        {
            if( err )
                logger.error(err);
            else
                logger.error("no student found")
        }
        else
        {
            var student = items[0];
            var checkChange = function(cur, target) {
                var prefix = `slots.${cur.code}`;
                var ret = {};
                ret[`${prefix}.version`] = new Date();
                var ok = false;
                for(field of ['code', 'name', 'group', 'credit', 'note', 'cancel']) {
                    if( !target.hasOwnProperty(field) || target[field] != cur[field] ) {
                        ret[`${prefix}.${field}`] = cur[field];
                        ok = true;
                    }
                }
                return ok ? ret : undefined;
            }
            var bulk = studentCollection.initializeUnorderedBulkOp();
            // cancel slot or edited slot
            for(code in student.slots)
            {
                var ret = undefined;
                if( this.slots.hasOwnProperty(code) )
                {
                    ret = checkChange(this.slots[code], student.slots[code]);
                    delete this.slots[code];
                }
                else
                {
                    ret = {};
                    ret[`slots.${code}.version`] =  new Date();
                    ret[`slots.${code}.cancel`] =  true;
                }
                if( ret ) {
                    if( !production ) {
                        console.info(ret);
                    }
                    bulk.find({_id: this.student._id}).update({$set: ret});
                }
            }
            // new slot
            for(code in this.slots)
            {
                var ret = checkChange(this.slots[code], {});
                if( !production) {
                    console.info(ret);
                }
                bulk.find({_id: this.student._id}).update({$set: ret});
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
                        iNoodle.db.collection('slot_pack').remove({
                            _id: this.packID
                        });
                    }
                });
            }
            else
            {
                iNoodle.db.collection('slot_pack').remove({
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
        setInterval(() => this.discover(), PERIOD.DISCOVER_TIME);
        var crawler = function() {
            iNoodle.db.collection('slot_pack').find().limit(5).toArray((err, packs) => {
                if( err ) {
                    logger.error(err);
                }
                else {
                    for(pack of packs) {
                        pack.config.label = 'slot_' + pack.config.params['SinhvienLmh[masvTitle]'];
                        (new SlotCrawler(pack)).main();
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
        var config = iNoodle.config['resource']['slot'];
        if( !config ) {
            logger.error("no environment is available");
        }
        else {
            var discoverOptions = inoodleUtil.deepCopy(config.discover);
            var slotPack = undefined;
            inoodleUtil.crawl({
                config:
                {
                    options: discoverOptions,
                    label: "slot_discover"
                }
            }).then((discoverSlot) => {
                if( !production ) {
                    logger.info('[DISCOVER_SLOT] start');
                }
                var $ = cheerio.load(discoverSlot.htmlContent);
                var element = $('#SinhvienLmh_term_id');
                $('option', element).each((idx, opt) =>
                {
                    if( idx > 0 )
                    {
                        var params = inoodleUtil.deepCopy(config.params);
                        var term = this.getTerm($(opt).text().trim());
                        var options = inoodleUtil.deepCopy(config.options);
                        params['SinhvienLmh[term_id]'] = $(opt).attr('value').trim();
                        if( slotPack == undefined || term.split('-').slice(-1)[0] === '2' ) {
                            slotPack = {
                                config: {
                                    options: options,
                                    params: params,
                                    term: term
                                }
                            }
                        }
                    }
                });
                if( slotPack ) {
                    iNoodle.db.collection('student').find({term: slotPack.config.term}).toArray((err, students) => {
                        if( err ) {
                            logger.error(err);
                        }
                        else
                        {
                            var bulk = iNoodle.db.collection('slot_pack').initializeUnorderedBulkOp();
                            for(student of students)
                            {
                                var pack = inoodleUtil.deepCopy(slotPack);
                                pack.version = new Date();
                                pack.config.params['SinhvienLmh[masvTitle]'] = student.code;
                                pack.config.student =
                                {
                                    _id: student._id,
                                    code: student.code,
                                    term: student.term
                                }
                                pack.config.options.path = pack.config.options.path + querystring.stringify(pack.config.params);
                                bulk.insert(pack);
                            }
                            if( bulk.length > 0 )
                            {
                                bulk.execute();
                            }
                        }
                    })
                }
            });
        }
    }
}
