var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing watch, reserve, use, put');

var client = bs.Client();
var client2 = bs.Client();

var success = false;
var error = false;
var success2 = false;
var error2 = false;

var id;
var tube = 'reservetest';

client.watch(tube).onSuccess(function(data) {
	client.reserve().onSuccess(function(data) {
		console.log(data);
		assert.ok(data.id);
		assert.equal(data.data, 'test');
		success = true;

		client.deleteJob(data.id).onSuccess(function(data) {
			client.disconnect();
		});
	});
});

setTimeout(function() {
	client2.use(tube).onSuccess(function(data) {
		client2.put('test').onSuccess(function(data) {
			console.log(data);
			assert.ok(data);
			success2 = true;
			client2.disconnect();
		});
	});
}, 1000);

client.addListener('error', function() {
	error = true;
});

client2.addListener('error', function() {
	error2 = true;
});

process.addListener('exit', function() {
	assert.ok(!error);
	assert.ok(success);
	assert.ok(!error2);
	assert.ok(success2);
	console.log('test passed');
});
