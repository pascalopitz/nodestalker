var sys = require('sys');  
var bt = require('../lib/beanstalk_client');
var client = bt.Client();

//bt.Debug.activate();

var TubeInspector = new function() {
	var timeout;
	
	this.listtubes = function() {
		client.list_tubes().onSuccess(function(data) {
			sys.puts(sys.inspect(data));
			client.disconnect();
		});
	};

	this.statstube = function(tube) {
		client.stats_tube(tube).onSuccess(function(data) {
			sys.puts(sys.inspect(data));
			client.disconnect();
		});
	};
	
	this.listcontent = function(tube) {
		var listFunc = function(data) {
			sys.puts('listing tube '+tube);
			client.reserve().onSuccess(TubeInspector.listcontentHandler);

			if(timeout) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(function() {
				client.disconnect();
			}, 100);
		}
		
		client.watch(tube).onSuccess(function(data) {
			if(tube != 'default') {
				client.ignore('default').onSuccess(function(idata) {
					sys.puts('ignoring default tube');
					listFunc(data);
				});
			} else {
				listFunc(data);
			}
		});
	};
	
	this.listcontentHandler = function(data) {
		sys.puts(sys.inspect(data));
		client.reserve().onSuccess(TubeInspector.listcontentHandler);
	};

	this.empty = function(tube) {
		var listFunc = function(data) {
			sys.puts('emptying tube '+tube);
			client.reserve().onSuccess(TubeInspector.emptyHandler);

			if(timeout) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(function() {
				client.disconnect();
			}, 100);
		}
		
		client.watch(tube).onSuccess(function(data) {
			if(tube != 'default') {
				client.ignore('default').onSuccess(function(idata) {
					sys.puts('ignoring default tube');
					listFunc(data);
				});
			} else {
				listFunc(data);
			}
		});
	};
	
	this.emptyHandler = function(data) {
		sys.puts(sys.inspect(data));
		client.deleteJob(data.id).onSuccess(function() {
			client.reserve().onSuccess(TubeInspector.emptyHandler);
		});
	};

	this.put = function(tube, input_data) {
		client.use(tube).onSuccess(function(data) {
			client.put(input_data).onSuccess(function(data) {
				sys.puts(data);
				client.disconnect();
			});
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
	sys.puts('  -pt tube data: Puts job data in tube');
};
allowed['-lt'] = TubeInspector.listtubes,
allowed['-st'] = function() { TubeInspector.statstube(process.argv[3]); };
allowed['-lc'] = function() { TubeInspector.listcontent(process.argv[3]); };
allowed['-te'] = function() { TubeInspector.empty(process.argv[3]); };
allowed['-pt'] = function() { TubeInspector.put(process.argv[3], process.argv[4]); };

var func = (typeof allowed[process.argv[2]] == 'undefined') ?  allowed['-h'] : allowed[process.argv[2]];
func();