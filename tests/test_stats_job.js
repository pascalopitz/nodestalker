var sys = require('sys');
var bs = require('../lib/beanstalk_client');

bs.Debug.activate();
var client = bs.Client();

client.stats_job(1).onSuccess(function(data) {
	sys.puts(sys.inspect(data));
});
