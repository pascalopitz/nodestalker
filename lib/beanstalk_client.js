// Includes
var events = require('events'),
	net = require('net'),
	sys = require('sys');

// ##yaml wrapper
// because yaml doesn't like beanstalk
var yaml = new function() {
	this.eval = function(str) {
		if (!str.replace) {
			return str;
		}

		// YAML sucks, reg exp to make it working(ish)
		var corrected = str.replace(/\n-\ ([\w\d_-]+)/mig, '\n  - \'$1\'') //indent list
							.replace(/(\w)\-(\w)/mgi, '$1_$2') // replace minuses in hash names
							.replace(/\n([\w\d_-]+)\:\ ([\.\,\w\d_-]+)/mig, '\n  $1: \'$2\'') // format hashes
							;
		
		try {
			return require('yaml').eval(corrected);
		} catch(e) {
			Debug.log(e);
			Debug.log(corrected);
			return str;
		}
	};
};	

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
function BeanstalkCommand() {
	events.EventEmitter.call(this);
};
sys.inherits(BeanstalkCommand, events.EventEmitter);

BeanstalkCommand.prototype.onSuccess = function(callback) {
	this.addListener('command_done', function(data) {
		callback(data);
	});
};

BeanstalkCommand.prototype.responseHandler = function(data, obj, callback) {
	var lines = data.toString().split('\r\n');
	var chunks = lines[0].split(' ');
	var jobdata = false;
	
	if(obj.expected != chunks[0]) {
		this.emit('command_done', chunks);
		return false;
	}

	// handle multiline data correctly
	if(lines.length > 2) {
		lines.pop();
		lines.shift();
		jobdata = lines.join('\r\n');
	}

	if(obj.is_yaml) {
		this.emit('command_done', yaml.eval(jobdata));
	} else {
		if(chunks.length > 1) {
			chunks.shift();

			if(jobdata) {
				chunks.pop();
				chunks.push(jobdata);
				chunks = BeanstalkJob.create(chunks);
			}
		}
		
		this.emit('command_done', chunks);
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
};
sys.inherits(BeanstalkClient, events.EventEmitter);

// Singleton like method that returns an instance
BeanstalkClient.prototype.Instance = function(server) {
	var p = [];
	
	if(server) {
		p = server.split(':');
	}
	
	this.address = (p[0]) ? p[0] : this.address;
	this.port = (p[1]) ? p[1] : this.port;
	return this;
};

// executes command
BeanstalkClient.prototype.command = function(obj) {
	var _self = this;
	var cmd = new BeanstalkCommand();
	cmd.addListener('data', cmd.responseHandler);
    
    // handles data that comes back from the connection
	var dataHandler = function(data) {
		Debug.log('response:');
		Debug.log(data);
		cmd.emit('data', data, obj);
	};

	// pushes commands to the server
	var requestExec = function(data) {
		Debug.log('request:');
		Debug.log(data);
		process.nextTick(function() {
    		_self.conn.write(data);
		});
	};
   
	if(!this.conn) {
        // if there's no connection, create one
		this.conn = net.createConnection(this.port, this.address);
		this.conn.setNoDelay();
		this.conn.setKeepAlive();

		this.conn.addListener('connect', function() {
			Debug.log('connected: '+_self.address+':'+_self.port);
			requestExec(obj.command);
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
		this.conn.removeAllListeners('data');
		requestExec(obj.command);
	}
	
	this.conn.addListener('data', dataHandler);
	return cmd;
};

// disconnects a client
BeanstalkClient.prototype.disconnect = function() {
	this.conn.end();
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
		expected: 'WATCHING'
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
		command: 'put '+priority+' '+delay+' '+ttr+' '+data.toString().length+'\r\n'+data+'\r\n',
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
		expected: 'FOUND'
	});
};

// ###peek-ready
// let's you inspect the next ready job
BeanstalkClient.prototype.peek_ready = function() {
	return this.command({
		command: 'peek-ready\r\n',
		expected: 'FOUND'
	});
};

// ###peek-delayed
// let's you inspect the next delayed job
BeanstalkClient.prototype.peek_delayed = function() {
	return this.command({
		command: 'peek-delayed\r\n',
		expected: 'FOUND'
	});
};

// ###peek-buried
// let's you inspect the next buried job
BeanstalkClient.prototype.peek_buried = function() {
	return this.command({
		command: 'peek-buried\r\n',
		expected: 'FOUND'
	});
};

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
		expected: 'OK',
		is_yaml: 1
	});
};

// ###stats-tube
// gives statistical information about the specified tube if it exists
BeanstalkClient.prototype.stats_tube = function(tube) {
	return this.command({
		command: 'stats-tube '+tube+'\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};

// ###list-tubes
// lists all existing tubes
BeanstalkClient.prototype.list_tubes = function() {
	return this.command({
		command: 'list-tubes\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};

// ###list-tubes-watched
// lists all existing tubes that are currently watched
BeanstalkClient.prototype.list_tubes_watched = function() {
	return this.command({
		command: 'list-tubes-watched\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};

// ###list-tube-used
// returns the tube currently being used by the client
BeanstalkClient.prototype.list_tube_used = function() {
	return this.command({
		command: 'list-tube-used\r\n',
		expected: 'USING'
	});
};

// ###pause-tube
// can delay any new job being reserved for a given time
BeanstalkClient.prototype.pause_tube = function(tube, delay) {
	return this.command({
		command: 'pause-tube '+tube+' '+delay+'\r\n',
		expected: 'PAUSED'
	});
};

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
