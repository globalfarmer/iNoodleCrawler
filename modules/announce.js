var logger = global.iNoodle.logger;
// module contain 4 method
// run: main flow of this module
// crawl: request and get back raw data(html data)
// parse: parse raw data into a array of object
// update: update data on database
module.exports = {
  config: null,
  db: null,
  rawData: null,
  data: [],
  run: () => {
    logger.info('[ANNOUNCE] start crawling');
    return this;
  },
  crawl: () => {
    return this;
  },
  parse: () => {
    return this;
  },
  update: () => {
    return this;
  }
}
