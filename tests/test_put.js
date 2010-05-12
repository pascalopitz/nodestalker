var sys = require('sys');
var bs = require('../lib/beanstalk_client');

bs.Debug.activate();
var client = bs.Client();

client.use('default').onSuccess(function(data) {
	sys.puts(sys.inspect(data));

	client.put('my job').onSuccess(function(data) {
		sys.puts(sys.inspect(data));
		client.disconnect();
	});
});
