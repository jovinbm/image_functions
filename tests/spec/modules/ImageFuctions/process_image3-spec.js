var Promise        = require('bluebird');
var rimraf         = require('rimraf');
var path           = require('path');
var ImageFunctions = require('../../../../index')._image_functions;
var imageinfo      = require('imageinfo');
var fs             = require('fs');
Promise.promisifyAll(fs);

describe("Should process image::", function () {
  
  beforeEach(function (done) {
    
    return Promise.resolve()
      .then(function () {
        
        return new Promise(function (resolve, reject) {
          
          rimraf('../../../images_out/*.jpg', function (e) {
            if (e) {
              reject(e);
            }
            else {
              resolve(true);
            }
          });
          
        });
        
      })
      .finally(function () {
        done();
      });
  }, 10000);
  
  it("Should be defined", function () {
    expect(ImageFunctions.process_image3).toBeDefined();
  });
  
  it("Should process images", function (done) {
    
    var dir        = path.join(__dirname, '../../../images1');
    var output_dir = path.join(__dirname, '../../../images_out');
    
    var opts = {
      dir       : dir,
      output_dir: output_dir,
      versions  : [
        {height: 400, width: 400},
        {height: 200, width: 200},
        {height: 80, width: 200}
      ]
    };
    
    return Promise.resolve()
      .then(function () {
        return ImageFunctions.process_image3(opts);
      })
      .then(function (o) {
        console.log(o);
        expect(o).toBeDefined();
        expect(typeof o).toBe('object');
        
        return Promise.resolve()
          .then(function () {
            return fs.readdirAsync(opts.dir)
              .then(function (d) {
                return d;
              });
          })
          .map(function (original_file) {
            
            expect(o[original_file]).toBeDefined();
            expect(o[original_file].length).toEqual(opts.versions.length + 1); // +1 the unconverted one
            
            var original_file_info = {
              mime        : null,
              size        : null,
              width       : null,
              height      : null,
              aspect_ratio: null
            };
            
            return Promise.resolve()
              .then(function () {
                
                return new Promise(function (resolve, reject) {
                  fs.readFile(path.join(dir, original_file), function (err, data) {
                    if (err) {
                      reject(err);
                    }
                    var info                        = imageinfo(data);
                    original_file_info.mime         = info.mimeType;
                    original_file_info.size         = data.length;
                    original_file_info.width        = info.width;
                    original_file_info.height       = info.height;
                    original_file_info.aspect_ratio = (info.width / info.height).toFixed(3);
                    resolve(true);
                  });
                });
                
              })
              .then(function () {
                return o[original_file];
              })
              .each(function (file_name, i) {
                
                var version = opts.versions[i];
                
                return new Promise(function (resolve, reject) {
                  fs.readFile(path.join(output_dir, file_name), function (err, data) {
                    if (err) {
                      reject(err);
                    }
                    
                    var info = imageinfo(data);
                    expect(info.mimeType).toEqual(original_file_info.mime);
                    expect(data.length < original_file_info.size).toBe(true);
                    
                    if (i === 0) { // if the first file, root
                      expect(file_name).toEqual(path.basename(original_file, path.extname(original_file)) + '_aspR_' + original_file_info.aspect_ratio + '_w' + original_file_info.width + '_h' + original_file_info.height + '_e' + '.jpg');
                    }
                    else {
                      expect(file_name).toEqual(path.basename(original_file, path.extname(original_file)) + '_aspR_' + original_file_info.aspect_ratio + '_w' + original_file_info.width + '_h' + original_file_info.height + '_e' + version.height + '.jpg');
                    }
                    
                    resolve(true);
                  });
                });
                
              });
            
          });
      })
      .finally(function () {
        done();
      });
  });
  
  it("Should not process non_existent folders", function (done) {
    var dir        = path.join(__dirname, '../../../images0000000');
    var output_dir = path.join(__dirname, '../../../images_out');
    
    var opts = {
      dir       : dir,
      output_dir: output_dir,
      versions  : [
        {height: 400, width: 400},
        {height: 200, width: 200},
        {height: 80, width: 200}
      ]
    };
    
    return Promise.resolve()
      .then(function () {
        return ImageFunctions.process_image3(opts);
      })
      .then(function (d) {
        expect(d).not.toBeDefined();
        return true;
      })
      .catch(function (e) {
        expect(e instanceof Error).toBe(true);
        return true;
      })
      .finally(function () {
        done();
      });
  });
  
  it("Should not process non_existent images", function (done) {
    var dir        = path.join(__dirname, '../../../images0');
    var output_dir = path.join(__dirname, '../../../images_out');
    
    var opts = {
      dir       : dir,
      output_dir: output_dir,
      versions  : [
        {height: 400, width: 400},
        {height: 200, width: 200},
        {height: 80, width: 200}
      ]
    };
    
    return Promise.resolve()
      .then(function () {
        return ImageFunctions.process_image3(opts);
      })
      .then(function (d) {
        expect(d).not.toBeDefined();
        return true;
      })
      .catch(function (e) {
        expect(e instanceof Error).toBe(true);
        return true;
      })
      .finally(function () {
        done();
      });
  });
  
  it("Should not process non images", function (done) {
    var dir        = path.join(__dirname, '../../../images_txt');
    var output_dir = path.join(__dirname, '../../../images_out');
    
    var opts = {
      dir       : dir,
      output_dir: output_dir,
      versions  : [
        {height: 400, width: 400},
        {height: 200, width: 200},
        {height: 80, width: 200}
      ]
    };
    
    return Promise.resolve()
      .then(function () {
        return ImageFunctions.process_image3(opts);
      })
      .then(function (d) {
        expect(d).not.toBeDefined();
        return true;
      })
      .catch(function (e) {
        expect(e instanceof Error).toBe(true);
        expect(e.message).toEqual('The image format was not recognized. Only jpeg, png and gif files are allowed');
        return true;
      })
      .finally(function () {
        done();
      });
  });
  
});