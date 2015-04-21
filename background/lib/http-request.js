// https://github.com/GoogleChrome/chrome-app-samples/tree/master/samples/websocket-server

var stringToArrayBuffer = require('./buffer-utils').stringToArrayBuffer,
    debug = require('../src/debug')('HttpRequest');

// Http response code strings.
var responseMap = {
  200: 'OK',
  301: 'Moved Permanently',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  413: 'Request Entity Too Large',
  414: 'Request-URI Too Long',
  500: 'Internal Server Error'};

// MIME types for common extensions.
var extensionTypes = {
  'css': 'text/css',
  'html': 'text/html',
  'htm': 'text/html',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'js': 'text/javascript',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'txt': 'text/plain'};

/**
 * Constructs an HttpRequest object which tracks all of the request headers and
 * socket for an active Http request.
 * @param {Object} headers The HTTP request headers.
 * @param {number} socketId The socket Id to use for the response.
 * @constructor
 */
function HttpRequest(headers, socketId) {
  this.version = 'HTTP/1.1';
  this.headers = headers;
  this.responseHeaders_ = {};
  this.headersSent = false;
  this.socketId_ = socketId;
  this.writes_ = 0;
  this.bytesRemaining = 0;
  this.finished_ = false;
  this.readyState = 1;
}

HttpRequest.prototype = {
  __proto__: require('./event-source').prototype,

  /**
   * Closes the Http request.
   */
  close: function() {
    // The socket for keep alive connections will be re-used by the server.
    // Just stop referencing or using the socket in this HttpRequest.
    if (this.headers['Connection'] != 'keep-alive') {
      chrome.sockets.tcp.close(this.socketId_);
    }
    this.socketId_ = 0;
    this.readyState = 3;
  },

  /**
   * Write the provided headers as a response to the request.
   * @param {int} responseCode The HTTP status code to respond with.
   * @param {Object} responseHeaders The response headers describing the
   *     response.
   */
  writeHead: function(responseCode, responseHeaders) {
    var headerString = this.version + ' ' + responseCode + ' ' +
        (responseMap[responseCode] || 'Unknown');
    this.responseHeaders_ = responseHeaders;
    if (this.headers['Connection'] == 'keep-alive')
      responseHeaders['Connection'] = 'keep-alive';
    if (!responseHeaders['Content-Length'] && responseHeaders['Connection'] == 'keep-alive')
      responseHeaders['Transfer-Encoding'] = 'chunked';
    for (var i in responseHeaders) {
      headerString += '\r\n' + i + ': ' + responseHeaders[i];
    }
    headerString += '\r\n\r\n';
    this.write_(stringToArrayBuffer(headerString));
  },

  /**
   * Writes data to the response stream.
   * @param {string|ArrayBuffer} data The data to write to the stream.
   */
  write: function(data) {
    if (this.responseHeaders_['Transfer-Encoding'] == 'chunked') {
      var newline = '\r\n';
      var byteLength = (data instanceof ArrayBuffer) ? data.byteLength : data.length;
      var chunkLength = byteLength.toString(16).toUpperCase() + newline;
      var buffer = new ArrayBuffer(chunkLength.length + byteLength + newline.length);
      var bufferView = new Uint8Array(buffer);
      for (var i = 0; i < chunkLength.length; i++)
        bufferView[i] = chunkLength.charCodeAt(i);
      if (data instanceof ArrayBuffer) {
        bufferView.set(new Uint8Array(data), chunkLength.length);
      } else {
        for (var i = 0; i < data.length; i++)
          bufferView[chunkLength.length + i] = data.charCodeAt(i);
      }
      for (var i = 0; i < newline.length; i++)
        bufferView[chunkLength.length + byteLength + i] = newline.charCodeAt(i);
      data = buffer;
    } else if (!(data instanceof ArrayBuffer)) {
      data = stringToArrayBuffer(data);
    }
    this.write_(data);
  },

  /**
   * Finishes the HTTP response writing |data| before closing.
   * @param {string|ArrayBuffer=} opt_data Optional data to write to the stream
   *     before closing it.
   */
  end: function(opt_data) {
    if (opt_data)
      this.write(opt_data);
    if (this.responseHeaders_['Transfer-Encoding'] == 'chunked')
      this.write('');
    this.finished_ = true;
    this.checkFinished_();
  },

  /**
   * Automatically serve the given |url| request.
   * @param {string} url The URL to fetch the file to be served from. This is
   *     retrieved via an XmlHttpRequest and served as the response to the
   *     request.
   */
  serveUrl: function(url) {
    var t = this;
    var xhr = new XMLHttpRequest();
    xhr.onloadend = function() {
      var type = 'text/plain';
      if (this.getResponseHeader('Content-Type')) {
        type = this.getResponseHeader('Content-Type');
      } else if (url.indexOf('.') != -1) {
        var extension = url.substr(url.indexOf('.') + 1);
        type = extensionTypes[extension] || type;
      }
      debug.log('Served ' + url);
      var contentLength = this.getResponseHeader('Content-Length');
      if (xhr.status == 200)
        contentLength = (this.response && this.response.byteLength) || 0;
      t.writeHead(this.status, {
        'Content-Type': type,
        'Content-Length': contentLength});
      t.end(this.response);
    };
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.send();
  },

  write_: function(array) {
    var t = this;
    this.bytesRemaining += array.byteLength;
    chrome.sockets.tcp.send(this.socketId_, array, function(writeInfo) {
      if (writeInfo.bytesSent < 0) {
        console.error('Error writing to socket, code '+writeInfo.bytesWritten);
        return;
      }
      t.bytesRemaining -= writeInfo.bytesSent;
      t.checkFinished_();
    });
  },

  checkFinished_: function() {
    if (!this.finished_ || this.bytesRemaining > 0)
      return;
    this.close();
  }
};


module.exports = HttpRequest;