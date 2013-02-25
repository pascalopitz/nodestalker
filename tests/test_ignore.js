console.log('* testing ignore');
var assert = require('assert');
var helper = require('./helper');
var mockServer = new helper.mockServer(function (conn, data) {
  if(String(data) == "ignore default\r\n") {
    conn.write('WATCHING');
  }
});
var client = mockServer.Client();
var error;

client.ignore('default')
  .onSuccess(function(data) {
    assert.ok(data);
    assert.equal(typeof data, 'object');
    client.disconnect();
  })
  .onError(function(err) {
    error = err;
    client.disconnect();
  });

process.addListener('exit', function() {
  assert.ok(!error);
  console.log('test passed');
});

