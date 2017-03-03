var gm                     = require('gm').subClass({imageMagick: true});
var ajv                    = require('ajv')({
  removeAdditional: false
});
var BPromise               = require('bluebird');
var fs                     = require('fs');
var path                   = require('path');
var ImageMeta              = require('../ImageMeta');
var helpers                = require('../helpers');
var imagemin               = require('imagemin');
var imageminJpegRecompress = require('imagemin-jpeg-recompress');
var imageminGifsicle       = require('imagemin-gifsicle');
var imageminPngquant       = require('imagemin-pngquant');

BPromise.promisifyAll(require('fs'));
BPromise.promisifyAll(gm.prototype);

var optimizePNGS = function (dir) {
  
  return imagemin([path.join(dir, '/*.png')], dir, {
    plugins: [
      imageminPngquant({
        quality: '65-80',
        verbose: true
      })
    ]
  });
  
};

var optimizeJPEGS = function (dir) {
  
  return imagemin([path.join(dir, '/*.jpg')], dir, {
    plugins: [
      imageminJpegRecompress({
        accurate   : true,
        quality    : 'medium',
        progressive: true,
        min        : 60,
        max        : 80
      })
    ]
  });
  
};

var optimizeGIFS = function (dir) {
  
  return imagemin([path.join(dir, '/*.gif')], dir, {
    plugins: [
      imageminGifsicle({
        interlaced       : false,
        optimizationLevel: 1
      })
    ]
  });
  
};

/**
 *
 * @param {string} output_dir - the output dir path
 * @param {ImageMeta} imageMeta
 */
var prepareVersions = function (imageMeta, output_dir) {
  
  // use new array so that we can maintain the position of each file
  var versions      = imageMeta.getVersions();
  var version_names = new Array(versions.length);
  var file_path     = imageMeta.getFilePath();
  var mimeType;
  
  return BPromise.resolve()
    .then(function () {
      return helpers.getMimeType(file_path);
    })
    .then(function (d) {
      
      var acceptableFormats = ['image/jpeg', 'image/png', 'image/gif'];
      
      if (acceptableFormats.indexOf(d) === -1) {
        throw new Error(`The image format '${d}' was not recognized. Only jpeg, png and gif files are allowed`);
      }
      
      mimeType = d;
      
      return true;
      
    })
    .then(function () {
      return helpers.getImageDimensions(file_path);
    })
    .then(function (d) {
      
      imageMeta.setHeight(d.height);
      imageMeta.setWidth(d.width);
      
      return true;
      
    })
    .then(function () {
      return helpers.getFileSizeInKB(file_path);
    })
    .then(function (d) {
      
      imageMeta.setFileSizeKB(d);
      
      return true;
      
    })
    .then(function () {
      
      // resize
      
      return BPromise.map(versions, function (dimensions, i) {
        
        var p = gm(file_path);
        
        // skip gifs for now, they require special attention when resizing: http://bit.ly/2lnF75z
        
        if (mimeType !== 'image/gif') {
          p.resize(dimensions.width, dimensions.height);
        }
        
        return p
          .writeAsync(imageMeta.getFinalPath(dimensions.height, output_dir))
          .then(function () {
            
            version_names[i] = imageMeta.getFinalName(dimensions.height);
            
            return true;
          });
        
      });
      
    })
    .then(function () {
      return version_names;
    });
  
};

var imageOptsSchema = ajv.compile({
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
  
  var valid = imageOptsSchema(image_opts);
  
  if (!valid) {
    var e = new Error(ajv.errorsText());
    
    e.ajv = ajv.errors;
    throw e;
  }
  
  // keys are original_file_name
  // values are root_names - can be used to get versions of the converted images
  var return_values = {};
  
  if (!path.isAbsolute(image_opts.dir)) {
    throw new Error('Path to image folder has to be absolute');
  }
  
  if (!path.isAbsolute(image_opts.output_dir)) {
    throw new Error('Path to output folder has to be absolute');
  }
  
  return BPromise.resolve()
    .then(function () {
      
      var exists = fs.existsSync(image_opts.dir);
      
      if (!exists) {
        throw new Error('folder does not exist');
      }
      
      return fs.readdirAsync(image_opts.dir);
      
    })
    .then(function (d) {
      
      if (d.length === 0) {
        throw new Error('No images found');
      }
      
      return d;
      
    })
    .map(function (file_name) {
      
      // exclude folders
      if (!fs.statSync(path.join(image_opts.dir, file_name)).isFile()) {
        return true;
      }
      
      var ext_name = path.extname(file_name);
      
      if (!ext_name) {
        throw new Error(`Could not determine extension of ${file_name}`);
      }
      
      var base_name = path.basename(file_name, ext_name);
      
      if (!base_name) {
        throw new Error(`Could not determine basename of ${file_name}`);
      }
      
      var imageMeta = new ImageMeta({
        dir      : image_opts.dir,
        base_name: base_name,
        ext_name : ext_name,
        versions : [
          {
            width : null,
            height: null
          }
        ].concat(image_opts.versions)
      });
      
      return prepareVersions(imageMeta, image_opts.output_dir)
        .then(function (d) {
          
          return_values[imageMeta.getFileName()] = d;
          
        });
      
    })
    .then(function () {
      return BPromise.map([
        function () {
          return optimizePNGS(image_opts.output_dir);
        },
        function () {
          return optimizeJPEGS(image_opts.output_dir);
        },
        function () {
          return optimizeGIFS(image_opts.output_dir);
        }
      ], function (d) {
        return d();
      });
    })
    .then(function () {
      return return_values;
    });
};