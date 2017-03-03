const BPromise  = require('bluebird');
const fs        = require('fs');
const imageSize = require('image-size');
const imageinfo = require('imageinfo');

/**
 *
 * @param {string} file_path
 * @return {*}
 */
exports.getFileSizeInKB = (file_path) => {
  
  return fs.statAsync(file_path)
    .then(stats => {
      
      return stats.size / 1024;
      
    });
  
};

/**
 *
 * @param {string} file_path
 * @return {*}
 */
exports.getImageDimensions = (file_path) => {
  
  return new BPromise((resolve, reject) => {
    
    imageSize(file_path, (e, dimensions) => {
      
      if (e) {
        return reject(e);
      }
      
      const {
              height,
              width
            } = dimensions;
      
      return resolve({
        height,
        width
      });
      
    });
    
  });
  
};

/**
 *
 * @param {string} file_path
 * @return {*}
 */
exports.getMimeType = (file_path) => {
  
  return fs.readFileAsync(file_path)
    .then(data => {
      
      const info = imageinfo(data);
      
      return info.mimeType;
      
    });
  
};