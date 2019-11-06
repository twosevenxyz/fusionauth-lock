import axios from 'axios'
import LoginComponent from './login-component/src/components/LoginComponent.vue'
import { tabs as LoginTabs } from './login-component/src/js/constants'

import Vue from 'vue'
import Emittery from 'emittery'

Vue.component('LoginComponent', LoginComponent)

// const errors = {
//   email_verification: 'Your email has not been verified. Please verify your email before attempting to log in.',
//   bad_request: 'The login request was malformed. Please contact the website admins.',
//   bad_credentails: 'Invalid username or password'
// }

class FusionAuth {
  constructor (clientId, domain, opts = {}, mount = document.body) {
    const self = this

    const { loginUri, storage = {} } = opts
    const { prefix = 'generic-login', tokens = 'tokens', profile = 'profile' } = storage
    this.tokensKey = `${prefix}:${tokens}`
    this.profileKey = `${prefix}:${profile}`

    this.loginUri = loginUri

    // Emittery for events
    const emitter = new Emittery()
    const emitterAPI = ['on', 'off', 'once', 'onAny', 'emit', 'emitSerial']
    emitterAPI.forEach((api) => {
      this[api] = emitter[api].bind(emitter)
    })

    // Create the div under which the lock is going to live
    const el = document.createElement('div')
    el.id = '__fusionauth-login__'
    el.innerHTML = '<div id="__fusionauth__"></div>'
    this.el = el
    mount.appendChild(el)
    // Regardless of what the constructor tells us, we set show to false

    this.opts = opts
    const control = {
      show: false,
      error: '',
      info: ''
    }
    this.control = control
    this.vue = new Vue({
      data: {
        control
      },
      methods: {
        onShowChange (isShowing) {
          this.control.show = isShowing
          this.$emit('modal-event', isShowing)
        },
        async onSubmit (data) {
          this.control.error = ''
          this.control.info = ''
          const { currentTab, username, password, forgotEmail } = data
          try {
            switch (currentTab) {
              case LoginTabs.LOGIN:
                await self.login(username, password)
                // Close the modal
                this.control.show = false
                break
              case LoginTabs.SIGNUP:
                await self.register(username, password)
                break
              case LoginTabs.FORGOT_PASSWORD:
                await self.forgotPassword(forgotEmail)
                break
            }
          } catch (e) {
            this.control.error = e.message
          } finally {
            this.control.isSubmitting = false
          }
        },
        async onSocialLogin (data) {
          if (data.error) {
            this.control.error = data.error
            return
          }
          await self.socialLogin(data)
          this.control.show = false
        }
      },
      render (h) {
        return h(LoginComponent, {
          props: {
            ...opts,
            ...control
          },
          ref: 'login',
          on: {
            'update:show': this.onShowChange,
            submit: this.onSubmit,
            'social-login': this.onSocialLogin
          }

        })
      }
    }).$mount(mount.querySelector('#__fusionauth__'))
    this.vue.$on('modal-event', function (isShowing) { this.emit('modal-event', isShowing) }.bind(this))
  }

  open () {
    const { tokensKey, profileKey } = this

    this.control.error = ''
    this.control.info = ''
    this.control.initialized = false
    this.control.show = true

    // Check cookies
    const userStr = localStorage.getItem(profileKey)
    try {
      const user = JSON.parse(userStr)
      this.control.loggedInId = user
      // TODO: Add logic for tokensKey handling?
    } catch (e) {
    }
    this.control.initialized = true
  }

  close () {
    this.control.show = false
  }

  async login (username, password) {
    const { loginUri } = this
    try {
      const response = await axios.post(`${loginUri}/login`, {
        username,
        password,
        scope: this.opts.auth.scope
      })
      const { data } = response
      const { access_token: accessToken, id_token: idToken, refresh_token: refreshToken } = data
      const result = {
        token: accessToken,
        idToken,
        refreshToken
      }
      this.emit('authenticated', result)
    } catch (e) {
      if (e.response) {
        throw new Error(e.response.data)
      } else {
        throw e
      }
    }
  }

  async socialLogin (data) {
    const { provider, access_token: accessToken, id_token: idToken } = data
    const { loginUri } = this
    const providerClientId = this.opts.social.providers[provider].clientId
    const finalToken = idToken || accessToken

    try {
      let device
      if (this.opts.auth.scope.includes('offline_access')) {
        // We need to get a refresh token
        // To do so, we need to add the 'device' parameter
        device = this.opts.auth.device
      }
      const response = await axios.post(`${loginUri}/social-login`, {
        provider,
        token: finalToken,
        clientId: providerClientId,
        device
      })
      const { data: loginData } = response
      const { token, refreshToken } = loginData
      const result = {
        token,
        refreshToken
      }
      this.emit('authenticated', result)
    } catch (e) {
      throw new Error(e.response.data)
    }
  }

  async register (email, password) {
    const { loginUri } = this
    try {
      const response = await axios.post(`${loginUri}/register`, {
        email,
        password
      })
      this.control.info = response.data
      this.vue.$refs.login.currentTab = LoginTabs.LOGIN
    } catch (e) {
      this.control.error = e.response.data
    }
  }

  async forgotPassword (email) {
    const { loginUri } = this
    try {
      const response = await axios.post(`${loginUri}/forgot-password`, {
        email
      })
      this.control.info = response.data
      this.vue.$refs.login.currentTab = LoginTabs.LOGIN
    } catch (e) {
      this.control.error = e.response.data
    }
  }
}

export default FusionAuth
