// Includes
var events = require('events'),
	net = require('net'),
	util = require('util'),
	yaml = require('js-yaml');


// ###simple debug console
var Debug = new function() {
	var active = false;

	this.log = function(str) {
		if(active) {
			console.log(str.toString());
		}
	};

	this.activate = function() {
		active = true;
	};
};

// ###Job wrapper
// returns an object that represents a job
var BeanstalkJob = {};
BeanstalkJob.create = function(data) {
	if(data.length == 2) {
		return {
			id : data[0],
			data : data[1]
		};
	}
	return false;
};


// ##Internal command object
function BeanstalkCommand(obj) {
	this._obj = obj;
	events.EventEmitter.call(this);
};
util.inherits(BeanstalkCommand, events.EventEmitter);

BeanstalkCommand.prototype.commandObject = function() {
	return this._obj;
};

BeanstalkCommand.prototype.command = function(cmd) {
	if(!cmd) {
		return this._obj.hasOwnProperty('command') ? this._obj.command : null;
	}
	this._obj.command = cmd;
	return this;
};

BeanstalkCommand.prototype.expected = function(expected) {
	if(!expected) {
		var obj = this.commandObject();
		if( obj.hasOwnProperty('expected') ) {
			return (typeof obj.expected === "string") ? [ obj.expected ] : obj.expected;
		}
		return [];
	}
	this._obj.expected = expected;
	return this;
};

BeanstalkCommand.prototype.isYaml = function(isYaml) {
	if(!isYaml) {
		return this._obj.hasOwnProperty('is_yaml') ? this._obj.is_yaml : 0;
	}
	this._obj.is_yaml = isYaml;
	return this;
};

// simulates callback style, but calls immediately, in order to inject
// subcommands into expected call queue location
BeanstalkCommand.prototype.then = function(fn) {
	fn();
	return this;
};

BeanstalkCommand.prototype.onEnd = function(fn) {
	this.addListener('command_error', function(err) {
		fn(err, null);
	});

	this.addListener('command_success', function(data) {
		fn(null, data);
	});

	return this;
};

BeanstalkCommand.prototype.onError = function(fn) {
	this.addListener('command_error', fn);
	return this;
};

BeanstalkCommand.prototype.onSuccess = function(fn) {
	this.addListener('command_success', fn);
	return this;
};

BeanstalkCommand.prototype.responseHandler = function(data, callback) {
	var lines = data.toString().split('\r\n');
	var chunks = lines[0].split(' ');
	var jobdata = false;

	var expected = this.expected();
	var expected_match = false;

	for(var i=0; i<expected.length; i++) {
		if(expected[i] === chunks[0]) {
			expected_match = true;
		}
	}

	if(!expected_match) {
		Debug.log( 'responseHandler command_error' );
		this.emit('command_error', chunks);
		return false;
	}

	// handle multiline data correctly
	if(lines.length > 2) {
		lines.pop();
		lines.shift();
		jobdata = lines.join('\r\n');
	}

	if(this.isYaml() && jobdata) {
		Debug.log( 'responseHandler command_success isYaml' );
		this.emit('command_success', yaml.load(jobdata));
	} else {
		if(chunks.length > 1) {
			chunks.shift();

			if(jobdata) {
				chunks.pop();
				chunks.push(jobdata);
				chunks = BeanstalkJob.create(chunks);
			}
		}

		Debug.log( 'responseHandler command_success' );
		this.emit('command_success', chunks);
	}

	return true;
};

// ##Beanstalk client
//  A client that binds to one single socket
function BeanstalkClient() {
	events.EventEmitter.call(this);

	this.address = '127.0.0.1';
	this.port = 11300;
	this.conn;
	this.default_priority = 10;

	this.queue = [];
	this.waitingForResponses = false;
};
util.inherits(BeanstalkClient, events.EventEmitter);

// Singleton like method that returns an instance
BeanstalkClient.prototype.Instance = function(config) {
	if (config) {
		if (typeof config == 'string') {
			var c = config.split(':');
			this.address = c[0] || this.address;
			this.port = c[1] || this.port;
		} else {
			this.address = config.address || this.address;
			this.port = config.port || this.port;
		}
	}

	return this;
};

