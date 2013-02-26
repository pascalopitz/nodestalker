var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing put in forloop');

var port = 11333;

var net = require('net');
var cnt = 0;

var mock_server = net.createServer(function(conn) {
	conn.on('data', function(data) {
		if(String(data).indexOf('put') > -1) {
			cnt += 1;
			conn.write("INSERTED "+cnt+"\r\n");
		}
		
		if(String(data) == "use default\r\n") {
			conn.write('USING default\r\n');
			mock_server.close();
		}
	});
});
mock_server.listen(port);

var client = bs.Client('127.0.0.1:' + port);

client.use('default').onSuccess(function(data) {
	var completed = 0;

	for (var i=0;i<5;i++) {

	client.put("foo", 100, 0).onSuccess(function(data) {
		completed += 1;
		assert.equal(completed, data);
		

		if(completed === 5) {
			client.disconnect();
		}
	});
	} 
});

