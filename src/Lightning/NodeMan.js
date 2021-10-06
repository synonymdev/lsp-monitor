const async = require('async')
const Node = require('./Node')

class LightningManager {
  constructor (config) {
    this.config = config
    this.setNode()
  }

  setNode () {
    this.nodes = this.config.nodes
      .map((node) => new Node(node))
  }

  start (cb) {
    if (this.nodes.length === 0) throw new Error('Nodes not set')
    async.map(this.nodes, (node, next) => {
      node.start(next)
    }, (err, data) => {
      if (err) throw err
      cb(null, this)
    })
  }

  getOnChainBalance (config, args, cb) {
    this.getNode(config).getOnChainBalance(args, cb)
  }

  getFeeRate (config, args, cb) {
    this.getNode(config).getFeeRate(args, cb)
  }

  createInvoice (config, args, cb) {
    this.getNode(config).createInvoice(args, cb)
  }

  createHodlInvoice (config, args, cb) {
    this.getNode(config).createHodlInvoice(args, cb)
  }

  settleHodlInvoice (config, args, cb) {
    this.getNode(config).settleHodlInvoice(args, cb)
  }

  cancelInvoice (config, args, cb) {
    this.getNode(config).cancelInvoice(args, cb)
  }

  decodePaymentRequest (config, args, cb) {
    this.getNode(config).decodePayReq(args, cb)
  }

  getNode (config) {
    return this.nodes[0]
  }

  pay (config, args, cb) {
    this.getNode(config).pay(args, cb)
  }

  getInfo (config, args, cb) {
    this.getNode(config).getInfo(args, cb)
  }

  getInvoice (config, args, cb) {
    this.getNode(config).getInvoice(args, cb)
  }

  getPayment (config, args, cb) {
    this.getNode(config).getPayment(args, cb)
  }

  getSettledPayment (config, args, cb) {
    this.getNode(config).getSettledPayment(args, cb)
  }

  subscribeToInvoices (config) {
    return this.getNode(config).subscribeToInvoices()
  }

  subscribeToPaidInvoices (config) {
    return this.getNode(config).subscribeToPaidInvoices()
  }

  subscribeToPayments (config) {
    return this.getNode(config).subscribeToPayments()
  }

  subscribeToForwards (config) {
    return this.getNode(config).subscribeToForwards()
  }

  subscribeToTopology (config) {
    return this.getNode(config).subscribeToTopology()
  }

  getNetworkGraph (config, args, cb) {
    return this.getNode(config).getNetworkGraph(args, cb)
  }

  listChannels (config, args, cb) {
    return this.getNode(config).listChannels(args, cb)
  }

  listPeers (config, args, cb) {
    return this.getNode(config).listPeers(args, cb)
  }

  listClosedChannels (config, args, cb) {
    return this.getNode(config).listClosedChannels(args, cb)
  }

  getChannel (config, args, cb) {
    return this.getNode(config).getChannel(args, cb)
  }

  openChannel (config, args, cb) {
    return this.getNode(config).openChannel(args, cb)
  }

  addPeer (config, args, cb) {
    return this.getNode(config).addPeer(args, cb)
  }
}

module.exports = LightningManager
