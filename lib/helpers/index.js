const BPromise  = require('bluebird');
const fs        = require('fs');
const imageSize = require('image-size');
const imageinfo = require('imageinfo');

/**
 *
 * @param {string} file_path
 * @return {*}
 */
exports.getFileSizeInKB = function (file_path) {
  
  return fs.statAsync(file_path)
    .then(function (stats) {
      
      return stats.size / 1024;
      
    });
  
};

/**
 *
 * @param {string} file_path
 * @return {*}
 */
exports.getImageDimensions = function (file_path) {
  
  return new BPromise(function (resolve, reject) {
    
    imageSize(file_path, function (e, dimensions) {
      
      if (e) {
        return reject(e);
      }
      
      return resolve({
        height: dimensions.height,
        width : dimensions.width
      });
      
    });
    
  });
  
};

/**
 *
 * @param {string} file_path
 * @return {*}
 */
exports.getMimeType = function (file_path) {
  
  return fs.readFileAsync(file_path)
    .then(function (data) {
      
      const info = imageinfo(data);
      
      return info.mimeType;
      
    });
  
};