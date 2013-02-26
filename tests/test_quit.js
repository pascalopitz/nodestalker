var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing quit');

var port = 11333;

var net = require('net');
var mock_server = net.createServer(function(conn) {
	conn.on('data', function(data) {
		if(String(data) == "use default\r\n") {
			conn.write('USING default\r\n');
		}

		if(String(data) == "quit\r\n") {
			conn.destroy();
			mock_server.close();
		}
	});
});
mock_server.listen(port);

var client = bs.Client('127.0.0.1:' + port);

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

