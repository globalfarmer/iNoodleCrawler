var fs = require('fs');
var logger = iNoodle.logger;
module.exports = {
  saveIntoFile: function(filename, data) {
    var today = new Date();
    var dir =
    [
      "public",
      [
        today.getFullYear().toString().slice(-2),
        ('0'+today.getMonth()).slice(-2),
        ('0'+today.getDate()).slice(-2)
      ].join("")
    ].join("/");
    if(!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    var path = [dir, filename].join("/");
    fs.writeFile(path, data, (err) => {
      if( err )
        logger.error(err);
      else
        logger.info(`writing successfully on ${path}`);
    });
  }
}
