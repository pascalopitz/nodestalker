var sys = require('sys');
var assert = require('assert');
var bs = require('../lib/beanstalk_client');

sys.puts('testing ignore');

var client = bs.Client();

var success = false;
var error = false;

client.ignore('default').onSuccess(function(data) {
	sys.puts(sys.inspect(data));
  	assert.ok(data);
	assert.equal(typeof data, 'object');
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

