// https://github.com/GoogleChrome/chrome-app-samples/blob/master/samples/tcpserver/
var debug = require('../src/debug')('TcpServer'),
    EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits;
/*
Copyright 2012 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Author: Renato Mangini (mangini@chromium.org)
*/

const DEFAULT_MAX_CONNECTIONS=20;


// Define some local variables here.
var socket = chrome.sockets.tcpServer;

/**
 * Creates an instance of the client
 *
 * @param {String} host The remote host to connect to
 * @param {Number} port The port to connect to at the remote host
 */
function TcpServer(addr, port, options) {
  opions = options || {};
  this.debug = options.debug || debug;
  this.addr = addr;
  this.port = port;
  this.maxConnections = typeof(options) != 'undefined'
      && options.maxConnections || DEFAULT_MAX_CONNECTIONS;

  this._onAccept = this._onAccept.bind(this);
  this._onAcceptError = this._onAcceptError.bind(this);

  // Callback functions.
  this.callbacks = {
    listen: null,    // Called when socket is connected.
    connect: null,    // Called when socket is connected.
    disconnect: null, // Called when socket is disconnected.
    recv: null,       // Called when client receives data from server.
    sent: null        // Called when client sends data to server.
  };

  // Sockets open
  this.openSockets=[];

  // server socket (one server connection, accepts and opens one socket per client)
  this.serverSocketId = null;

  this.debug.log('initialized tcp server');
}

inherits(TcpServer, EventEmitter);

/**
 * Static method to return available network interfaces.
 *
 * @see https://developer.chrome.com/apps/system_network#method-getNetworkInterfaces
 *
 * @param {Function} callback The function to call with the available network
 * interfaces. The callback parameter is an array of
 * {name(string), address(string)} objects. Use the address property of the
 * preferred network as the addr parameter on TcpServer contructor.
 */
TcpServer.getNetworkAddresses=function(callback) {
  chrome.system.network.getNetworkInterfaces(callback);
}

TcpServer.prototype.isConnected=function() {
  return this.serverSocketId > 0;
}

/**
 * Connects to the TCP socket, and creates an open socket.
 *
 * @see https://developer.chrome.com/apps/sockets_tcpServer#method-create
 * @param {Function} callback The function to call on connection
 */
TcpServer.prototype.listen = function(callback) {
  this.debug.log('listen');
  // Register connect callback.
  this.callbacks.connect = callback;
  socket.create({}, this._onCreate.bind(this));
};

TcpServer.prototype.getInfo = function (callback) {
  chrome.sockets.tcpServer.getInfo(this.serverSocketId, callback);
};


/**
 * Disconnects from the remote side
 *
 * @see https://developer.chrome.com/apps/sockets_tcpServer#method-disconnect
 */
TcpServer.prototype.disconnect = function() {
  if (this.serverSocketId) {
    socket.onAccept.removeListener(this._onAccept);
    socket.onAcceptError.removeListener(this._onAcceptError);
    socket.close(this.serverSocketId);
  }
  for (var i=0; i<this.openSockets.length; i++) {
    try {
      this.openSockets[i].close();
    } catch (ex) {
      this.debug.log(ex);
    }
  }
  this.openSockets=[];
  this.serverSocketId=0;
};

/**
 * The callback function used for when we attempt to have Chrome
 * create a socket. If the socket is successfully created
 * we go ahead and start listening for incoming connections.
 *
 * @private
 * @see https://developer.chrome.com/apps/sockets_tcpServer#method-listen
 * @param {Object} createInfo The socket details
 */
TcpServer.prototype._onCreate = function(createInfo) {
  this.serverSocketId = createInfo.socketId;
  if (this.serverSocketId > 0) {
    socket.onAccept.addListener(this._onAccept);
    socket.onAcceptError.addListener(this._onAcceptError);
    socket.listen(this.serverSocketId, this.addr, this.port, 50,
      this._onListenComplete.bind(this));
    this.debug.log('Server socket created. id: ', this.serverSocketId);
    this.debug.log('Request listen add: ', this.addr, ' port: ', this.port);
    this.isListening = true;
  } else {
    error('Unable to create socket');
  }
};

