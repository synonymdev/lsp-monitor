'use strict'
const config = require('../config/config.json')
const { default: axios } = require('axios')

const level = [
  'emergency',
  'alert',
  'critical',
  'error',
  'warning',
  'botice',
  'info',
  'debug'
]

const alertLevel = [level[0], level[1], level[2]]

const slackField = (title, txt) => {
  return {
    type: 'mrkdwn',
    text: `*${title}*\n${txt}`
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
      Date.now(),
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
    const blocks = this.batch.map(([level, ts, tag, desc]) => {
      const alert = alertLevel.includes(level) ? '@here 🚨' : ''
      return {
        type: 'section',
        fields: [
          slackField('Timestamp', ts),
          slackField('Level', `${alert}${level}`),
          slackField('Tag', tag),
          slackField('Message', desc)
        ]
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