var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing quit');

var client = bs.Client();

var success = false;
var closed = false;

client.use('default').onSuccess(function(data) {
	assert.ok(data);
	client.quit();
});

client.addListener('close', function() {
	closed = true;
});

process.addListener('exit', function() {
	assert.ok(closed);
	console.log('test passed');
});

