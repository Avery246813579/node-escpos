"use strict";
const net = require("net");
const util = require("util");
const EventEmitter = require("events");

/**
 * Network Adapter
 * @param {[type]} address
 * @param {[type]} port
 */
function Network(address, port) {
  EventEmitter.call(this);
  this.address = address;
  this.port = port || 9100;
  this.device = new net.Socket();
  this.device.setKeepAlive(true, 5);

  this.attemptedReconnections = 0;
  this.isConnected = false;
  this.killed = false;
  this.timeoutId = -1;

  return this;
};

util.inherits(Network, EventEmitter);

/**
 * connect to remote device
 * @param {[type]} callback                     Basic callback for functions
 * @param {Object} params                       Parameters for callback on actions
 * @param {Function} params.onSocketClose       Function called when the socket is disconnected
 * @param {Function} params.onSocketConnect     Function called when the socket is connected
 * @param {Function} params.onSocketKill        Function called when the socket is killed after reconnect attempts
 *
 * @return
 */
Network.prototype.open = function (callback, params = {}) {
  var self = this;
  //connect to net printer by socket (port,ip)
  this.device.on("error", (err) => {
    clearTimeout(self.timeoutId);
    self.killed = true;

    params.onSocketKill && params.onSocketKill(self.device);
    callback && callback(err, self.device);
  }).on("close", () => {
    self.isConnected = false;

    if (self.killed) {
      return;
    }

    params.onSocketClose && params.onSocketClose(self.device);

    console.log(`socket-${self.device._id} has been closed`);
    if (self.attemptedReconnections > 3) {
      params.onSocketKill && params.onSocketKill(self.device);
      self.killed = true;

      return console.log(`socket-${self.device._id} has failed it's auto reconnect and has been closed`);
    }

    self.attemptedReconnections += 1;
    self.timeoutId = setTimeout(function () {
      try {
        console.log(`socket-${self.device._id} is attempting to reconnect, attempt number ${self.attemptedReconnections}`);
        Network.prototype.open.call(self, callback, params);
      } catch (err) {
        console.log(`socket-${self.device._id} failed it's reconnect, attempt number ${self.attemptedReconnections}`);
      }
    }, 30000 * (self.attemptedReconnections + 1));
  }).connect(this.port, this.address, function (err) {
    self.attemptedReconnections = 0;
    self.isConnected = true;
    clearTimeout(self.timeoutId);

    self.emit("connect", self.device);

    setInterval(() => {
      self.device.write(" ");
    }, 30000);

    callback && callback(err, self.device);
    params.onSocketConnect && params.onSocketConnect(self.device);
  });
  return this;
};

/**
 * write data to printer
 * @param {[type]} data -- byte data
 * @return
 */
Network.prototype.write = function (data, callback) {
  this.device.write(data, callback);
  return this;
};

/**
 * Checks if the current socket is connected or not
 *
 * @return {Boolean}
 */
Network.prototype.isConnected = function () {
  return this.isConnected;
};

Network.prototype.read = function (callback) {
  this.device.on("data", buf => {
    callback && callback(buf);
  });
  return this;
};

/**
 * [close description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Network.prototype.close = function (callback) {
  if (this.device) {
    this.device.destroy();
    this.device = null;
  }
  this.emit("disconnect", this.device);
  callback && callback(null, this.device);
  return this;
};

module.exports = Network;
