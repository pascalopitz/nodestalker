var sys = require('sys');
var bs = require('../lib/beanstalk_client');

bs.Debug.activate();
var client = bs.Client();

client.list_tube_used().onSuccess(function(data) {
	sys.puts(sys.inspect(data));
});
