var sys = require('sys');  
var bt = require('../lib/beanstalk_client');
var client = bt.Client();

// bt.Debug.activate();

var TubeInspector = new function() {
	var timeout;
	
	this.listtubes = function() {
		client.list_tubes().onSuccess(function(data) {
			sys.puts(sys.inspect(data));
			process.exit();
		});
	};

	this.statstube = function(tube) {
		client.stats_tube(tube).onSuccess(function(data) {
			sys.puts(sys.inspect(data));
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

var allowed = [];
allowed['-h'] = function() { 
	sys.puts('usage:');
	sys.puts('node beanspector.js args');
	sys.puts('  -h: help message');
	sys.puts('  -lt: Lists tubes');
	sys.puts('  -st tube: Stats on tube');
	sys.puts('  -lc tube: Lists tube content');
	sys.puts('  -te tube: Empties tube');
};
allowed['-lt'] = TubeInspector.listtubes,
allowed['-st'] = function() { TubeInspector.statstube(process.argv[3]); };
allowed['-lc'] = function() { TubeInspector.listcontent(process.argv[3]); };
allowed['-te'] = function() { TubeInspector.empty(process.argv[3]); };

var func = (typeof allowed[process.argv[2]] == 'undefined') ?  allowed['-h'] : allowed[process.argv[2]];
func();