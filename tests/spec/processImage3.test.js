const BPromise      = require('bluebird');
const fs            = require('fs');
const tape          = require('tape');
const processImage3 = require('../../index').processImage3;

BPromise.promisifyAll(fs);

tape('processImage3: Should process image', t => {
  
  require('./processImage.test')(t, processImage3);
  
});