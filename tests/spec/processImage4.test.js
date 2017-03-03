const BPromise      = require('bluebird');
const fs            = require('fs');
const tape          = require('tape');
const processImage4 = require('../../index').processImage4;

BPromise.promisifyAll(fs);

tape('processImage4: Should process image', t => {
  
  require('./processImage.test')(t, processImage4);
  
});