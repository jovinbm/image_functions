const BPromise      = require('bluebird');
const rimraf        = require('rimraf');
const path          = require('path');
const fs            = require('fs');
const processImage3 = require('../../index').processImage3;
const processImage4 = require('../../index').processImage4;

BPromise.promisifyAll(fs);

const clearFolder = (path) => {
  return new BPromise(function (resolve, reject) {
    
    rimraf(`${path}/*`, function (e) {
      if (e) {
        reject(e);
      }
      else {
        resolve(true);
      }
    });
    
  });
};

const versions = [
  {
    height: 400,
    width : null
  },
  {
    height: 200,
    width : null
  },
  {
    height: 80,
    width : null
  }
];
const items    = [
  {
    dir         : path.join(__dirname, '../leaderboard_tests/raw'),
    output_dir  : path.join(__dirname, '../leaderboard_tests/processImage3_out'),
    versions,
    processImage: processImage3
  },
  {
    dir         : path.join(__dirname, '../leaderboard_tests/raw'),
    output_dir  : path.join(__dirname, '../leaderboard_tests/processImage4_out'),
    versions,
    processImage: processImage4
  }
];

BPromise.map(items, item => {
  
  const {
          dir,
          output_dir,
          versions,
          processImage
        } = item;
  
  return BPromise.resolve()
    .then(() => clearFolder(output_dir))
    .then(() => processImage({
      dir,
      output_dir,
      versions
    }))
    .then(() => true);
  
});