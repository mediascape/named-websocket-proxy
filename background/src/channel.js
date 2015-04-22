var _ = require('lodash'),
    protocol = require('./shim-protocol'),
    debug = require('./debug')('Channel'),
    Peer = require('./peer');

// var Events = require('ampersand-events'),
//     assign = require('lodash.assign');

// var Peers = require('./peers'),
//     Peer = require('./peer'),
//     protocol = require('./shim-protocol');

// var Channel = function (params) {
//   this.name = params.name;
//   if (!this.name) {
//     throw new Error('name is required');
//   }

//   this.peers = new Peers();
//   this.peers.on('all', function (eventName, model) {
//     this.trigger('peer:'+eventName, model);
//   }.bind(this));
// }

// assign(Channel.prototype, Events);

// Channel.prototype.addSocket = function (s, /* optional */ id) {
//   var p = new Peer(s, this, id),
//       connectSourceToTarget = _.curry(connect)(p),
//       connectTargetToSource = _.curryRight(connect)(p);

//   this.peers.forEach( connectSourceToTarget );

//   if (this.peers.length > 0) {
//     this.peers.forEach( function (peer, index) {
//       connectTargetToSource(peer);
//     });
//   }

//   this.peers.push(p);
//   return p;
// }

// Channel.prototype.removePeer = function (p) {
//   this.peers.remove({ id: p.id });
//   this.peers.forEach(disconnect(p));
//   return p;
// }

// Channel.prototype.broadcastFromPeer = function (msg, peer) {
//   this.peers.reject(peer).forEach(broadcastMsgFromPeer(msg, peer));
// }

// Channel.prototype.getPeerById = function (id) {
//   return this.peers.get(id) || null;
// };

// function broadcastMsgFromPeer(payload, sourcePeer) {
//   return function (targetPeer) {
//     targetPeer.send( protocol.broadcast(sourcePeer, targetPeer, payload) );
//   }
// }

function connect(sourcePeer, targetPeer) {
  Peer.send(targetPeer, protocol.connect(sourcePeer, targetPeer) );
}

function disconnect(sourcePeer, targetPeer) {
  Peer.send(targetPeer, protocol.disconnect(sourcePeer) );
}

// function disconnect(sourcePeer) {
//   return function (targetPeer) {
//     targetPeer.send( protocol.disconnect(sourcePeer) );
//   };
// }

// module.exports = Channel;

var funcs = {
  find: function (name, channels) {
    if (!name) { throw Error('Channel.find - name missing'); }
    if (!channels) { throw Error('Channel.find - channels is missing'); }

    return _.find(channels, { name: name });
  },
  peers: function (channel, peers) {
    if (!channel) { throw Error('Channel.peers - channel missing'); }
    if (!peers) { throw Error('Channel.peers - peers is missing'); }

    return _.filter(peers, { channel: channel.name });
  },
  connectPeers: function (newPeer, peers) {
    debug.log('connectPeers: ', newPeer, peers);

    // Connect existing to newPeer
    _.forEach(peers, function (p) {
      connect(newPeer, p);
    });

    // Connect newPeer to existing
    _.forEach(peers, function (p) {
      connect(p, newPeer);
    });
  },
  disconnectPeers: function (peer, peers) {
    _.forEach(peers, function (p) {
      disconnect(peer, p);
    });
  },
  directMessage: function (sourcePeer, targetPeer, payload) {
    Peer.send(targetPeer, protocol.message(sourcePeer, payload) );
  },
  broadcastMessage: function (source, targets, payload) {
    _.forEach(targets, function (peer) {
      funcs.directMessage(source, peer, payload);
    });
  }
};

module.exports = funcs;