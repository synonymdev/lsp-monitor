'use strict'
const config = require('../config/config.json')
const { default: axios } = require('axios')

const level = [
  'emergency',
  'alert',
  'critical',
  'error',
  'warning',
  'notice',
  'info',
  'debug'
]

const emoji = [
  '🆘',
  '🚨',
  '‼️',
  '❌',
  '⚠️',
  '📢',
  'ℹ️',
  ''
]

const alertLevel = [level[0], level[1], level[2]]

const slackField = (lvl, tag, msg) => {
  const emj = emoji[level.indexOf(lvl)]
  const alert = alertLevel.includes(lvl) ? '@here' : ''
  const txt = '```' + msg + '```'
  return {
    type: 'mrkdwn',
    text: `${alert}${emj} ${lvl}: *${tag}*\n${txt}`
  }
}

class Log {
  constructor () {
    this.batch = []
    level.forEach((k) => {
      this[k] = this._send.bind(this, k)
    })
    this.is_running = false

    setInterval(() => {
      this.sendToSlack()
    }, 3000)
  }

  _send (level, tag, desc) {
    this.batch.push([
      level,
      tag,
      desc
    ])

    if (this.batch.length === 5) {
      this.batch.splice(0, 1)
    }
  }

  resetBatch () {
    this.is_running = false
    this.batch = []
  }

  async sendToSlack () {
    if (this.is_running) return
    this.is_running = true
    const blocks = this.batch.map(([lvl, tag, desc]) => {
      return {
        type: 'section',
        fields: [slackField(lvl, tag, desc)]
      }
    })

    if (blocks.length === 0) return this.resetBatch()
    try {
      await axios({
        url: config.slack.url,
        method: 'POST',
        data: { blocks: blocks },
        headers: {
          'Content-type': 'application/json'
        }
      })
    } catch (err) {
      console.log(err)
      throw err
    }
    this.resetBatch()
  }
}

module.exports = Log
