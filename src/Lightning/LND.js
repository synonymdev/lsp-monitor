
const { readFileSync } = require('fs')
const { EventEmitter } = require('events')
const { createHash, randomBytes } = require('crypto')
const lns = require('ln-service')
const async = require('async')
const _ = require('lodash')

const toB64 = (path) => readFileSync(path, { encoding: 'base64' })
const dateKeys = ['confirmed_at', 'created_at', 'expires_at']
const randomSecret = () => randomBytes(32)
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')

const MAX_LN_TX_FEE = 1000

class LND {
  constructor (config) {
    this.config = config
    const { lnd } = lns.authenticatedLndGrpc({
      cert: toB64(config.cert),
      macaroon: toB64(config.macaroon),
      socket: config.socket
    })
    this.lnd = lnd
  }

  callLND (method, args, cb) {
    if (this[method]) {
      return this[method](args, cb)
    }
    return this._lnd(method, args, cb)
  }

  _lnd (method, args, cb) {
    const params = _.extend({ lnd: this.lnd }, args)
    return lns[method](params, cb)
  }

  getFeeRate (args, cb) {
    this.callLND('getChainFeeRate', {}, (err, data) => {
      if (err) return cb(err)
      cb(null, data.tokens_per_vbyte)
    })
  }

  getOnChainBalance (args, cb) {
    this.callLND('getChainBalance', {}, (err, data) => {
      if (err) return cb(err)
      cb(null, data.chain_balance)
    })
  }

  getInvoices (args, cb) {
    const dt = dateKeys
    lns.getInvoices({ lnd: this.lnd }, (err, data) => {
      if (err) return cb(err, data)
      data.invoices = data.invoices.map((invoice) => {
        dt.forEach((k) => {
          invoice[k] = invoice[k] ? new Date(invoice[k]).getTime() : invoice[k]
        })
        return invoice
      })
      cb(null, data)
    })
  }

  cancelInvoice (args, cb) {
    this._lnd('cancelHodlInvoice', { id: args.id }, cb)
  }

  createInvoice ({ memo, amount, expiry, expirySeconds }, cb) {
    this._lnd('createInvoice', {
      description: memo,
      tokens: amount,
      expires_at: new Date(expiry).toISOString(),
      expiry_seconds: expirySeconds
    }, (err, data) => {
      if (err) {
        console.log('FAILED TO CREATE PAY REQ:')
        console.error(err)
        return cb(err)
      }
      cb(null, data)
    })
  }

  createHodlInvoice ({ memo, amount, expiry, expirySeconds }, cb) {
    const secret = randomSecret()
    const id = sha256(secret)
    this._lnd('createHodlInvoice', {
      id,
      description: memo,
      tokens: amount,
      expires_at: new Date(expiry).toISOString(),
      expiry_seconds: expirySeconds
    }, (err, data) => {
      if (err) {
        console.log('FAILED TO CREATE PAY REQ:')
        console.error(err)
        return cb(err)
      }
      data.secret = secret.toString('hex')
      cb(null, data)
    })
  }

  settleHodlInvoice ({ secret }, cb) {
    this._lnd('settleHodlInvoice', { secret }, cb)
  }

  getInfo (cb) {
    this._lnd('getWalletInfo', {}, (err, data) => {
      if (err) return cb(err)
      cb(null, data)
    })
  }

  getInvoice (args, cb) {
    const dt = dateKeys
    this._lnd('getInvoice', { id: args.id }, (err, data) => {
      if (err) return cb(err, data)
      dt.forEach((k) => {
        data[k] = data[k] ? new Date(data[k]).getTime() : data[k]
      })
      cb(null, data)
    })
  }

  subscribeToInvoices () {
    const event = new EventEmitter()
    const sub = lns.subscribeToInvoices({ lnd: this.lnd })

    sub.on('invoice_updated', (invoice) => {
      // invoice.confirmed_at = invoice.confirmed_at ? +new Date(invoice.confirmed_at) : null
      console.log(invoice)
      event.emit('invoice_updated', invoice)
    })
    sub.on('end', (err) => {
      event.emit('end', err)
    })
    sub.on('error', (err) => {
      console.log('Connectin to LND threw error ')
      console.log(err)
      event.emit('end', err)
    })

    return event
  }

