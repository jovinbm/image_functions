module.exports = function (ImageFunctions) {
  var Promise = require('bluebird');
  var fs      = require('fs');
  var path    = require('path');
  var ajv     = require("ajv")({
    removeAdditional: false
  });
  var gm      = require('gm')
    .subClass({imageMagick: true});
  Promise.promisifyAll(gm.prototype);
  
  /**
   *
   * @param {object} opts
   * @param {string} opts.dir
   * @param {string} opts.output_dir
   * @param {object[]} opts.versions - array of objects, @height(number), @width(number|null)
   * @returns {*} - an array of all the file paths
   */
  ImageFunctions.prototype.process_image3 = function (opts) {
    
    var schema = {
      type                : 'object',
      additionalProperties: false,
      required            : ['dir', 'output_dir', 'versions'],
      properties          : {
        dir       : {
          type     : 'string',
          minLength: 1
        },
        output_dir: {
          type     : 'string',
          minLength: 1
        },
        versions  : {
          type    : 'array',
          minItems: 1,
          items   : {
            type                : 'object',
            additionalProperties: false,
            required            : ['height', 'width'],
            properties          : {
              height: {
                type: ['integer', 'null']
              },
              width : {
                type: ['integer', 'null']
              }
            }
          }
        }
      }
    };
    
    var valid = ajv.validate(schema, opts);
    
    if (!valid) {
      var e = new Error(ajv.errorsText());
      e.ajv = ajv.errors;
      throw e;
    }
    
    if (!path.isAbsolute(opts.dir)) {
      throw new Error('Path to image folder has to be absolute');
    }
    
    if (!path.isAbsolute(opts.output_dir)) {
      throw new Error('Path to output folder has to be absolute');
    }
    
    // keys are original_file_name
    // values are root_names - can be used to get versions of the converted images
    var return_values = {};
    
    return Promise.resolve()
      .then(function () {
        return fs.readdirAsync(opts.dir)
          .then(function (d) {
            return d;
          });
      })
      .then(function (d) {
        if (d.length === 0) {
          throw new Error('No images found');
        }

        return d;
      })
      .map(function (file) {
        
        // exclude folders
        if (!fs.statSync(path.join(opts.dir, file)).isFile()) {
          return true;
        }
        
        var ext_name = path.extname(file);
        
        if (!ext_name) {
          throw new Error('Could not determine extension of ' + file);
        }
        
        var base_name = path.basename(file, ext_name);
        
        if (!base_name) {
          throw new Error('Could not determine basename of ' + file);
        }
        
        var FL = new OriginalFile(base_name, ext_name, opts.versions);
        
        return processFile(FL);
        
      })
      .then(function () {
        return return_values;
      });
    
    function calculateAspectRatio(width, height) {
      return (width / height).toFixed(3);
    }
    
    /**
     *
     * @param {string} base_name
     * @param {string} ext_name
     * @param {object[]} versions
     * @constructor
     */
    function OriginalFile(base_name, ext_name, versions) {
      var self = this;
      
      self.size = {
        width : null,
        height: null
      };
      
      self.versions = versions;
      
      self.base_name = base_name;
      self.ext_name  = ext_name;
      self.file_name = base_name + ext_name;
      self.file_path = path.join(opts.dir, base_name + ext_name);
      
      self.file_size_kb = null;
      
      self.getWidth = function () {
        if (self.size.width) {
          return self.size.width;
        }
        return 0;
      };
      
      self.getHeight = function () {
        if (self.size.height) {
          return self.size.height;
        }
        return 0;
      };
      
      self.getAspectRatio = function () {
        if (self.size.width && self.size.height) {
          return calculateAspectRatio(self.size.width, self.size.height);
        }
        else {
          return 0;
        }
      };
      
      self.getOriginalFileFinalName = function (version_height) {
        if (!version_height) {
          return base_name + '_aspR_' + self.getAspectRatio() + '_w' + self.getWidth() + '_h' + self.getHeight() + '_e' + ext_name;
        }
        return base_name + '_aspR_' + self.getAspectRatio() + '_w' + self.getWidth() + '_h' + self.getHeight() + '_e' + version_height + ext_name;
      };
      
      self.getOriginalFileFinalPath = function (version_height) {
        return path.join(opts.output_dir, self.getOriginalFileFinalName(version_height));
      };
    }
    
    /**
     *
     * @param {OriginalFile} FL
     */
    function processFile(FL) {
      
      return Promise.resolve()
        .then(function () {
          //calculate the dimensions
          
          var p = gm(FL.file_path);
          
          return Promise.resolve()
            .bind(p)
            .then(function () {
              return this.sizeAsync()
                .then(function (val) {
                  FL.size = {
                    height: val.height || 0,
                    width : val.width || 0
                  };
                  return true;
                });
            })
            .then(function () {
              return this.filesizeAsync()
                .then(function (val) {
                  FL.file_size_kb = Number(parseFloat(val)) || 0.0;
                  return true;
                });
            })
            .then(function () {
              return this.formatAsync()
                .then(function (val) {
                  var acceptableFormats = ['GIF', 'PNG', 'JPEG'];
                  
                  if (acceptableFormats.indexOf(val) === -1) {
                    throw new Error('The image format was not recognized. Only jpeg, png and gif files are allowed');
                  }
                  return true;
                });
            });
        })
        .then(function () {
          // prepare original file, not resized, this will be considered for giving the link to the original optimized file
          
          return gm(FL.file_path)
            .filter('Triangle')
            .define('filter:support=2')
            .unsharp(0.25, 0.25, 8, 0.065)
            //.out('-posterize', 136) -- makes process slow
            .quality(82)
            .define('jpeg:fancy-upsampling=off')
            .define('png:compression-filter=5')
            .define('png:compression-level=9')
            .define('png:compression-strategy=1')
            .define('png:exclude-chunk=all')
            .interlace('None')
            .colorspace('sRGB')
            .writeAsync(FL.getOriginalFileFinalPath(null))
            .then(function () {
              return_values[FL.file_name] = [];
              return_values[FL.file_name].push(FL.getOriginalFileFinalName(null)); // [0] is the optimized but not converted one
              return true;
            });
        })
        .then(function () {
          
          return Promise.map(FL.versions, function (version) {
            
            // for the version at height 400, check the image size first, if it is less that 70KB,
            // then it's a low quality image, don't resize it
            
            if (version.height === 400 && (FL.file_size_kb <= 70.0)) {
              
              return gm(FL.file_path)
                .filter('Triangle')
                .define('filter:support=2')
                .unsharp(0.25, 0.25, 8, 0.065)
                //.out('-posterize', 136) -- makes process slow
                .quality(82)
                .define('jpeg:fancy-upsampling=off')
                .define('png:compression-filter=5')
                .define('png:compression-level=9')
                .define('png:compression-strategy=1')
                .define('png:exclude-chunk=all')
                .interlace('None')
                .colorspace('sRGB')
                .writeAsync(FL.getOriginalFileFinalPath(version.height))
                .then(function () {
                  return_values[FL.file_name].push(FL.getOriginalFileFinalName(version.height));
                  return true;
                });
              
            }
            else {
              
              return gm(FL.file_path)
                .filter('Triangle')
                .define('filter:support=2')
                .unsharp(0.25, 0.25, 8, 0.065)
                //.out('-posterize', 136) -- makes process slow
                .quality(82)
                .define('jpeg:fancy-upsampling=off')
                .define('png:compression-filter=5')
                .define('png:compression-level=9')
                .define('png:compression-strategy=1')
                .define('png:exclude-chunk=all')
                .interlace('None')
                .colorspace('sRGB')
                .resize(version.width, version.height)
                .writeAsync(FL.getOriginalFileFinalPath(version.height))
                .then(function () {
                  return_values[FL.file_name].push(FL.getOriginalFileFinalName(version.height));
                  return true;
                });
            }
            
          });
        });
      
    }
  };
};