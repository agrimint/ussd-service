'use strict'

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

const DbService = require('../mixins/db.mixin')
const ENUMS = require('../enums')
const bcrypt = require('bcrypt')
// eslint-disable-next-line max-len
const { MoleculerClientError } = require('moleculer').Errors
const axios = require("axios");

module.exports = {
  name: 'users',

  /**
  * Settings
  */
  settings: {
    fields: {
      name: { type: 'string', nullable: true, optional: true },
      phoneNumber: { type: 'string', nullable: false },
      countryCode: { type: 'string', nullable: false },
      accessToken: { type: 'string', nullable: true },
      state: {
        type: 'enum',
        values: Object.values(ENUMS.userStates),
        nullable: true,
        optional: true
      },
      ussdState: {
        type: 'enum',
        values: Object.values(ENUMS.ussdStates),
        nullable: true,
        optional: true
      },
      ussdSession: { type: 'sring', nullable: true, optional: true },
      federations: {
        type: 'array', 
        items: 'string'
      }
    }
  },
  mixins: [
    DbService('ussd-users'),
  ],


  /**
  * Dependencies
  */
  dependencies: [],

  /**
  * Actions
  */
  actions: {
    /**
     * Register Lender
     */
    activate: {
      params: {
        user: 'object',
        secret: 'string'
      },
      async handler(ctx) {
        const { user, secret } = Object.assign({}, ctx.params)
        const { phoneNumber, countryCode } = user
        const response = await this.registerUser(phoneNumber, countryCode, secret)
        if (response.status !== 201) {
          throw new MoleculerClientError('Bad request', response.status)
        }
        return await this.actions.login({ user, secret })
      },
    },

    login: {
      params: {
        user: 'object',
        secret: 'string',
      },
      async handler(ctx) {
        const { user, secret } = Object.assign({}, ctx.params)
        const { phoneNumber, countryCode } = user
        const { accessToken } = await this.getToken(phoneNumber, countryCode, secret)
        user.accessToken = accessToken
        return await this.actions.update({ id: user._id, ...user })
      }
    },

    joinFederation: {
      params: {
        user: 'object',
        invitationCode: 'string',
      },
      async handler(ctx) {
        const { user, invitationCode } = Object.assign({}, ctx.params)
        const {federationId} = await this.joinFederation(user, invitationCode)
        user.federations = user.federations.push(federationId)
        return await this.actions.update({ id: user._id, ...user })
      }
    },

    getFederations: {
      params: {
        user: 'object'
      },
      async handler(ctx) {
        const { user } = Object.assign({}, ctx.params)
        const federationsResponse = await this.getFederations(user)
        const response =  federationsResponse.map(f => {
          return `name: ${f.name} - id: ${f.id}`
        })
        return response
      }
    },

    getBalance: {
      params: {
        user: 'object',
        federationId: 'string'
      },
      async handler(ctx) {
        const { user, federationId } = Object.assign({}, ctx.params)
        const balance = await this.getBalance(user, federationId)
        return balance
      }
    }


  },
  hooks: {
  },


  /**
  * Events
  */
  // events: {

  // },

  // /**
  //  * Methods
  //  */

  methods: {

    async registerUser(phoneNumber, countryCode, secret) {

      const response = await axios.post(`${process.env.USER_API}/user`, {
        phoneNumber,
        countryCode,
        secret,
        name: `ussd-${phoneNumber}`
      }, {
        headers: {
          channel: 'USSD'
        }
      })
      return response
    },

    async getToken(phoneNumber, countryCode, secret) {
      const response = await axios.post(`${process.env.USER_API}/user/login`, {
        phoneNumber,
        countryCode,
        secret,
      })
      return response.data
    },

    async joinFederation(user, invitationCode) {
      const response = await axios.post(`${process.env.USER_API}/member?invitationCode=${invitationCode}`, {
        name: `USSD-${user.phoneNumber}`
      }, {
        headers: {
          Authorization: `Bearer ${user.accessToken}`
        }
      })
      return response.data
    },

    async getFederations(user) {
      const response = await axios.get(`${process.env.USER_API}/federations`, {
        headers: {
          Authorization: `Bearer ${user.accessToken}`
        }
      })
      return response.data
    },

    async getBalance(user, federationId) {
      const response = await axios.get(`${process.env.USER_API}/wallet/federation/${federationId}/balance`, {
        headers: {
          Authorization: `Bearer ${user.accessToken}`
        }
      })
      return response.data
    }

  }

}