// executes command
BeanstalkClient.prototype.command = function(obj) {
	var _self = this;
	var cmd = new BeanstalkCommand(obj);

	// handles data that comes back from the connection
	var dataHandler = function(data) {
		Debug.log('response:');
		Debug.log(data);
		cmd.responseHandler.call(cmd, data);
	};

	// pushes commands to the server
	var requestExec = function() {
		if(!_self.waitingForResponse && _self.queue.length) {
			_self.waitingForResponse = true;
			var cmd = _self.queue.shift();

			if(_self.conn) {
				_self.conn.removeAllListeners('data');
				_self.conn.addListener('data', function(data) {
					Debug.log('response:');
					Debug.log(data);
					cmd.responseHandler.call(cmd, data);
				});
			}
			Debug.log('request:');
			Debug.log(cmd.command());
			process.nextTick(function() {
				_self.conn.write(cmd.command());
			});
		}
	};

	// makes sure that if there's another command queued, it gets done
	cmd.addListener('command_success', function(data) {
		_self.waitingForResponse = false;
		requestExec();
	});

	// if the command fails, event an error
	cmd.addListener('command_error', function(data) {
		_self.emit('end', 'Command failed');
	});

	// put every command into the local queue to control execution order
	this.queue.push(cmd);

	if(!this.conn) {
		// if there's no connection, create one
		this.conn = net.createConnection(this.port, this.address);
		this.conn.setNoDelay();
		this.conn.setKeepAlive();

		this.conn.addListener('connect', function() {
			Debug.log('connected: '+_self.address+':'+_self.port);
			requestExec();
		});

		this.conn.addListener('end', function(err) {
			_self.emit('end', err);
			Debug.log('connection ended, writeOnly from now on');
		});

		this.conn.addListener('error', function(err) {
			_self.emit('error', err);
			Debug.log('connection error');
		});

		this.conn.addListener('close', function(err) {
			_self.emit('close', err);
			Debug.log('connection closed');
		});
	} else {
		requestExec();
	}

	return cmd;
};

// disconnects a client
BeanstalkClient.prototype.disconnect = function() {
	this.conn.end();
	this.conn.destroy();
	this.conn = null;
};

// ##Beanstalk client commands

// ###use
// uses tube, this is for producers
BeanstalkClient.prototype.use = function(tube) {
	return this.command({
		command: 'use '+tube+'\r\n',
		expected: 'USING'
	});
};

// ###watch
// watches tube, this is for receivers
BeanstalkClient.prototype.watch = function(tube) {
	return this.command({
		command: 'watch '+tube+'\r\n',
		expected: 'WATCHING'
	});
};

// ###ignore
// ignores tube
BeanstalkClient.prototype.ignore = function(tube) {
	return this.command({
		command: 'ignore '+tube+'\r\n',
		expected: ['WATCHING', 'NOT_IGNORED']
	});
};

// ###put
// puts data in a tube
BeanstalkClient.prototype.put = function(data, priority, delay, ttr) {
	if(typeof priority == 'undefined') {
		priority = this.default_priority;
	}

	if(typeof delay == 'undefined') {
		delay = 0;
	}

	if(typeof ttr == 'undefined') {
		ttr = 100000;
	}

	return this.command({
		command: 'put '+priority+' '+delay+' '+ttr+' '+Buffer.byteLength(data.toString(), 'utf8')+'\r\n'+data+'\r\n',
		expected: 'INSERTED'
	});
};

// ###reserve
// picks up job from tube
BeanstalkClient.prototype.reserve = function() {
	return this.command({
		command: 'reserve\r\n',
		expected: 'RESERVED'
	});
};

// ###reserve
// picks up job from tube, with timeout
BeanstalkClient.prototype.reserve_with_timeout = function(time) {
	return this.command({
		command: 'reserve-with-timeout '+time+'\r\n',
		expected: 'RESERVED'
	});
};
// camel case alias
BeanstalkClient.prototype.reserveWithTimeout = BeanstalkClient.prototype.reserve_with_timeout;

// ###touch
// tell the server that you're still working on a job
BeanstalkClient.prototype.touch = function(id) {
	return this.command({
		command: 'touch '+id+'\r\n',
		expected: 'TOUCHED'
	});
};


// ###delete
// delets job from queue
BeanstalkClient.prototype.deleteJob = function(id) {
	return this.command({
		command: 'delete '+id+'\r\n',
		expected: 'DELETED'
	});
};

// ###release
// releases job from reserved state
BeanstalkClient.prototype.release = function(id, priority, delay) {
	if(typeof priority == 'undefined') {
		priority = this.default_priority;
	}

	if(typeof delay == 'undefined') {
		delay = 0;
	}

	return this.command({
		command: 'release '+id+' '+priority+' '+delay+'\r\n',
		expected: 'RELEASED'
	});
};