  subscribeToPayments () {
    const event = new EventEmitter()
    const sub = lns.subscribeToPastPayment({ lnd: this.lnd })

    sub.on('confirmed', (payment) => {
      payment.confirmed_at = Date.now()
      event.emit('payment_confirmed', payment)
    })
    sub.on('failed', (payment) => {
      event.emit('payment_failed', payment)
    })
    sub.on('end', (err) => {
      event.emit('end', err)
    })
    sub.on('error', (err) => {
      console.log('Connectin to LND threw error ')
      console.log(err)
      event.emit('end', err)
    })

    return event
  }

  subscribeToPaidInvoices () {
    const ev = this.subscribeToInvoices()
    const event = new EventEmitter()
    ev.on('invoice_updated', (invoice) => {
      if (invoice.is_confirmed === true) {
        event.emit('invoice_paid', invoice)
      }
    })
    ev.on('end', (err) => {
      event.emit('end', err)
    })
    return ev
  }

  subscribeToGraph () {
    const event = new EventEmitter()
    const sub = lns.subscribeToGraph({ lnd: this.lnd })
    sub.on('channel_updated', (data) => {
      event.emit('channel_updated', data)
    })
    sub.on('channel_closed', (data) => {
      event.emit('channel_closed', data)
    })
    sub.on('node_updated', (data) => {
      event.emit('node_updated', data)
    })
    return event
  }

  subscribeToForwards () {
    const event = new EventEmitter()
    const sub = lns.subscribeToForwards({ lnd: this.lnd })

    sub.on('forward', (data) => {
      event.emit('forward', data)
    })
    sub.on('error', (data) => {
      event.emit('close', data)
    })
    return event
  }

  decodePaymentRequest (args, cb) {
    this._lnd('decodePaymentRequest', { request: args.request }, (err, decoded) => {
      if (err) return cb(err, decoded)
      dateKeys.forEach((k) => {
        decoded[k] = decoded[k] ? new Date(decoded[k]).getTime() : decoded[k]
      })
      cb(null, decoded)
    })
  }

  getPayment (id, cb) {
    this._lnd('getPayment', { id }, (err, data) => {
      if (err) {
        if (err[0] === 404 && err[1] === 'SentPaymentNotFound') {
          return cb(null)
        }
        return cb(err)
      }
      cb(err, data)
    })
  }

  getNetworkGraph (args, cb) {
    this._lnd('getNetworkGraph', { }, cb)
  }

  listChannels (args, cb) {
    this._lnd('getChannels', { }, (err, data) => {
      if (err) return cb(err)
      cb(null, data ? data.channels : [])
    })
  }

  listPeers (args, cb) {
    this._lnd('getPeers', { }, (err, data) => {
      if (err) return cb(err)
      cb(null, data ? data.peers : [])
    })
  }

  listClosedChannels (args, cb) {
    this._lnd('getClosedChannels', { }, (err, data) => {
      if (err) return cb(err)
      cb(null, data ? data.channels : [])
    })
  }

  getChannel (args, cb) {
    this._lnd('getChannel', args, cb)
  }

  addPeer (args, cb) {
    this._lnd('addPeer', args, (err,data)=>{
      console.log(err,data)
    })
  }

  getSettledPayment (id, cb) {
    this._lnd('getPayment', { id }, (err, data) => {
      if (err) return cb(err)
      if (data.is_failed) return cb(null)
      if (data.is_pending) return cb(null)
      if (data.is_confirmed) return cb(null, data)
      return cb(null)
    })
  }

  pay (invoice, cb) {
    async.auto({
      // Attempt to pay to pay request
      pay: (next) => {
        this._lnd('payViaPaymentRequest', { request: invoice, max_fee: MAX_LN_TX_FEE }, (err, data) => {
          if (err) {
            return next(err)
          }
          // if the secret is valid and it has made hops
          if (data.secret) {
            return next(null, data)
          }
          console.log('Retrying payment: ', invoice)
          next(new Error('Try Payment Again: ' + data))
        })
      },
      // Double check that the payment is confirmed
      paymentData: ['pay', ({ pay }, next) => {
        this.getPayment(pay.id, (err, data) => {
          if (err) {
            return next(err)
          }

          if (!data.is_confirmed && data.is_failed === true) {
            return next(new Error('Payment has failed'))
          }
          return next(null, data)
        })
      }]
    }, (err, data) => {
      if (err) {
        return cb(err)
      }
      cb(null, data.paymentData)
    })
  }

  openChannel (args, cb) {
    this._lnd('openChannel', {
      local_tokens: args.local_amt,
      give_tokens: args.remote_amt,
      partner_public_key: args.remote_pub_key
    }, cb)
  }
}

module.exports = LND
