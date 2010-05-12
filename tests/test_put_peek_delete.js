var sys = require('sys');
var bs = require('../lib/beanstalk_client');

//bs.Debug.activate();
var client = bs.Client.Instance();
var new_id;

var obj = "my job", pri=1, delay=0, ttr=60;
var _self = this;

client.put(obj).onSuccess(function(data) {
	sys.puts(sys.inspect(data));
	new_id = parseInt(data);
	
	client.peek(new_id).onSuccess(function(data) {
		sys.puts(sys.inspect(typeof data));

		client.deleteJob(new_id).onSuccess(function(data) {
			sys.puts(sys.inspect(data));
		});
	});
});