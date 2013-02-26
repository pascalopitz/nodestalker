var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing peek_delayed');

var port = 11333;

var net = require('net');
var mock_server = net.createServer(function(conn) {
	conn.on('data', function(data) {
		if(String(data) == 'peek-delayed\r\n') {
			conn.write("OK\r\n");
		}
	});
	
	conn.on('end', function(){
		mock_server.close();
	})
});
mock_server.listen(port);

var client = bs.Client('127.0.0.1:' + port);

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
