var State = require('ampersand-state');

var Peers = require('./peers');

var Channel = function (params) {
  this.name = params.name;
  if (!this.name) {
    throw new Error('name is required');
  }

  this.peers = [];
}

Channel.prototype.addPeer = function (p) {
  this.peers.forEach(connect);
  this.peers.push(p);
}

function connect(peer) {
  console.log('\n\npeer: ');
  console.log(typeof peer);
  peer.send({
    action: 'connect'
  });
}

/*
function connect(peer) {
  console.log('\n\npeer: ');
  console.log(typeof peer);
  peer.send({
    action: 'connect'
  });
}

var instanceMethods = {
  addPeer: function (p) {
    console.log('addPeer');
    console.log(this.peers.length);

    this.peers.models.forEach(connect);
    this.peers.add(p);
  }
}

var Channel = State.extend(instanceMethods, {
  idAttribute: 'name',
  props: {
    name: {
      type: 'string',
      required: true,
      setOnce: true
    }
  },
  collections: {
    peers: Peers
  }
});
*/

module.exports = Channel;