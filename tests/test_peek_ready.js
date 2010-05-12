var sys = require('sys');
var bs = require('../lib/beanstalk_client');

bs.Debug.activate();
var client = bs.Client();

client.peek_ready().onSuccess(function(data) {
	sys.puts(sys.inspect(data));
});
