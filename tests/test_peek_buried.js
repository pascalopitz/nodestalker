var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing use, put, watch, reserve, bury, peek_buried');

var client = bs.Client();

var success = false;
var error = false;

client.use('burytest').onSuccess(function(data) {
	client.put('burytest').onSuccess(function(data) {
		var test_id = data[0];
	
		client.watch('burytest').onSuccess(function() {
			client.reserve().onSuccess(function(data) {
				client.bury(test_id).onSuccess(function(data) {
					client.peek_buried().onSuccess(function(data) {
						assert.ok(data);
						assert.equal(data.id, test_id);
						assert.equal(data.data, 'burytest');
						assert.equal(typeof data, 'object');
						success = true;
		
						client.deleteJob(test_id).onSuccess(function() {
							client.disconnect();
						});
					});
				});
			});
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