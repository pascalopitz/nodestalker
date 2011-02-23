var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing multiline put, peek, delete');

var client = bs.Client();

var success = false;
var error = false;

client.put("test\r\nhere\r\n").onSuccess(function(data) {
	console.log(data);
	var test_id = data[0];
	
	client.peek(test_id).onSuccess(function(data) {
		console.log(data);
		assert.ok(data);
		assert.equal(data.id, test_id);
		assert.equal(data.data, "test\r\nhere\r\n");
		assert.equal(typeof data, 'object');
		success = true;
		
		client.deleteJob(test_id).onSuccess(function() {
			client.disconnect();
		});
	});
});

client.addListener('error', function() {
	error = true;
});

process.addListener('exit', function() {
	assert.ok(!error);
	assert.ok(success);
	console.log('test passed');
});