// ###bury
// buries job so it isn't picked up by reserve
BeanstalkClient.prototype.bury = function(id, priority) {
	if(typeof priority == 'undefined') {
		priority = this.default_priority;
	}

	return this.command({
		command: 'bury '+id+' '+priority+'\r\n',
		expected: 'BURIED'
	});
};

// ###kick
// kicks buried job back into queue
BeanstalkClient.prototype.kick = function(bound) {
	return this.command({
		command: 'kick '+bound+'\r\n',
		expected: 'KICKED'
	});
};

// ###peek
// let's you inspect a job
BeanstalkClient.prototype.peek = function(id) {
	return this.command({
		command: 'peek '+id+'\r\n',
		expected: [ 'FOUND', 'NOT_FOUND' ]
	});
};

// ###peek-ready
// let's you inspect the next ready job
BeanstalkClient.prototype.peek_ready = function() {
	return this.command({
		command: 'peek-ready\r\n',
		expected: [ 'FOUND', 'NOT_FOUND' ]
	});
};
// camel case alias
BeanstalkClient.prototype.peekReady = BeanstalkClient.prototype.peek_ready;

// ###peek-delayed
// let's you inspect the next delayed job
BeanstalkClient.prototype.peek_delayed = function() {
	return this.command({
		command: 'peek-delayed\r\n',
		expected: [ 'FOUND', 'NOT_FOUND' ]
	});
};
// camel case alias
BeanstalkClient.prototype.peekDelayed = BeanstalkClient.prototype.peek_delayed;

// ###peek-buried
// let's you inspect the next buried job
BeanstalkClient.prototype.peek_buried = function() {
	return this.command({
		command: 'peek-buried\r\n',
		expected: [ 'FOUND', 'NOT_FOUND' ]
	});
};
// camel case alias
BeanstalkClient.prototype.peekBuried = BeanstalkClient.prototype.peek_buried;

// ###stats
// gives statistical information about the server
BeanstalkClient.prototype.stats = function() {
	return this.command({
		command: 'stats\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};

// ###stats-job
// gives statistical information about the specified job if it exists
BeanstalkClient.prototype.stats_job = function(id) {
	return this.command({
		command: 'stats-job '+id+'\r\n',
		expected: ['OK', 'NOT_FOUND'],
		is_yaml: 1
	});
};
// camel case alias
BeanstalkClient.prototype.statsJob = BeanstalkClient.prototype.stats_job;

// ###stats-tube
// gives statistical information about the specified tube if it exists
BeanstalkClient.prototype.stats_tube = function(tube) {
	return this.command({
		command: 'stats-tube '+tube+'\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};
// camel case alias
BeanstalkClient.prototype.statsTube = BeanstalkClient.prototype.stats_tube;

// ###list-tubes
// lists all existing tubes
BeanstalkClient.prototype.list_tubes = function() {
	return this.command({
		command: 'list-tubes\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};
// camel case alias
BeanstalkClient.prototype.listTubes = BeanstalkClient.prototype.list_tubes;

// ###list-tubes-watched
// lists all existing tubes that are currently watched
BeanstalkClient.prototype.list_tubes_watched = function() {
	return this.command({
		command: 'list-tubes-watched\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};
// camel case alias
BeanstalkClient.prototype.listTubesWatched = BeanstalkClient.prototype.list_tubes_watched;

// ###list-tube-used
// returns the tube currently being used by the client
BeanstalkClient.prototype.list_tube_used = function() {
	return this.command({
		command: 'list-tube-used\r\n',
		expected: 'USING'
	});
};
// camel case alias
BeanstalkClient.prototype.listTubeUsed = BeanstalkClient.prototype.list_tube_used;

// ###pause-tube
// can delay any new job being reserved for a given time
BeanstalkClient.prototype.pause_tube = function(tube, delay) {
	return this.command({
		command: 'pause-tube '+tube+' '+delay+'\r\n',
		expected: 'PAUSED'
	});
};
// camel case alias
BeanstalkClient.prototype.pauseTube = BeanstalkClient.prototype.pause_tube;

// ###quit
// closes connection
BeanstalkClient.prototype.quit = function() {
	return this.command({
		command: 'quit\r\n'
	});
};

// ##Exposed to node
var Beanstalk = function(server) {
	var c = new BeanstalkClient;
	return c.Instance(server);
};

exports.Client = Beanstalk;
exports.Debug = Debug;
