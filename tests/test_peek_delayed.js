var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing peek_delayed');

var client = bs.Client();

var success = false;
var error = false;

client.peek_delayed().onSuccess(function(data) {
	assert.ok(data);
	success = true;
	client.disconnect();
});

client.addListener('error', function() {
	error = true;
});

process.addListener('exit', function() {
	assert.ok(!error);
	assert.ok(success);
	console.log('test passed');
});
