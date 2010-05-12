var sys = require('sys');
var bs = require('../lib/beanstalk_client');

bs.Debug.activate();
var client = bs.Client.Instance();

client.watch('default').onSuccess(function(data) {
	sys.puts(sys.inspect(data));

	client.reserve().onSuccess(function(data) {
		sys.puts(sys.inspect(data));

		if(data.id) {
			client.deleteJob(data.id);
		}
	})
});

