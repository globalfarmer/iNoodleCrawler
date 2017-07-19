var http = require('http');
var https = require('https');
var fsUtil = require('../modules/testUtil.js');
var querystring = require('querystring');
module.exports = {
    deepCopy: function(object) {
        if( object === null || typeof(object) !== 'object' ) return object;
        var res = {};
        Object.keys(object).forEach((key, idx) => {
            res[key] = this.deepCopy(object[key]);
        });
        return res;
    },
    getCurrentTerm: function(date, left=4, right=9) {
        // year               left                 right
        //           1 2 3    4  5 6 7 8           9 10 11 12
        //  (year-1)-year-1   [  (year-1)-year-2   [ year-(year+1)-1
        var now = date;
        if( now.getMonth() < right-1) {
            var y = [parseInt(now.getFullYear())-1, now.getFullYear()].join('-');
            if( now.getMonth() >= left-1) {
                return [['hkii',y].join(''), [y,'2'].join('-')];
            }
            return [['hki',y].join(''), [y,'1'].join('-')]
        }
        var y = [now.getFullYear(), parseInt(now.getFullYear())+1].join('-');
        return [['hki',y].join(''), [y,'1'].join('-')];
    },
    crawl: function(crawler) {
        var config = crawler.config;
        var logger = iNoodle.logger;
        var production = (iNoodle.env == 'production');
        var timeLabel = 'crawl_' + (new Date()).getTime();
        console.time(timeLabel);
        return new Promise((resolve, reject) => {
            var htmlContent = "";
            if( !production ) {
                console.log(config);
                logger.info("[CRAWL] " + JSON.stringify(config.options));
            }
            var pro = config.options.port == 443 ? https : http;
            var req = pro.request(config.options, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    htmlContent += chunk;
                });
                res.on('end', () => {
                    if(!production) {
                        fsUtil.saveIntoFile(`${config.label}.html`, htmlContent);
                        logger.info("[CRAWL] onEnd");
                    }
                    console.timeEnd(timeLabel);
                    crawler.htmlContent = htmlContent;
                    resolve(crawler);
                });
            });
            if( config.options.method.toLowerCase() === 'post' )
                req.write(querystring.stringify(config.params));
            req.end();
        })
    }
}
