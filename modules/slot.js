var https = require('https');
var fs = require('fs');
var logger = global.iNoodle.logger;
var db = global.iNoodle.db;
var testUtil = require('./testUtil.js');
// module contain 4 method
// run: main flow of this module
// crawl: request and get back raw data(html data)
// parse: parse raw data into a array of object
// update: update data on database
module.exports = {
  options: null,
  reqDatas : [],
  rawData: null,
  data: [],
  nextCrawler: null,
  run: function() {
    logger.info('[SLOT] start crawling');
    this.options = iNoodle.config.resource.slot;
    this.options.path = this.reqDatas[this.nextCrawler].path;
    this.crawl();
  },
  init: function() {
    this.reqDatas =
    [
      {
        path:'/congdaotao/module/qldt/index.php?r=sinhvienLmh/'+
             'admin&SinhvienLmh%5Bterm_id%5D=021&ajax=sinhvien-lmh-grid&SinhvienLmh_page=1&pageSize=30000'
      },
      {
        path:'/congdaotao/module/qldt/index.php?r=sinhvienLmh/'+
             'admin&SinhvienLmh%5Bterm_id%5D=022&ajax=sinhvien-lmh-grid&SinhvienLmh_page=1&pageSize=30000'
      }
    ];
    this.nextCrawler = 0;
    this.run();
    return this;
  },
  crawl: function() {
    logger.info("[SLOT] crawl");
    console.log(this.options);
    this.rawData = '';
    var req = https.request(this.options, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        logger.info("[SLOT] crawl_onData_"+this.nextCrawler);
        this.rawData += chunk;
      });
      response.on('end', () => {
        logger.info("[SLOT] crawl_onEnd_"+this.nextCrawler);
        this.parse().update();
        if( iNoodle.env === 'development') {
          testUtil.saveIntoFile(`slot_${this.nextCrawler}.html`, this.rawData);
        }
        this.nextCrawler = (this.nextCrawler + 1) % this.reqDatas.length;
        setTimeout(this.run(), iNoodle.TIME_OUT);
      });
    });
    req.end();
    return this;
  },
  parse: function() {
    this.data = [];
    return this;
  },
  update: function() {
    return this;
  }
}
