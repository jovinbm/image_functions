const path            = require('path');
const ajv             = require('ajv')({
  removeAdditional: false
});
const imageMetaSchema = ajv.compile({
  type                : 'object',
  required            : ['dir', 'base_name', 'ext_name', 'versions'],
  additionalProperties: false,
  properties          : {
    dir      : {
      type     : 'string',
      minLength: 1
    },
    base_name: {
      type     : 'string',
      minLength: 1
    },
    ext_name : {
      type     : 'string',
      minLength: 1,
      pattern  : '^\..*'
    },
    versions : {
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

const calculateAspectRatio = (width, height) => {
  return (width / height).toFixed(3);
};

/**
 *
 * @param {object} options
 * @param {string} options.dir
 * @param {string} options.base_name
 * @param {string} options.ext_name
 * @param {object[]} options.versions
 * @constructor
 */
const ImageMeta = function (options) {
  const self = this;
  
  const valid = imageMetaSchema(options);
  
  if (!valid) {
    const e = new Error(ajv.errorsText());
    
    e.ajv = ajv.errors;
    throw e;
  }
  
  const {
          dir,
          base_name,
          ext_name,
          versions
        } = options;
  
  self._data              = {};
  self._data.size         = {
    width : null,
    height: null
  };
  self._data.versions     = versions;
  self._data.base_name    = base_name;
  self._data.ext_name     = ext_name;
  self._data.file_name    = base_name + ext_name;
  self._data.file_path    = path.join(dir, base_name + ext_name);
  self._data.file_size_kb = null;
  
  /**
   *
   * @param {number} d
   */
  self.setWidth = (d) => {
    if (typeof d !== 'number' || d < 0) {
      throw new Error(`Invalid d ${d}`);
    }
    
    self._data.size.width = d;
  };
  
  /**
   *
   * @param {number} d
   */
  self.setHeight = (d) => {
    if (typeof d !== 'number' || d < 0) {
      throw new Error(`Invalid d ${d}`);
    }
    
    self._data.size.height = d;
  };
  
  self.getWidth = function () {
    
    if (self._data.size.width) {
      return self._data.size.width;
    }
    
    return 0;
  };
  
  self.getHeight = function () {
    
    if (self._data.size.height) {
      return self._data.size.height;
    }
    
    return 0;
  };
  
  self.getFileSizeKB = () => self._data.file_size_kb;
  self.getFileName   = () => self._data.file_name;
  self.getFilePath   = () => self._data.file_path;
  self.getVersions   = () => self._data.versions.slice(0);
  
  /**
   *
   * @param {number} size
   */
  self.setFileSizeKB = (size) => {
    if (typeof size !== 'number' || size < 0) {
      throw new Error(`Invalid size ${size}`);
    }
    
    self._data.file_size_kb = size;
  };
  
  self.getAspectRatio = function () {
    if (self._data.size.width && self._data.size.height) {
      return calculateAspectRatio(self._data.size.width, self._data.size.height);
    }
    else {
      return 0;
    }
  };
  
  self.getFinalName = function (version_height) {
    
    if (!version_height) {
      return `${base_name}_aspR_${self.getAspectRatio()}_w${self.getWidth()}_h${self.getHeight()}_e${ext_name}`;
    }
    
    return `${base_name}_aspR_${self.getAspectRatio()}_w${self.getWidth()}_h${self.getHeight()}_e${version_height}${ext_name}`;
  };
  
  self.getFinalPath = function (version_height, output_dir) {
    return path.join(output_dir, self.getFinalName(version_height));
  };
};

module.exports = ImageMeta;