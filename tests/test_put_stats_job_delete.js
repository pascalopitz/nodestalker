var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing put stats_job');

var client = bs.Client();

var success = false;
var error = false;

client.put('test').onSuccess(function(job_data) {
	var test_id = job_data[0];

    client.stats_job(test_id).onSuccess(function(data) {
    	assert.ok(data);
    	assert.ok(data.id);
    	assert.equal(test_id, data.id);
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
