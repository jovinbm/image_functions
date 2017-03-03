const gm                     = require('gm').subClass({imageMagick: true});
const ajv                    = require('ajv')({
  removeAdditional: false
});
const BPromise               = require('bluebird');
const fs                     = require('fs');
const path                   = require('path');
const ImageMeta              = require('../ImageMeta');
const helpers                = require('../helpers');
const imagemin               = require('imagemin');
const imageminJpegRecompress = require('imagemin-jpeg-recompress');
const imageminGifsicle       = require('imagemin-gifsicle');
const imageminPngquant       = require('imagemin-pngquant');

BPromise.promisifyAll(require('fs'));
BPromise.promisifyAll(gm.prototype);

const optimizePNGS = (dir) => {
  
  return imagemin([path.join(dir, `/*.png`)], dir, {
    plugins: [
      imageminPngquant({
        quality: '65-80',
        verbose: true
      })
    ]
  })
    .then(files => files);
  
};

const optimizeJPEGS = (dir) => {
  
  return imagemin([path.join(dir, `/*.jpg`)], dir, {
    plugins: [
      imageminJpegRecompress({
        accurate   : true,
        quality    : 'medium',
        progressive: true,
        min        : 60,
        max        : 80
      })
    ]
  })
    .then(files => files);
  
};

const optimizeGIFS = (dir) => {
  
  return imagemin([path.join(dir, `/*.gif`)], dir, {
    plugins: [
      imageminGifsicle({
        interlaced       : false,
        optimizationLevel: 1
      })
    ]
  })
    .then(files => files);
  
};

/**
 *
 * @param {string} output_dir - the output dir path
 * @param {ImageMeta} imageMeta
 */
const prepareVersions = (imageMeta, output_dir) => {
  
  // use new array so that we can maintain the position of each file
  const versions      = imageMeta.getVersions();
  const version_names = new Array(versions.length);
  const file_path     = imageMeta.getFilePath();
  let mimeType;
  
  return BPromise.resolve()
    .then(() => helpers.getMimeType(file_path))
    .then(d => {
      
      const acceptableFormats = ['image/jpeg', 'image/png', 'image/gif'];
      
      if (acceptableFormats.indexOf(d) === -1) {
        throw new Error(`The image format '${d}' was not recognized. Only jpeg, png and gif files are allowed`);
      }
      
      mimeType = d;
      
      return true;
      
    })
    .then(() => helpers.getImageDimensions(file_path))
    .then(d => {
      
      const {
              height,
              width
            } = d;
      
      imageMeta.setHeight(height);
      imageMeta.setWidth(width);
      
      return true;
      
    })
    .then(() => helpers.getFileSizeInKB(file_path))
    .then(d => {
      
      imageMeta.setFileSizeKB(d);
      
      return true;
      
    })
    .then(() => {
      
      // resize
      
      return BPromise.map(versions, ({height, width}, i) => {
        
        const p = gm(file_path);
        
        // skip gifs for now, they require special attention when resizing: http://bit.ly/2lnF75z
        
        if (mimeType !== 'image/gif') {
          p.resize(width, height);
        }
        
        return p
          .writeAsync(imageMeta.getFinalPath(height, output_dir))
          .then(() => {
            
            version_names[i] = imageMeta.getFinalName(height);
            
            return true;
          });
        
      });
      
    })
    .then(() => version_names);
  
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
    .then(() => {
      
      const exists = fs.existsSync(image_opts.dir);
      
      if (!exists) {
        throw new Error('folder does not exist');
      }
      
      return fs.readdirAsync(image_opts.dir);
      
    })
    .then(d => {
      
      if (d.length === 0) {
        throw new Error('No images found');
      }
      
      return d;
      
    })
    .map(file_name => {
      
      // exclude folders
      if (!fs.statSync(path.join(image_opts.dir, file_name)).isFile()) {
        return true;
      }
      
      const ext_name = path.extname(file_name);
      
      if (!ext_name) {
        throw new Error(`Could not determine extension of ${file_name}`);
      }
      
      const base_name = path.basename(file_name, ext_name);
      
      if (!base_name) {
        throw new Error(`Could not determine basename of ${file_name}`);
      }
      
      const imageMeta = new ImageMeta({
        dir     : image_opts.dir,
        base_name,
        ext_name,
        versions: [
          {
            width : null,
            height: null
          }
        ].concat(image_opts.versions)
      });
      
      return prepareVersions(imageMeta, image_opts.output_dir)
        .then(d => {
          
          return_values[imageMeta.getFileName()] = d;
          
        });
      
    })
    .then(() => BPromise.map([
      () => optimizePNGS(image_opts.output_dir),
      () => optimizeJPEGS(image_opts.output_dir),
      () => optimizeGIFS(image_opts.output_dir)
    ], d => d()))
    .then(() => return_values);
};