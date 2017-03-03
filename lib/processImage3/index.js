const BPromise = require('bluebird');
const fs       = require('fs');
const path     = require('path');
const ajv      = require('ajv')({
  removeAdditional: false
});
const gm       = require('gm')
  .subClass({imageMagick: true});

BPromise.promisifyAll(require('fs'));
BPromise.promisifyAll(gm.prototype);

const calculateAspectRatio = (width, height) => {
  return (width / height).toFixed(3);
};

/**
 *
 * @param {string} dir - the directory in which the image is present
 * @param {string} base_name
 * @param {string} ext_name
 * @param {object[]} versions
 * @constructor
 */
const OriginalFile = function (dir, base_name, ext_name, versions) {
  const self = this;
  
  self.size         = {
    width : null,
    height: null
  };
  self.versions     = versions;
  self.base_name    = base_name;
  self.ext_name     = ext_name;
  self.file_name    = base_name + ext_name;
  self.file_path    = path.join(dir, base_name + ext_name);
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
      return `${base_name}_aspR_${self.getAspectRatio()}_w${self.getWidth()}_h${self.getHeight()}_e${ext_name}`;
    }
    
    return `${base_name}_aspR_${self.getAspectRatio()}_w${self.getWidth()}_h${self.getHeight()}_e${version_height}${ext_name}`;
  };
  
  self.getOriginalFileFinalPath = function (version_height, output_dir) {
    return path.join(output_dir, self.getOriginalFileFinalName(version_height));
  };
};

/**
 *
 * @param {string} output_dir - the output dir path
 * @param {OriginalFile} FL
 */
const processFile = function (FL, output_dir) {
  
  // use new array so that we can maintain the position of each file
  const version_names = new Array(FL.versions.length + 1);
  
  return BPromise.resolve()
    .then(function () {
      //calculate the dimensions
      
      const p = gm(FL.file_path);
      
      return BPromise.resolve()
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
              
              const acceptableFormats = ['GIF', 'PNG', 'JPEG'];
              
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
        .writeAsync(FL.getOriginalFileFinalPath(null, output_dir))
        .then(function () {
          
          version_names[0] = FL.getOriginalFileFinalName(null); // [0] is the optimized but not converted one
          
          return true;
        });
    })
    .then(function () {
      
      return BPromise.map(FL.versions, function (version, i) {
        
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
            .writeAsync(FL.getOriginalFileFinalPath(version.height, output_dir))
            .then(function () {
              
              version_names[i + 1] = FL.getOriginalFileFinalName(version.height);
              
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
            .writeAsync(FL.getOriginalFileFinalPath(version.height, output_dir))
            .then(function () {
              
              version_names[i + 1] = FL.getOriginalFileFinalName(version.height);
              
              return true;
            });
        }
        
      });
    })
    .then(function () {
      
      return version_names;
      
    });
  
};

const imageOptsSchema = ajv.compile({
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
});

/**
 *
 * @param {object} image_opts
 * @param {string} image_opts.dir
 * @param {string} image_opts.output_dir
 * @param {object[]} image_opts.versions - array of objects, @height(number), @width(number|null)
 * @returns {*} - an array of all the file paths
 */
module.exports = function (image_opts) {
  
  const valid = imageOptsSchema(image_opts);
  
  if (!valid) {
    const e = new Error(ajv.errorsText());
    
    e.ajv = ajv.errors;
    throw e;
  }
  
  // keys are original_file_name
  // values are root_names - can be used to get versions of the converted images
  const return_values = {};
  
  if (!path.isAbsolute(image_opts.dir)) {
    throw new Error('Path to image folder has to be absolute');
  }
  
  if (!path.isAbsolute(image_opts.output_dir)) {
    throw new Error('Path to output folder has to be absolute');
  }
  
  return BPromise.resolve()
    .then(function () {
      
      const exists = fs.existsSync(image_opts.dir);
      
      if (!exists) {
        throw new Error('folder does not exist');
      }
      
      return fs.readdirAsync(image_opts.dir)
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
      if (!fs.statSync(path.join(image_opts.dir, file)).isFile()) {
        return true;
      }
      
      const ext_name = path.extname(file);
      
      if (!ext_name) {
        throw new Error(`Could not determine extension of ${file}`);
      }
      
      const base_name = path.basename(file, ext_name);
      
      if (!base_name) {
        throw new Error(`Could not determine basename of ${file}`);
      }
      
      const FL = new OriginalFile(image_opts.dir, base_name, ext_name, image_opts.versions);
      
      return processFile(FL, image_opts.output_dir)
        .then(function (d) {
          
          return_values[FL.file_name] = d;
          
        });
      
    })
    .then(function () {
      
      return return_values;
      
    });
};