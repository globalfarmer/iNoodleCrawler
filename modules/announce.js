var cheerio = require('cheerio');
var fsUtil = require('./testUtil.js');
var inoodleUtil = require('../utils/inoodleUtil.js');
var PERIOD =
{
    CRAWL_TIME: 5 * 60 * 1000
}
var AnnounceCrawler = function(params) {
    this.config = inoodleUtil.deepCopy(params.config) || {};
    this.config.label = "announce_" + (new Date()).getTime();
    return this;
}
AnnounceCrawler.prototype.main = function() {
    inoodleUtil
    .crawl(this)
    .then((crawler) => crawler.parse())
    .catch((e) => iNoodle.logger.error(e))
    .then((crawler) => crawler.saveToDB())
    .catch((e) => iNoodle.logger.error(e));
    return this;
}
AnnounceCrawler.prototype.parse = function() {
    var logger = iNoodle.logger;
    var production = ( iNoodle.env == 'production' );
    var parseLabel = "parse_" + (new Date()).getTime();
    console.time(parseLabel);
    if( !production ) {
        logger.info('[ANNOUCE_CRAWLER] >> parse');
    }
    var $ = cheerio.load(this.htmlContent);
    this.announces = {};
    this.hrefArr = [];
    $('.views-field-title').each((col, item) => {
        var announce = {
            link: $('a', item).attr('href'),
            name: $('a', item).attr('title'),
        }
        this.hrefArr.push(announce.link);
        this.announces[announce.link] = announce;
    });
    if( !production ) {
        logger.log( this.annouces );
    }
    console.timeEnd(parseLabel);
    return this;
}
AnnounceCrawler.prototype.saveToDB = function() {
    var logger = iNoodle.looger;
    var production = (iNoodle.env == 'production');
    var saveLabel = 'save_' + (new Date()).getTime();
    console.time(saveLabel);
    iNoodle.db.collection('announce').find().sort({_id: -1}).limit(20).toArray((err, items) => {
        if( err )
        {
            logger.error(err);
        }
        else
        {
            for(item of items) delete this.announces[item.link];
            var bulk = iNoodle.db.collection('announce').initializeUnorderedBulkOp();
            for(href of this.hrefArr.reverse()) {
                if( this.announces[href] ) {
                    this.announces[href].uploadtime = new Date();
                    bulk.insert(this.announces[href]);
                }
            }
            if( bulk.length > 0 ) bulk.execute();
            if( !production ) {
                console.log(items);
                console.log(this.announces);
            }
        }
    });
    console.timeEnd(saveLabel);
    return this;
}
module.exports = {
    main: function() {
        var production = (iNoodle.env == 'production');
        var params = {
            config: inoodleUtil.deepCopy(iNoodle.config['resource']['announce'])
        }
        if( !production ) {
            console.log(params);
        }
        if( params ) {
            (new AnnounceCrawler(params)).main();
        }
        setInterval(() => {
            if( params ) {
                (new AnnounceCrawler(params)).main();
            }
        }, PERIOD.CRAWL_TIME)
    }
}
