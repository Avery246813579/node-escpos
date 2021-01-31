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

  this.attemptingReconnect = null;
  this.isConnected = false;

  return this;
};

util.inherits(Network, EventEmitter);

/**
 * connect to remote device
 * @param {[type]} callback                     Basic callback for functions
 * @param {Object} params                       Parameters for callback on actions
 * @param {Function} params.onSocketClose       Function called when the socket is disconnected
 * @param {Function} params.onSocketConnect     Function called when the socket is connected
 *
 * @return
 */
Network.prototype.open = function (callback, params = {}) {
  var self = this;
  //connect to net printer by socket (port,ip)
  this.device.on("error", (err) => {
    callback && callback(err, self.device);
  }).on("data", buf => {
    // console.log('printer say:', buf);
  }).on("close", () => {
    self.isConnected = false;

    params.onSocketClose && params.onSocketClose(self.device);

    console.log(`socket-${self.device._id} has been closed`);
    if (self.attemptingReconnect !== null) {
      return console.log(`socket-${self.device._id} has failed it's auto reconnect and has been closed`);
    }

    self.attemptingReconnect = Date.now();

    setTimeout(function () {
      try {
        console.log(`socket-${self.device._id} is attempting to reconnect`);
        Network.prototype.open.call(self, callback, params);
      } catch (err) {
        console.log(`socket-${self.device._id} failed it's reconnect`);
      }
    }, 2000);
  }).connect(this.port, this.address, function (err) {
    self.attemptingReconnect = null;
    self.isConnected = true;

    self.emit("connect", self.device);

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
Network.prototype.isConnected = function() {
  return this.isConnected;
}

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
