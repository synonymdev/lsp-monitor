'use strict'
const config = require('../config/config.json')
const NodeMan = require('./Lightning/NodeMan')
const Log = require('./Log')

const log = new Log()

function start () {
  const ln = new NodeMan({ nodes: config.ln_nodes })
  ln.start(() => {
    console.log('Started monitoring nodes')

    const paid = ln.subscribeToPaidInvoices()

    paid.on('invoice_paid', (data) => {
      log.info('paid_invoice', {
        id: data.id,
        amount: data.tokens,
        invoice: data.invoice
      })
    })

    paid.on('end', () => {
      log.critical('lnd', 'Node Down')
    })

    setInterval(() => {
      ln.getOnChainBalance({}, {}, (err, data) => {
        if (err) {
          console.log(err)
          log.error('lnd', 'Failed to get balance')
          return
        }
        if (data <= config.monitor.min_onchain_balance) {
          log.info('wallet', 'LND balance is too low')
        }
      })
    }, 300000) // 5 minutes
  })
}

start()
