var sys = require('sys');
var assert = require('assert');
var bs = require('../lib/beanstalk_client');

sys.puts('testing reserve_with_timeout');

var client = bs.Client();

var success = false;
var error = false;

client.reserve_with_timeout(2).onSuccess(function(data) {
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
	sys.puts('test passed');
});
