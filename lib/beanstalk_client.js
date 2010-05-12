var events = require('events'),
	net = require('net'),
	kiwi = require('kiwi'),
	sys = require('sys');


var yaml = new function() {
	this.eval = function(str) {
		// YAML sucks, reg exp to make it working(ish)
		var corrected = str.replace(/\n-\ ([\w\d_-]+)/mig, '\n  - \'$1\'') //indent list
							.replace(/(\w)\-(\w)/mgi, '$1_$2') // replace minuses in hash names
							.replace(/\n([\w\d_-]+)\:\ ([\.\,\w\d_-]+)/mig, '\n  $1: \'$2\'') // format hashes
		try {
			return kiwi.require('yaml').eval(corrected);
		} catch(e) {
			Debug.log(e);
			Debug.log(corrected);
			return str;
		}
	};
};	


var Debug = new function() {
	var active = false;
	
	this.log = function(str) {
		if(active) {
			sys.puts(str);
		}
	};
	
	this.activate = function() {
		active = true;
	};
};


function BeanstalkClient() {
	events.EventEmitter.call(this);

	this.address = '127.0.0.1';
	this.port = 11300;
	this.conn;
};
sys.inherits(BeanstalkClient, events.EventEmitter);

BeanstalkClient.prototype.connect = function(server) {
	var _self = this;
	var p = [];
	
	if(server) {
		p = server.split(':');
    }
	
	this.address = (p[0]) ? p[0] : this.address;
	this.port = (p[1]) ? p[1] : this.port;
    
	this.conn = net.createConnection(this.port, this.address);
	
	this.conn.addListener('connect', function() {
		_self.emit('connect');
	});
	
	this.conn.addListener('close', function(err) {
		_self.emit('end');

		if(err) {
			Debug.log('connection error');
			Debug.log(err);
		}
	});

	this.conn.connect(this.port, this.address);
	return this;
};

BeanstalkClient.prototype.disconnect = function(server) {
	this.conn.end();
};

BeanstalkClient.prototype.responseHandler = function(data, obj, callback) {
	var lines = data.toString().split('\r\n');
	var chunks = lines[0].split(' ');
	
	if(obj.expected != chunks[0]) {
		callback(chunks);
		return false;
	}
	
	if(obj.is_yaml) {
		callback(yaml.eval(lines[1]));
	} else {
		chunks.shift();
		
		if(lines[1]) {
			chunks.pop();
			chunks.push(lines[1]);
		}

		callback(chunks);
	}
};

BeanstalkClient.prototype.command = function(obj, callback) {
	var _self = this;
	this.conn.addListener('data', function(data) {
		_self.responseHandler(data, obj, callback);
	});
	this.conn.write(obj.command);
};

/* commands below */
BeanstalkClient.prototype.use = function(tube, callback) {
	return this.command({
		command: 'use '+tube+'\r\n',
		expected: 'USING',
	}, callback);
};

BeanstalkClient.prototype.watch = function(tube, callback) {
	return this.command({
		command: 'watch '+tube+'\r\n',
		expected: 'WATCHING',
	}, callback);
};

BeanstalkClient.prototype.ignore = function(tube, callback) {
	return this.command({
		command: 'ignore '+tube+'\r\n',
		expected: 'WATCHING',
	}, callback);
};

BeanstalkClient.prototype.put = function(data, priority, delay, ttr, callback) {
	return this.command({
		command: 'put '+priority+' '+delay+' '+ttr+' '+data.length+'\r\n'+data+'\r\n',
		expected: 'INSERTED',
	}, callback);
};
BeanstalkClient.prototype.reserve = function(callback) {
	return this.command({
		command: 'reserve\r\n',
		expected: 'RESERVED',
	}, callback);
};

BeanstalkClient.prototype.reserve_with_timeout = function(time, callback) {
	return this.command({
		command: 'reserve-with-timeout '+time+'\r\n',
		expected: 'RESERVED',
	}, callback);
};

BeanstalkClient.prototype.touch = function(id, callback) {
	return this.command({
		command: 'touch '+id+'\r\n',
		expected: 'TOUCHED',
	}, callback);
};

BeanstalkClient.prototype.deleteJob = function(id, callback) {
	return this.command({
		command: 'delete '+id+'\r\n',
		expected: 'DELETED',
	}, callback);
};

BeanstalkClient.prototype.release = function(id, priority, delay, callback) {
	return this.command({
		command: 'release '+id+' '+priority+' '+delay+'\r\n',
		expected: 'RELEASED',
	}, callback);
};

BeanstalkClient.prototype.bury = function(id, priority, callback) {
	return this.command({
		command: 'bury '+id+' '+priority+'\r\n',
		expected: 'BURIED',
	}, callback);
};

BeanstalkClient.prototype.kick = function(bound, callback) {
	return this.command({
		command: 'kick '+bound+'\r\n',
		expected: 'KICKED',
	}, callback);
};

BeanstalkClient.prototype.peek = function(id, callback) {
	return this.command({
		command: 'peek '+id+'\r\n',
		expected: 'FOUND',
	}, callback);
};

BeanstalkClient.prototype.peek_ready = function(callback) {
	return this.command({
		command: 'peek-ready\r\n',
		expected: 'FOUND',
	}, callback);
};

BeanstalkClient.prototype.peek_delayed = function(callback) {
	return this.command({
		command: 'peek-delayed\r\n',
		expected: 'FOUND',
	}, callback);
};

BeanstalkClient.prototype.peek_buried = function(callback) {
	return this.command({
		command: 'peek-buried\r\n',
		expected: 'FOUND',
	}, callback);
};

BeanstalkClient.prototype.stats = function(callback) {
	return this.command({
		command: 'stats\r\n',
		expected: 'OK',
		is_yaml: 1
	}, callback);
};

BeanstalkClient.prototype.stats_job = function(id, callback) {
	return this.command({
		command: 'stats-job '+id+'\r\n',
		expected: 'OK',
		is_yaml: 1
	}, callback);
};

BeanstalkClient.prototype.stats_tube = function(tube, callback) {
	return this.command({
		command: 'stats-tube '+tube+'\r\n',
		expected: 'OK',
		is_yaml: 1
	}, callback);
};

BeanstalkClient.prototype.list_tubes = function(callback) {
	return this.command({
		command: 'list-tubes\r\n',
		expected: 'OK',
		is_yaml: 1
	}, callback);
};

BeanstalkClient.prototype.list_tube_used = function(callback) {
	return this.command({
		command: 'list-tube-used\r\n',
		expected: 'USING'
	}, callback);
};


BeanstalkClient.prototype.pause_tube = function(tube, delay, callback) {
	return this.command({
		command: 'pause-tube '+tube+' '+delay+'\r\n',
		expected: 'PAUSED',
	}, callback);
};

var Beanstalk = new function() {
	this.connect = function(server) {
		var c = new BeanstalkClient;
		return c.connect(server);
	};
};

exports.Client = Beanstalk;
exports.Debug = Debug;