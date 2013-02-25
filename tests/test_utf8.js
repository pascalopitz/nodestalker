console.log('testing utf8');
var assert = require('assert');
var bs = require('../lib/beanstalk_client');
var client = bs.Client();
var mock = process.env.BEANSTALKD !== '1';

if (!mock) {
  client.use('default').onSuccess(function(data) {
    client.put("ééééé", 100, 0).onSuccess(function(data) {
      console.log(data);
      assert.ok(!isNaN(data[0]));
      client.disconnect();
    });
  });
}

