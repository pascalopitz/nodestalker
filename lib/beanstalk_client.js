var events = require('events'),
	net = require('net'),
	kiwi = require('kiwi'),
	sys = require('sys');

/**
* yaml wrapper, because yaml doesn't like beanstalk
*/
var yaml = new function() {
	this.eval = function(str) {
		// YAML sucks, reg exp to make it working(ish)
		var corrected = str.replace(/\n-\ ([\w\d_-]+)/mig, '\n  - \'$1\'') //indent list
							.replace(/(\w)\-(\w)/mgi, '$1_$2') // replace minuses in hash names
							.replace(/\n([\w\d_-]+)\:\ ([\.\,\w\d_-]+)/mig, '\n  $1: \'$2\''); // format hashes
		try {
			return kiwi.require('yaml').eval(corrected);
		} catch(e) {
			Debug.log(e);
			Debug.log(corrected);
			return str;
		}
	};
};	

/**
* Simple debug console
*/
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

/**
* Beanstalk job
*/
var BeanstalkJob = {};
BeanstalkJob.create = function(data) {
	if(data.length == 2) {
		this.id = data[0];
		this.data = data[1];
		return this;
	}
	
	return false;
};


/**
* Beanstalk command
*/
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
	
	if(obj.expected != chunks[0]) {
		this.emit('command_done', chunks);
		return false;
	}
	
	if(obj.is_yaml) {
		this.emit('command_done', yaml.eval(lines[1]));
	} else {
		if(chunks.length > 1) {
			chunks.shift();

			if(lines[1]) {
				chunks.pop();
				chunks.push(lines[1]);
				
				chunks = BeanstalkJob.create(chunks);
			}
		}
		
		this.emit('command_done', chunks);
	}
	
	return true;
};

BeanstalkCommand.prototype.initConnection = function(port, address) {
	var _self = this;
	this.conn = net.createConnection(port, address);
	this.conn.connect(port, address);
	
	this.conn.addListener('connect', function() {
		Debug.log('connected: '+address+':'+port);
		_self.emit('connect', _self);
	});

	this.conn.addListener('end', function(err) {
		Debug.log('connection ended, writeOnly from now on');
	});
	
	this.conn.addListener('close', function(err) {
		Debug.log('connection closed');
		_self.emit('end', _self, err);

		if(err) {
			Debug.log('connection error');
			Debug.log(err);
		}
	});

};


/**
* Beanstalk client
*/
function BeanstalkClient() {
	events.EventEmitter.call(this);

	this.address = '127.0.0.1';
	this.port = 11300;
	this.conn;
};
sys.inherits(BeanstalkClient, events.EventEmitter);

BeanstalkClient.prototype.Instance = function(server) {
	var p = [];
	
	if(server) {
		p = server.split(':');
    }
	
	this.address = (p[0]) ? p[0] : this.address;
	this.port = (p[1]) ? p[1] : this.port;
    
	return this;
};

BeanstalkClient.prototype.command = function(obj) {
	var cmd = new BeanstalkCommand();

	cmd.addListener('data', cmd.responseHandler);
	cmd.initConnection(this.port, this.address);
	
	cmd.conn.addListener('data', function(data) {
		Debug.log('response:');
		Debug.log(data);
		cmd.emit('data', data, obj);
		cmd.conn.end();
	});

	cmd.conn.addListener('connect', function(data) {
		Debug.log('request:');
		Debug.log(obj.command);
		cmd.conn.write(obj.command);
	});

	return cmd;
};


/**
* Beanstalk client commands below
*/
BeanstalkClient.prototype.use = function(tube) {
	return this.command({
		command: 'use '+tube+'\r\n',
		expected: 'USING'
	});
};

BeanstalkClient.prototype.watch = function(tube) {
	return this.command({
		command: 'watch '+tube+'\r\n',
		expected: 'WATCHING'
	});
};

BeanstalkClient.prototype.ignore = function(tube) {
	return this.command({
		command: 'ignore '+tube+'\r\n',
		expected: 'WATCHING'
	});
};

BeanstalkClient.prototype.put = function(data, priority, delay, ttr) {
	if(typeof priority == 'undefined') {
		priority = 4294967295;
	}

	if(typeof delay == 'undefined') {
		delay = 0;
	}

	if(typeof ttr == 'undefined') {
		ttr = 100000;
	}
	
	return this.command({
		command: 'put '+priority+' '+delay+' '+ttr+' '+data.length+'\r\n'+data+'\r\n',
		expected: 'INSERTED'
	});
};
BeanstalkClient.prototype.reserve = function() {
	return this.command({
		command: 'reserve\r\n',
		expected: 'RESERVED'
	});
};

BeanstalkClient.prototype.reserve_with_timeout = function(time) {
	return this.command({
		command: 'reserve-with-timeout '+time+'\r\n',
		expected: 'RESERVED'
	});
};

BeanstalkClient.prototype.touch = function(id) {
	return this.command({
		command: 'touch '+id+'\r\n',
		expected: 'TOUCHED'
	});
};

BeanstalkClient.prototype.deleteJob = function(id) {
	return this.command({
		command: 'delete '+id+'\r\n',
		expected: 'DELETED'
	});
};

BeanstalkClient.prototype.release = function(id, priority, delay) {
	return this.command({
		command: 'release '+id+' '+priority+' '+delay+'\r\n',
		expected: 'RELEASED'
	});
};

BeanstalkClient.prototype.bury = function(id, priority) {
	return this.command({
		command: 'bury '+id+' '+priority+'\r\n',
		expected: 'BURIED'
	});
};

BeanstalkClient.prototype.kick = function(bound) {
	return this.command({
		command: 'kick '+bound+'\r\n',
		expected: 'KICKED'
	});
};

BeanstalkClient.prototype.peek = function(id) {
	return this.command({
		command: 'peek '+id+'\r\n',
		expected: 'FOUND'
	});
};

BeanstalkClient.prototype.peek_ready = function() {
	return this.command({
		command: 'peek-ready\r\n',
		expected: 'FOUND'
	});
};

BeanstalkClient.prototype.peek_delayed = function() {
	return this.command({
		command: 'peek-delayed\r\n',
		expected: 'FOUND'
	});
};

BeanstalkClient.prototype.peek_buried = function() {
	return this.command({
		command: 'peek-buried\r\n',
		expected: 'FOUND'
	});
};

BeanstalkClient.prototype.stats = function() {
	return this.command({
		command: 'stats\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};

BeanstalkClient.prototype.stats_job = function(id) {
	return this.command({
		command: 'stats-job '+id+'\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};

BeanstalkClient.prototype.stats_tube = function(tube) {
	return this.command({
		command: 'stats-tube '+tube+'\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};

BeanstalkClient.prototype.list_tubes = function() {
	return this.command({
		command: 'list-tubes\r\n',
		expected: 'OK',
		is_yaml: 1
	});
};

BeanstalkClient.prototype.list_tube_used = function() {
	return this.command({
		command: 'list-tube-used\r\n',
		expected: 'USING'
	});
};

BeanstalkClient.prototype.pause_tube = function(tube, delay) {
	return this.command({
		command: 'pause-tube '+tube+' '+delay+'\r\n',
		expected: 'PAUSED'
	});
};

/**
* Create a client instance and return it
*/
var Beanstalk = function(server) {
	var c = new BeanstalkClient;
	return c.Instance(server);
};

/**
* Expose to node
*/
exports.Client = Beanstalk;
exports.Debug = Debug;