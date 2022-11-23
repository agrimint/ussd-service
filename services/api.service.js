
const ApiGateway = require('moleculer-web')
// const ENUMS = require('../middlewares/enums')

module.exports = {
  name: 'agrimint-ussd-api',
  mixins: [ApiGateway],
  settings: {
    port: 3333,
    server: true,
    bodyParsers: {
      json: true,
      urlencoded: { extended: true }
    },
    routes: [{
      path: '/',
      whitelist: [
        'ussd.menu',
        'ussd.sendSMS'

        // TODO add update user
      ],
      aliases: {
        'POST ussd': 'ussd.menu',
        "POST sms": "ussd.sendSMS"
      },
      bodyParsers: {
        json: true,
        urlencoded: { extended: true }
      },
    }]
  }
}
