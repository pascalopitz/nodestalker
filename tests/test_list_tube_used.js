var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing list_tube_used');

var port = 11333;

var net = require('net');
var mock_server = net.createServer(function(conn) {
	conn.on('data', function(data) {
		if(String(data) == "list-tube-used\r\n") {
			var response = 'USING';
			response += "\r\n";
			response += "tube"
			response += "\r\n";
			conn.write(response);
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

client.list_tube_used().onSuccess(function(data) {
	console.log(data);
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
	console.log('test passed');
});