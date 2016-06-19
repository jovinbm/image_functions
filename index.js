/**
 *
 * @constructor
 */
var ImageFunctions = function () {
  this.name = 'ImageFunctions';
};

require('./lib/index')(ImageFunctions);

exports._image_functions = new ImageFunctions();