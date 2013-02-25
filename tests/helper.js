var net = require('net');

function mockServer (fn, port) {
  this.mock = process.env.BEANSTALKD !== '1';
  this.port = port || (this.mock && 11333);
  if (this.mock) {
    var server = net.createServer(function(conn) {
      conn.on('data', function(data) {
        fn(conn, data);
      });
      conn.on('end', function(){
        server.close();
      })
    });
    server.listen(this.port);
  }
}

mockServer.prototype.Client = function () {
  var bs = require('../lib/beanstalk_client');
  return this.port ?
    bs.Client('127.0.0.1:' + this.port) :
    bs.Client();
}

module.exports = {
  mockServer: mockServer
}

