console.log('* testing stats_job not existing');
var assert = require('assert');
var helper = require('./helper');
var mockServer = new helper.mockServer(function (conn, data) {
  if(String(data) == "stats-job 111111111\r\n") {
    conn.write('NOT_FOUND\r\n');
  }
});
var client = mockServer.Client();
var error;

client.stats_job(111111111)
  .onSuccess(function (data) {
    client.disconnect();
  })
  .onError(function (err) {
    error = err;
    assert.ok(err);
    assert.ok(err.length);
    assert.equal(err[0], 'NOT_FOUND');
    client.disconnect();
  });

process.addListener('exit', function() {
  assert.ok(error);
  console.log('test passed');
});
