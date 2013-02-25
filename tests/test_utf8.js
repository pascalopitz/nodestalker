var assert = require('assert');
var bs = require('../lib/beanstalk_client');

console.log('testing utf8');

var port = 11333;

var net = require('net');
var cnt = 0;

var mock_server = net.createServer(function(conn) {
    conn.on('data', function(data) {


        if(String(data).indexOf('put') > -1) {
            var input = data.toString().split('\r\n');

            assert.equal(input[1], "ééééé");
            assert.equal(Buffer.byteLength(input[1], 'utf8'), Buffer.byteLength("ééééé", 'utf8'));

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
  client.put("ééééé", 100, 0).onSuccess(function(data) {
    assert.ok(!isNaN(data[0]));
    client.disconnect();
  });
});

