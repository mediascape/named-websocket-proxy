var _ = require('lodash');

var Channel = require('./channel'),
    Peer = require('./peer'),
    logger = require('./debug')('Router');

var Router  = {
  handleLocalMessage: handleLocalMessage,
  handleLocalDisconnection: handleLocalDisconnection
};

module.exports = Router;

function handleLocalMessage(channel, sourcePeer, msg, localPeers, remotePeers) {
  if (!channel) { throw Error('channel not provided'); }
  if (!sourcePeer) { throw Error('sourcePeer not provided'); }
  if (!msg) { throw Error('msg not provided'); }
  if (!localPeers) { throw Error('localPeers not provided'); }

  var locals = Channel.peers(channel, localPeers || []),
      remotes = Channel.peers(channel, remotePeers || []),
      target;

  if (msg.action === 'broadcast') {
    logger.log('Broadcast to local peers', sourcePeer, locals, msg.data);
    Channel.broadcastMessage(sourcePeer, locals, msg.data);

    logger.log('Broadcast to remote peers', sourcePeer, remotes, msg.data);
    Channel.remoteBroadcastMessage(sourcePeer, remotes, msg.data);
  } else if (msg.action === 'message') {
    target = Peer.find(msg.target, localPeers);
    if (target) {
      logger.log('Sending to local peer: ', msg.data);
      Channel.directMessage(sourcePeer, target, msg.data);
      return;
    }

    target = Peer.find(msg.target, remotePeers);
    if (target) {
      logger.log('Sending to remote peer: ', msg.data);
      // Send message to remote peer
      Channel.directMessage(sourcePeer, target, msg.data);
      return;
    }

    logger.warn('Message for peer that cannot be found: ', msg);

  } else {
    logger.warn('Unknown action: ', msg.action, msg);
  }
}


function handleLocalDisconnection(channel, disconnectingPeer, localPeers, remotePeers, channels) {
  var remainingPeers;

  // Remove this peer
  Peer.remove(disconnectingPeer, localPeers);

  remainingLocalPeers = Channel.peers(channel, localPeers);
  remainingRemotePeers = Channel.peers(channel, remotePeers);

  // Disconnect localPeers in channel
  Channel.disconnectPeers(disconnectingPeer, remainingLocalPeers);

  // Disconnect remotePeers in channel
  Channel.disconnectPeers(disconnectingPeer, remainingRemotePeers);

  // Remove channel if no local peers left
  if (Channel.peers(channel, localPeers).length === 0) {
    logger.log('No local peers in channel, deleting');
    _.remove(channels, { name: channel.name });
  }

  return {
    locals: localPeers,
    channels: channels
  };
}