/**
 * The callback function used for when we attempt to have Chrome
 * connect to the remote side. If a successful connection is
 * made then we accept it by opening it in a new socket (accept method)
 *
 * @private
 */
TcpServer.prototype._onListenComplete = function(resultCode) {
  if (resultCode !==0) {
    error('Unable to listen to socket. Resultcode='+resultCode);
  } else {
    this.debug.log('Listening');
    this.getInfo(function (info) {
      this.debug.log('tcpServer.getInfo: ', info);
      this.localPort = info.localPort;
      this.localAddress = info.localAddress;
      this.emit('listening', info);
    }.bind(this));
  }
}

TcpServer.prototype._onAccept = function (info) {
  this.debug.log('serverSocketId', this.serverSocketId);
  this.debug.log('onAccept', info);

  if (info.socketId != this.serverSocketId) {
    this.debug.log('passing on connection as not my socket');
    return;
  }

  if (this.openSockets.length >= this.maxConnections) {
    this._onNoMoreConnectionsAvailable(info.clientSocketId);
    return;
  }

  var tcpConnection = new TcpConnection(info.clientSocketId, this.debug);
  this.openSockets.push(tcpConnection);

  tcpConnection.requestSocketInfo(this._onSocketInfo.bind(this));
  this.debug.log('Incoming connection handled.');
}

TcpServer.prototype._onAcceptError = function(info) {
  if (info.socketId != this.serverSocketId)
    return;

  error('Unable to accept incoming connection. Error code=' + info.resultCode);
}

TcpServer.prototype._onNoMoreConnectionsAvailable = function(socketId) {
  var msg="No more connections available. Try again later\n";
  _stringToArrayBuffer(msg, function(arrayBuffer) {
    chrome.sockets.tcp.send(socketId, arrayBuffer,
      function() {
        chrome.sockets.tcp.close(socketId);
      });
  });
}

TcpServer.prototype._onSocketInfo = function(tcpConnection, socketInfo) {
  if (this.callbacks.connect) {
    this.callbacks.connect(tcpConnection, socketInfo);
  }
}

/**
 * Holds a connection to a client
 *
 * @param {number} socketId The ID of the server<->client socket
 */
function TcpConnection(socketId, debug) {
  this.socketId = socketId;
  this.socketInfo = null;
  this.debug = debug;

  // Callback functions.
  this.callbacks = {
    disconnect: null, // Called when socket is disconnected.
    recv: null,       // Called when client receives data from server.
    sent: null        // Called when client sends data to server.
  };

  this.debug.log('Established client connection. Listening...');
};

TcpConnection.prototype = new EventEmitter();

TcpConnection.prototype.setSocketInfo = function(socketInfo) {
  this.socketInfo = socketInfo;
};

TcpConnection.prototype.requestSocketInfo = function(callback) {
  chrome.sockets.tcp.getInfo(this.socketId,
    this._onSocketInfo.bind(this, callback));
};

/**
 * Add receive listeners for when a message is received
 *
 * @param {Function} callback The function to call when a message has arrived
 */
TcpConnection.prototype.startListening = function() {
  // Add receive listeners.
  this._onReceive = this._onReceive.bind(this);
  this._onReceiveError = this._onReceiveError.bind(this);
  chrome.sockets.tcp.onReceive.addListener(this._onReceive);
  chrome.sockets.tcp.onReceiveError.addListener(this._onReceiveError);

  chrome.sockets.tcp.setPaused(this.socketId, false);
};

/**
 * Sets the callback for when a message is received
 *
 * @param {Function} callback The function to call when a message has arrived
 */
TcpConnection.prototype.addDataReceivedListener = function(callback) {
  // If this is the first time a callback is set, start listening for incoming data.
  if (!this.callbacks.recv) {
    this.startListening(callback);
  } else {
    this.callbacks.recv = callback;
  }
};


/**
 * Sends a message down the wire to the remote side
 *
 * @see https://developer.chrome.com/apps/sockets_tcp#method-send
 * @param {String} msg The message to send
 * @param {Function} callback The function to call when the message has sent
 */
