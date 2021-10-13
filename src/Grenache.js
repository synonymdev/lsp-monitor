const Link = require('grenache-nodejs-link')
const { PeerRPCServer } = require('grenache-nodejs-http')
const Log = require('./Log')
const log = new Log()

function main (config = {}) {
  if (config.test_env) return false
  const link = new Link({
    grape: config.grape || 'http://127.0.0.1:30001'
  })
  link.start()

  const peer = new PeerRPCServer(link, {
    timeout: 300000
  })
  peer.init()

  const service = peer.transport('server')
  service.listen(7681 || 8999)
  setInterval(function () {
    link.announce('svc:monitor:slack', service.port, {})
  }, 1000)

  console.log('Listening to slack alerts')

  service.on('request', (x, y, payload, handler) => {
    const [level, tag, msg] = payload
    if (!level) {
      console.log(payload)
      return log.notice('invalid_msg', 'Invalid log received')
    }
    log[level](tag, msg || '')
  })
}
main()
