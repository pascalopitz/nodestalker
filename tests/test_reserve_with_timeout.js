var sys = require('sys');
var bs = require('../lib/beanstalk_client');

bs.Debug.activate();
var client = bs.Client.Instance();

client.reserve_with_timeout(1).onSuccess(function(data) {
	sys.puts(sys.inspect(data));
});