TcpConnection.prototype.sendMessage = function(msg) {
  _stringToArrayBuffer(msg + '\n', function(arrayBuffer) {
    chrome.sockets.tcp.send(this.socketId, arrayBuffer, this._onWriteComplete.bind(this));
  }.bind(this));
};


/**
 * Disconnects from the remote side
 *
 * @see https://developer.chrome.com/apps/sockets_tcp#method-close
 */
TcpConnection.prototype.close = function() {
  this.debug.log('Closing TCP Connection');
  if (this.socketId) {
    chrome.sockets.tcp.onReceive.removeListener(this._onReceive);
    chrome.sockets.tcp.onReceiveError.removeListener(this._onReceiveError);
    chrome.sockets.tcp.close(this.socketId);
  }
};

/**
 * Revokes this connection's claim on the TCP connection
 * without closing it. Useful if the connection is being
 * passed on to something else
 *
 */
TcpConnection.prototype.revoke = function() {
  this.debug.log('Revoking TCP Connection');
  if (this.socketId) {
    chrome.sockets.tcp.onReceive.removeListener(this._onReceive);
    chrome.sockets.tcp.onReceiveError.removeListener(this._onReceiveError);
  }
};


/**
 * Callback function for when socket details (socketInfo) is received.
 * Stores the socketInfo for future reference and pass it to the
 * callback sent in its parameter.
 *
 * @private
 */
TcpConnection.prototype._onSocketInfo = function(callback, socketInfo) {
  if (callback && typeof(callback)!='function') {
    throw "Illegal value for callback: "+callback;
  }
  this.socketInfo = socketInfo;
  this.debug.log('socket info: ', socketInfo);
  callback(this, socketInfo);
  this.emit('socketInfo', socketInfo);
}

/**
 * Callback function for when data has been read from the socket.
 * Converts the array buffer that is read in to a string
 * and sends it on for further processing by passing it to
 * the previously assigned callback function.
 *
 * @private
 * @see TcpConnection.prototype.addDataReceivedListener
 * @param {Object} readInfo The incoming message
 */
TcpConnection.prototype._onReceive = function(info) {
  if (this.socketId != info.socketId)
    return;

  this.debug.log('TCP connection with socketId: ', this.socketId, ' receiving data: ', info);

  this.debug.log('onDataRead');
  // Convert ArrayBuffer to string.
  _arrayBufferToString(info.data, function (data) {
    this.emit('receive', data);
  }.bind(this));
};

TcpConnection.prototype._onReceiveError = function (info) {
  if (this.socketId != info.socketId)
    return;
  this.debug.log('TcpConnection error - will close connection');
  this.close();
};

/**
 * Callback for when data has been successfully
 * written to the socket.
 *
 * @private
 * @param {Object} writeInfo The outgoing message
 */
TcpConnection.prototype._onWriteComplete = function(writeInfo) {
  this.debug.log('onWriteComplete');
  this.emit('sent', writeInfo);
};



/**
 * Converts an array buffer to a string
 *
 * @private
 * @param {ArrayBuffer} buf The buffer to convert
 * @param {Function} callback The function to call when conversion is complete
 */
function _arrayBufferToString(buf, callback) {
  var bb = new Blob([new Uint8Array(buf)]);
  var f = new FileReader();
  f.onload = function(e) {
    callback(e.target.result);
  };
  f.readAsText(bb);
}

/**
 * Converts a string to an array buffer
 *
 * @private
 * @param {String} str The string to convert
 * @param {Function} callback The function to call when conversion is complete
 */
function _stringToArrayBuffer(str, callback) {
  var bb = new Blob([str]);
  var f = new FileReader();
  f.onload = function(e) {
      callback(e.target.result);
  };
  f.readAsArrayBuffer(bb);
}

/**
 * Wrapper function for error logging
 */
function error(msg) {
  debug.error(msg);
}

module.exports.TcpServer = TcpServer;
module.exports.TcpConnection = TcpConnection;
