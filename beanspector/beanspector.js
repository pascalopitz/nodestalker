var bt = require('../lib/beanstalk_client');

/**
* default variables
*/
var host = '127.0.0.1';
var port = 11300;
var argv = [];

/**
* parse the argvs for host and port
*/
for(i in process.argv) {
	var match = /\-\-(host|port)\=([\d\.\w\-]+)/i.exec(process.argv[i]);
	
	if(match) {
		eval(match[1] + '="' + match[2] + '";');
	} else {
		argv.push(process.argv[i]);
	}
}

/**
* Create beanstalk client
*/
var client = bt.Client(host + ':' + port);

/**
* Main object containing all beanstalk interactions
*/
var TubeInspector = new function() {
	var timeout;
	
	this.listtubes = function() {
		client.list_tubes().onSuccess(function(data) {
			console.log(data);
			client.disconnect();
		});
	};

	this.statstube = function(tube) {
		client.stats_tube(tube).onSuccess(function(data) {
			console.log(data);
			client.disconnect();
		});
	};
	
	this.listcontent = function(tube) {
		var listFunc = function(data) {
			console.log('listing tube '+tube);
			client.reserve().onSuccess(TubeInspector.listcontentHandler);

			if(timeout) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(function() {
				client.disconnect();
			}, 100);
		};
		
		client.watch(tube).onSuccess(function(data) {
			if(tube != 'default') {
				client.ignore('default').onSuccess(function(idata) {
					console.log('ignoring default tube');
					listFunc(data);
				});
			} else {
				listFunc(data);
			}
		});
	};
	
	this.listcontentHandler = function(data) {
		console.log(data);
		client.reserve().onSuccess(TubeInspector.listcontentHandler);
	};

	this.empty = function(tube) {
		var listFunc = function(data) {
			console.log('emptying tube '+tube);
			client.reserve().onSuccess(TubeInspector.emptyHandler);

			if(timeout) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(function() {
				client.disconnect();
			}, 100);
		};
		
		client.watch(tube).onSuccess(function(data) {
			if(tube != 'default') {
				client.ignore('default').onSuccess(function(idata) {
					console.log('ignoring default tube');
					listFunc(data);
				});
			} else {
				listFunc(data);
			}
		});
	};
	
	this.emptyHandler = function(data) {
		console.log(data);
		client.deleteJob(data.id).onSuccess(function() {
			client.reserve().onSuccess(TubeInspector.emptyHandler);
		});
	};

	this.put = function(tube, input_data) {
		client.use(tube).onSuccess(function(data) {
			client.put(input_data).onSuccess(function(data) {
				console.log(data);
				client.disconnect();
			});
		});
	};

	this.kick = function(tube, input_data) {
		client.use(tube).onSuccess(function(data) {
			client.kick(input_data).onSuccess(function(data) {
				console.log(data);
				client.disconnect();
			});
		});
	};
};

/**
* allowed commands, an array of functions
*/
var allowed = [];
allowed['-h'] = function() { 
	console.log('usage:');
	console.log('node beanspector.js [--port=11300] [--host=127.0.0.1] args');
	console.log('  -h: help message');
	console.log('  -lt: Lists tubes');
	console.log('  -st tube: Stats on tube');
	console.log('  -lc tube: Lists tube content');
	console.log('  -te tube: Empties tube');
	console.log('  -pt tube data: Puts job data in tube');
	console.log('  -k tube number: Kicks number of jobs tube');
};
allowed['-lt'] = TubeInspector.listtubes;
allowed['-st'] = function() { TubeInspector.statstube(argv[3]); };
allowed['-lc'] = function() { TubeInspector.listcontent(argv[3]); };
allowed['-te'] = function() { TubeInspector.empty(argv[3]); };
allowed['-pt'] = function() { TubeInspector.put(argv[3], argv[4]); };
allowed['-k'] = function() { TubeInspector.kick(argv[3], argv[4]); };

/**
* check whether nothing was passed
*/
var func = (typeof allowed[argv[2]] == 'undefined') ?  allowed['-h'] : allowed[argv[2]];

/**
* call defined command
*/
func();