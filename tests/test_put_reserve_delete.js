var sys = require('sys');
var bs = require('../lib/beanstalk_client');

bs.Debug.activate();
var client = bs.Client;

var new_id;
client.connect().addListener('connect', function() {
	var obj = "my job", pri=1, delay=0, ttr=60;
	var _self = this;
	
	this.put(obj, pri, delay, ttr, function(data) {
		new_id = parseInt(data);
		sys.puts(new_id);
		_self.disconnect();

		client.connect().addListener('connect', function() {
			var _self2 = this;
			this.reserve(function(data) {
				sys.puts(sys.inspect(data));
				_self2.disconnect();

				client.connect().addListener('connect', function() {
					var _self3 = this;
					this.deleteJob(new_id, function(data) {
						sys.puts(sys.inspect(data));
						_self3.disconnect();
					});
				});
			});
		});
	});
});