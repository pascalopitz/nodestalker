var sys = require('sys');
var bs = require('../lib/beanstalk_client');

bs.Debug.activate();
var client = bs.Client;

client.connect().addListener('connect', function() {
	var _self = this;
	this.stats_job(1, function(data) {
		sys.puts(sys.inspect(data));
		_self.disconnect();
	});
});
