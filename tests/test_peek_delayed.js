console.log('* testing peekDelayed()');
var assert = require('assert');
var helper = require('./helper');
var mockServer = new helper.mockServer(function (conn, data) {
  if(String(data) == 'peek-delayed\r\n') {
    conn.write("FOUND 10 7\r\ntest\r\n");
  }
});
var client = mockServer.Client();
var error;

client.peekDelayed()
  .onSuccess(function (data) {
    assert.ok(data);
    client.disconnect();
  })
  .onError(function (err) {
    console.log('ERROR', err);
    error = err;
    client.disconnect();
  });

process.addListener('exit', function() {
  assert.ok(!error);
  console.log('test passed');
});
