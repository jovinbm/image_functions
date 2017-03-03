const BPromise  = require('bluebird');
const rimraf    = require('rimraf');
const path      = require('path');
const imageinfo = require('imageinfo');
const fs        = require('fs');

BPromise.promisifyAll(fs);

const clearImageOut = () => {
  return new BPromise(function (resolve, reject) {
    
    rimraf('../images_out/*.jpg', function (e) {
      if (e) {
        reject(e);
      }
      else {
        resolve(true);
      }
    });
    
  });
};

module.exports = (t, processImage) => {
  
  t.test('Should process images', function (t) {
    
    const dir        = path.join(__dirname, '../images1');
    const output_dir = path.join(__dirname, '../images_out');
    
    const opts = {
      dir       : dir,
      output_dir: output_dir,
      versions  : [
        {
          height: 400,
          width : 400
        },
        {
          height: 200,
          width : 200
        },
        {
          height: 80,
          width : 200
        }
      ]
    };
    
    let processed_return_value;
    
    return BPromise.resolve()
      .then(clearImageOut)
      .then(() => processImage(opts))
      .then(d => {
        t.true(typeof d === 'object');
        
        processed_return_value = d;
      })
      .then(() => fs.readdirAsync(opts.dir))
      .mapSeries(original_file_name => {
        
        t.comment(`Testing ${original_file_name}`);
        
        t.equal(processed_return_value[original_file_name].length, opts.versions.length + 1, 'Correct number of versions returned');
        
        const original_file_info = {
          mime        : null,
          size        : null,
          width       : null,
          height      : null,
          aspect_ratio: null
        };
        
        return BPromise.resolve()
          .then(() => {
            
            return new BPromise(function (resolve, reject) {
              fs.readFile(path.join(dir, original_file_name), function (err, data) {
                
                if (err) {
                  reject(err);
                }
                
                const info = imageinfo(data);
                
                original_file_info.mime         = info.mimeType;
                original_file_info.size         = data.length;
                original_file_info.width        = info.width;
                original_file_info.height       = info.height;
                original_file_info.aspect_ratio = (info.width / info.height).toFixed(3);
                
                resolve(true);
              });
            });
            
          })
          .then(() => processed_return_value[original_file_name])
          .mapSeries((file_name, i) => {
            
            return new BPromise(function (resolve, reject) {
              fs.readFile(path.join(output_dir, file_name), function (err, data) {
                if (err) {
                  reject(err);
                }
                
                const info = imageinfo(data);
                
                t.equal(info.mimeType, original_file_info.mime, 'mime type remains the same');
                t.true(data.length < original_file_info.size, 'Size is less than original size');
                
                if (i === 0) { // if the first file, root
                  t.equal(file_name, `${path.basename(original_file_name, path.extname(original_file_name))}_aspR_${original_file_info.aspect_ratio}_w${original_file_info.width}_h${original_file_info.height}_e.jpg`, 'Root file name correct');
                }
                else {
                  
                  const version = opts.versions[i - 1];
                  
                  t.equal(file_name, `${path.basename(original_file_name, path.extname(original_file_name))}_aspR_${original_file_info.aspect_ratio}_w${original_file_info.width}_h${original_file_info.height}_e${version.height}.jpg`, 'file name correct');
                }
                
                resolve(true);
              });
            });
            
          });
        
      })
      .then(() => {
        t.end();
      })
      .catch(t.end);
    
  });
  
  t.test('Should not process non_existent folders', function (t) {
    const dir        = path.join(__dirname, '../images0000000');
    const output_dir = path.join(__dirname, '../images_out');
    
    const opts = {
      dir,
      output_dir,
      versions: [
        {
          height: 400,
          width : 400
        },
        {
          height: 200,
          width : 200
        },
        {
          height: 80,
          width : 200
        }
      ]
    };
    
    return BPromise.resolve()
      .then(clearImageOut)
      .then(() => processImage(opts))
      .then(() => t.fail('Should fail'))
      .catch(e => {
        
        t.throws(() => {
          throw e;
        }, /folder does not exist/);
        
      })
      .then(() => {
        t.end();
      })
      .catch(t.end);
  });
  
  t.test('Should not process non_existent images', function (t) {
    const dir        = path.join(__dirname, '../images0');
    const output_dir = path.join(__dirname, '../images_out');
    
    const opts = {
      dir,
      output_dir,
      versions: [
        {
          height: 400,
          width : 400
        },
        {
          height: 200,
          width : 200
        },
        {
          height: 80,
          width : 200
        }
      ]
    };
    
    return BPromise.resolve()
      .then(clearImageOut)
      .then(() => processImage(opts))
      .then(() => t.fail('Should fail'))
      .catch(e => {
        
        t.throws(() => {
          throw e;
        }, /No images found/);
        
      })
      .then(() => {
        t.end();
      })
      .catch(t.end);
  });
  
  t.test('Should not process non images', function (t) {
    const dir        = path.join(__dirname, '../images_txt');
    const output_dir = path.join(__dirname, '../images_out');
    
    const opts = {
      dir       : dir,
      output_dir: output_dir,
      versions  : [
        {
          height: 400,
          width : 400
        },
        {
          height: 200,
          width : 200
        },
        {
          height: 80,
          width : 200
        }
      ]
    };
    
    return BPromise.resolve()
      .then(clearImageOut)
      .then(() => processImage(opts))
      .then(() => t.fail('Should fail'))
      .catch(e => {
        
        t.throws(() => {
          throw e;
        }, /only jpeg, png and gif files are allowed/i);
        
      })
      .then(() => {
        t.end();
      })
      .catch(t.end);
  });
  
};