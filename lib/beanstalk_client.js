// Includes
var events = require('events');
var net = require('net');
var util = require('util');
var yaml = require('js-yaml');

var defaultDelay = 0;
var defaultPriority = 10;
var defaultTTR = 100000;

function noop () {}

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

util.inherits(BeanstalkCommand, events.EventEmitter);

BeanstalkCommand.prototype.onEnd = function(fn) {
  this.addListener('error', function(err) {
    fn(err, null);
  });

  this.addListener('success', function(data) {
    fn(null, data);
  });

  return this;
};

BeanstalkCommand.prototype.onError = function (fn) {
  var self = this;

  this.addListener('error', fn);

  this.addListener('success', function() {
    self.removeListener('error', noop);
  });

  return this;
};

BeanstalkCommand.prototype.onSuccess = function (fn) {
  var self = this;

  this.addListener('success', fn);

  this.addListener('error', function() {
    self.removeListener('success', noop);
  });

  return this;
};

BeanstalkCommand.prototype.responseHandler = function(data, obj, callback) {
  var lines = data.toString().split('\r\n');
  var chunks = lines[0].split(' ');
  var jobdata;

  if(obj.expected != chunks[0]) {
    this.emit('error', chunks);
    return;
  }

  // handle multiline data correctly
  if(lines.length > 2) {
    lines.pop();
    lines.shift();
    jobdata = lines.join('\r\n');
  }

  if(obj.isYAML) {
    this.emit('success', yaml.load(jobdata));
  } else {
    if(chunks.length > 1) {
      chunks.shift();

      if(jobdata) {
        chunks.pop();
        chunks.push(jobdata);
        chunks = BeanstalkJob.create(chunks);
      }
    }

    this.emit('success', chunks);
  }
};

// ##Beanstalk client
//  A client that binds to one single socket
function BeanstalkClient () {
  events.EventEmitter.call(this);
  this.address = '127.0.0.1';
  this.port = 11300;
  this.queue = [];
  this.waitingForResponses = false;
};
util.inherits(BeanstalkClient, events.EventEmitter);

// Singleton like method that returns an instance
BeanstalkClient.prototype.Instance = function (config) {
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
  var self = this;
  var cmd = new BeanstalkCommand();

  // makes sure that if there's another command queued, it gets done
  cmd.addListener('success', function(data) {
    if(self.queue.length) {
      var next = self.queue.shift();
      process.nextTick(function() {
        self.conn.write(next);
      });
    } else {
      self.waitingForResponse = false;
    }
  });

  // handles data that comes back from the connection
  var dataHandler = function(data) {
    Debug.log('response:');
    Debug.log(data);
    cmd.responseHandler.call(cmd, data, obj);
  };

  // pushes commands to the server
  var requestExec = function(data) {
    if(!self.waitingForResponse) {
      self.waitingForResponse = true;
      Debug.log('request:');
      Debug.log(data);
      process.nextTick(function() {
        self.conn.write(data);
      });
    } else {
      self.queue.push(data);
    }
  };

  if(!this.conn) {
    // if there's no connection, create one
    this.conn = net.createConnection(this.port, this.address);
    this.conn.setNoDelay();
    this.conn.setKeepAlive();

    this.conn.addListener('connect', function() {
      Debug.log('connected: '+self.address+':'+self.port);
      requestExec(obj.command);
    });

    this.conn.addListener('end', function(err) {
      self.emit('end', err);
      Debug.log('connection ended, writeOnly from now on');
    });

    this.conn.addListener('error', function(err) {
      self.emit('error', err);
      Debug.log('connection error');
    });

    this.conn.addListener('close', function(err) {
      self.emit('close', err);
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
  this.conn.destroy();
  delete this.conn;
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
  priority = priority || defaultPriority;
  delay = delay || defaultDelay;
  ttr = ttr || defaultTTR;

  return this.command({
    command: 'put '+priority+' '+delay+' '+ttr+' '+Buffer.byteLength(data, 'utf8')+'\r\n'+data+'\r\n',
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
BeanstalkClient.prototype.reserveWithTimeout = function(time) {
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
  priority = priority || defaultPriority;
  delay = delay || defaultDelay;

  return this.command({
    command: 'release '+id+' '+priority+' '+delay+'\r\n',
    expected: 'RELEASED'
  });
};


// ###bury
// buries job so it isn't picked up by reserve
BeanstalkClient.prototype.bury = function(id, priority) {
  priority = priority || defaultPriority;

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
BeanstalkClient.prototype.peekReady = function() {
  return this.command({
    command: 'peek-ready\r\n',
    expected: 'FOUND'
  });
};

// ###peek-delayed
// let's you inspect the next delayed job
BeanstalkClient.prototype.peekDelayed = function() {
  return this.command({
    command: 'peek-delayed\r\n',
    expected: 'FOUND'
  });
};

// ###peek-buried
// let's you inspect the next buried job
BeanstalkClient.prototype.peekBuried = function() {
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
    isYAML: true
  });
};

// ###stats-job
// gives statistical information about the specified job if it exists
BeanstalkClient.prototype.statsJob = function(id) {
  return this.command({
    command: 'stats-job '+id+'\r\n',
    expected: 'OK',
    isYAML: true
  });
};

// ###stats-tube
// gives statistical information about the specified tube if it exists
BeanstalkClient.prototype.statsTube = function(tube) {
  return this.command({
    command: 'stats-tube '+tube+'\r\n',
    expected: 'OK',
    isYAML: true
  });
};

// ###list-tubes
// lists all existing tubes
BeanstalkClient.prototype.listTubes = function() {
  return this.command({
    command: 'list-tubes\r\n',
    expected: 'OK',
    isYAML: true
  });
};

// ###list-tubes-watched
// lists all existing tubes that are currently watched
BeanstalkClient.prototype.listTubesWatched = function() {
  return this.command({
    command: 'list-tubes-watched\r\n',
    expected: 'OK',
    isYAML: true
  });
};

// ###list-tube-used
// returns the tube currently being used by the client
BeanstalkClient.prototype.listTubeUsed = function() {
  return this.command({
    command: 'list-tube-used\r\n',
    expected: 'USING'
  });
};

// ###pause-tube
// can delay any new job being reserved for a given time
BeanstalkClient.prototype.pauseTube = function(tube, delay) {
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
