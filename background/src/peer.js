var EventSource = require('../lib/event-source'),
    uuid = require('node-uuid');
    _ = require('lodash'),
    debug = require('./debug')('Peer');

// var Peer = function (socket, channel, id) {
//   EventSource.apply(this);
//   this.id = id || uuid.v4();
//   this.url = '/' + channel.name + '/' + this.id + '/%s';
//   this.channelName = channel.name;
//   this.socket = socket;
//   this.socket.addEventListener('message', this.handleEvent.bind(this));
// };

// Peer.prototype.__proto__ = EventSource.prototype;

// Peer.prototype.handleEvent = function () {
//   var eventArgs = ['message'].concat( _.toArray(arguments) );
//   return this.dispatchEvent.apply(this, eventArgs);
// };

// Peer.prototype.send = function (msg) {
//   console.log('Peer id: ', this.id, ' sending: ', msg.toString());
//   return this.socket.send(msg.toString());
// };

// Peer.prototype.valueOf = function () {
//   return this.socket;
// };

module.exports = {
  find: function (id, peers) {
    return _.find(peers, { id: id });
  },
  id: function () {
    var id = uuid.v4();
    debug.log('generate id', id);
    return id;
  },
  // url: function (channel) {
  //   return '/' + channel.name + '/' + this.id + '/%s';
  // },
  remove: function (peer, peers) {
    return _.remove(peers, { id: peer.id });
  },
  send: function (peer, payload) {
    var data = JSON.stringify(payload);
    debug.log('Peer id: ', peer.id, ' send data: ', data);
    peer.socket.send(data);
  }
}