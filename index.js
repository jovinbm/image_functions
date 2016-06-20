/**
 *
 * @constructor
 */
var ImageFunctions = function () {
  this.name = 'ImageFunctions';
};

require('./lib/index')(ImageFunctions);

exports.image_functions = ImageFunctions;