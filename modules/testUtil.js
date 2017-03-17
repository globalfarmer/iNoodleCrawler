module.exports = {
  saveIntoFile: function(filename, data) {
    var today = new Date();
    var path =
    [
      "public",
      [
        today.getFullYear().toString().slice(-2),
        ('0'+today.getMonth()).slice(-2),
        ('0'+today.getDate()).slice(-2),
        filename
      ].join(""),
    ].join('/');
    fs.writeFile(path, data, (err) => {
      if( err )
        logger.error(err);
      else
        logger.info(`writing successfully on ${path}`);
    });
  }
}
