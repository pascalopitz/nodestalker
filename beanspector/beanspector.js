var sys = require('sys');  
var bt = require('../lib/beanstalk_client');
var client = bt.Client();

// bt.Debug.activate();

var TubeInspector = new function() {
	var timeout;
	
	this.listtubes = function() {
		client.list_tubes().onSuccess(function(data) {
			sys.puts(data);
			process.exit();
		});
	};

	this.statstube = function(tube) {
		client.stats_tube(tube).onSuccess(function(data) {
			sys.puts(JSON.stringify(data));
			process.exit();
		});
	};
	
	this.listcontent = function(tube) {
		client.watch(tube).onSuccess(function(data) {
			sys.puts('listing tube '+tube);

			client.reserve().onSuccess(TubeInspector.listcontentHandler);
			client.disconnect();

			if(timeout) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(function() {
				process.exit();
			}, 100);
		});
	};
	
	this.listcontentHandler = function(data) {
		sys.puts(sys.inspect(data));
		client.reserve().onSuccess(TubeInspector.listcontentHandler);
	};

	this.empty = function(tube) {
		client.watch(tube).onSuccess(function(data) {
			sys.puts('emptying tube '+tube);

			client.reserve().onSuccess(TubeInspector.emptyHandler);
			client.disconnect();

			if(timeout) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(function() {
				process.exit();
			}, 100);
		});
	};
	
	this.emptyHandler = function(data) {
		sys.puts(sys.inspect(data));
		client.disconnect();
		client.deleteJob(data.id).onSuccess(function() {
			client.reserve().onSuccess(TubeInspector.emptyHandler);
		});
	};
};

switch(process.argv[2]) {
	case 'lt':
		TubeInspector.listtubes();
		break;

	case 'st':
		TubeInspector.statstube(process.argv[3]);
		break;

	case 'lc':
		TubeInspector.listcontent(process.argv[3]);
		break;

	case 'te':
		TubeInspector.empty(process.argv[3]);
		break;
}