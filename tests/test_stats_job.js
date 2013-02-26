var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing stats_job not existing');

var port = 11333;

var net = require('net');
var mock_server = net.createServer(function(conn) {
	conn.on('data', function(data) {
		if(String(data) == "stats-job 111111111\r\n") {
			conn.write('NOT_FOUND\r\n');
		}
	});

	conn.on('end', function() {
		mock_server.close();
	});
});
mock_server.listen(port);

var client = bs.Client('127.0.0.1:' + port);

var success = false;
var error = false;

client.stats_job(111111111).onSuccess(function(data) {
	assert.ok(data);
	assert.ok(data.length);
	assert.equal(data[0], 'NOT_FOUND');
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
