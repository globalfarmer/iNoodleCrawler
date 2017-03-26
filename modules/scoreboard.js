var querystring = require('querystring');
var http = require('http');
var fs = require('fs');
var cheerio = require('cheerio');
var testUtil = require('./testUtil.js');
var $ = undefined;
var logger = undefined;
var db = undefined;
var files = [];

var loader = {
  isLoadding: false,
  start: function() {
    console.log(`isLoadding ${this.isLoadding} files ${files.length}`);
    logger.log(`isLoadding ${this.isLoadding} files ${files.length}`);
    if(files.length > 0 && !this.isLoadding) {
      this.isLoadding = true;
      this.download();
    }
  },
  download: function() {
    var fileData = files.shift();
    if( !fileData ) {
      this.isLoadding = false;
      return this;
    }
    logger.info(`have one file to download`);
    if(!fs.existsSync(fileData.dir))
      fs.mkdirSync(fileData.dir);
    var filename = fileData.filename.split('/').join('_');
    var outputFile = [fileData.dir, filename].join('/');
    console.log(`start download file ${outputFile}`);
    logger.info(`start download file ${outputFile}`);
    var file = fs.createWriteStream(outputFile);
    var request = http.get(fileData.href, (res) => {
      res.pipe(file);
      res.on('end', () => {
        console.log(`have downloaded successfully ${outputFile}`);
        logger.info(`have downloaded successfully ${outputFile}`);
        fileData.available = true;
        db.collection('scoreboard').update({_id: fileData._id}, fileData);
        setTimeout(() => this.download(), 5000);
      });
    }).on('error', (err) => {
      console.log(err);
      console.log("push back data cause error");
      logger.info("push back data cause error");
      var record = fileData;
      if( record.available ) {
        console.log("--------------------------------------------------------");
        logger.info("--------------------------------------------------------");
        record.available = false;
        db.collection('scoreboard').update({_id: record._id}, record);
      }
      files.push(record);
      this.download();
    });
  }
}
// module contain 4 method
// run: main flow of this module
// crawl: request and get back raw data(html data)
// parse: parse raw data into a array of object
// update: update data on database
module.exports = {
  rawData: null,
  reqDatas: null,
  nextCrawler: null,
  data: null,
  options: null,
  init: function() {
    logger = iNoodle.logger;
    db = iNoodle.db;
    logger.info('[SCOREBOARD][INIT] init module')
    //path
    //postData
    //dir
    this.reqDatas = [];
    var kqdh = '';
    var kqdhDir = 'kqdh';
    // http.get('http://coltech.vnu.edu.vn/news4st/kqdh.php', (res) => {
    http.get('http://localhost/kqdh.html', (res) => {
      res.on('data', (chunk) => {
        kqdh += chunk;
      });
      res.on('end', () => {
        testUtil.saveIntoFile("kqdh.html", kqdh);
        if(!fs.existsSync(kqdhDir))
          fs.mkdirSync(kqdhDir);
        $ = cheerio.load(kqdh);
        var lstClass = $('select[name=lstClass]');
        $('option', lstClass).each((opt_idx, opt) => {
          console.log(`value option ${$(opt).attr('value')} ${opt_idx}`);
          var postData = querystring.stringify({
            lstClass: $(opt).attr('value').trim()
            // output_format: 'html'
          })
          if($(opt).attr('value')) {
            this.reqDatas.push({
                postData: postData,
                dir: [kqdhDir, $(opt).text().trim()].join('/'),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            });
          };
        });
        console.log(this.reqDatas);
        this.nextCrawler = 0;
        this.options = iNoodle.config.resource.scoreboard;
        this.run();
      });
    }).on('error', (e) => {
      logger.error(e);
      console.log("error: " + e);
    })
    return this;
  },
  run: function() {
    logger.info('[SCOREBOARD][RUN] run module');
    console.log(`nextCrawler ${this.nextCrawler}`);
    console.log(`reqDatas.length ${this.reqDatas.length}`);
    this.options.headers = this.reqDatas[this.nextCrawler].headers;
    this.crawl();
    return this;
  },
  crawl: function() {
    this.rawData = '';
    var postData = this.reqDatas[this.nextCrawler].postData;
    var req = http.request(this.options, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        this.rawData += chunk;
      });
      res.on('end', () => {
        testUtil.saveIntoFile(`scoreboard_${this.nextCrawler}.html`, this.rawData);
        this.parse().update();
        // this.nextCrawler = (this.nextCrawler + 1) % this.reqDatas.length;
        this.nextCrawler++;
        if( this.nextCrawler < this.reqDatas.length ) {
          setTimeout(() => this.run(), 10000);
        }
      })
    }).on('error', (err) => {
      logger.error(err.message);
      console.log(err);
    });
    req.write(postData);
    req.end();
    return this;
  },
  parse: function() {
    logger.info("[SCOREBOARD][PARSE]");
    this.data = [];
    $ = cheerio.load(this.rawData);
    var tables = $('form[name=frm]').find("table");
    if(tables.length === 2) {
      var rows = $('a', tables[1]);
      rows.each((row_idx, row) => {
        this.data.push({
          href: ['http://coltech.vnu.edu.vn/news4st', $(row).attr('href')].join('/'),
          filename: `${row_idx}_${$('b', row).text().trim()}.pdf`,
          dir: this.reqDatas[this.nextCrawler].dir
        })
      });
      console.log(this.data);
    }
    else
    {
      logger.error(`tables has more than 2 table`);
      console.log(`tables has more than 2 table`);
    }
    return this;
  },
  update: function() {
    logger.info("[SCOREBOARD][UPDATE]")
    this.data.forEach((sb, idx) => {
      db.collection('scoreboard')
        .find(sb)
        .limit(1)
        .toArray((err, docs) => {
          if( docs.length === 0 )
          {
            db.collection('scoreboard').insert(sb, (err, docs) => {
              logger.info(`insert successfully then file will be downloaded soon ${[docs.ops[0].dir,docs.ops[0].filename].join('/')}`);
              files.push(docs.ops[0]);
              loader.start();
            });
          } else if( docs.length === 1 && !docs[0].available ) {
            logger.info(`document is already exist but scoreboard file is still not available ${[docs[0].dir,docs[0].filename].join('/')}`);
            files.push(docs[0]);
            loader.start();
          }
          else {
            console.log(`${docs.length}`);
            console.log(docs);
            console.log("[SCOREBOARD][UPDATE] not handle");
          }
        });
    });
    // console.log(files);
    // files = [];
    return this;
  }
}
