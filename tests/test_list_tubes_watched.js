var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing list_tubes_watched');

var port = 11333;

var net = require('net');
var mock_server = net.createServer(function(conn) {
	conn.on('data', function(data) {
		if(String(data) == "watch default\r\n") {
			conn.write("WATCHING\r\n");
		}

		if(String(data) == "list-tubes-watched\r\n") {
			var response = 'OK';
			response += "\r\n";
			response += "---\n- default\n  - second\n"
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

client.watch('default').onSuccess(function(data) {
	console.log('watch', data);

	client.list_tubes_watched().onSuccess(function(data) {
		assert.ok(data);
		success = true;
		client.disconnect();
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
