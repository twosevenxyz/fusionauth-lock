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

    const { loginUri, storage = window.localStorage, keys = {} } = opts
    const { prefix = 'generic-login', tokens = 'tokens', profile = 'profile', lastLogin = 'last-login' } = keys
    this.tokensKey = `${prefix}:${tokens}`
    this.profileKey = `${prefix}:${profile}`
    this.lastLoginCredentialsKey = `${prefix}:${lastLogin}`

    this.storage = storage
    this.loginUri = loginUri

    new Emittery().bindMethods(this)

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
      info: '',
      isSubmitting: false,
      loggedInId: undefined,
      initialized: false
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
        async commonSubmit (data, executor) {
          this.control.error = ''
          this.control.info = ''
          this.control.isSubmitting = true
          try {
            await new Promise(resolve => {
              setTimeout(resolve, 300)
            })
            await executor(data)
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
            login: data => this.commonSubmit(data, self.login.bind(self)),
            signup: data => this.commonSubmit(data, self.register.bind(self)),
            'forgot-password': data => this.commonSubmit(data, self.forgotPassword.bind(self)),
            'social-login': this.onSocialLogin,
            'last-login-login': self.lastLoginLogin.bind(self)
          }

        })
      }
    }).$mount(mount.querySelector('#__fusionauth__'))
    this.vue.$on('modal-event', function (isShowing) { this.emit('modal-event', isShowing) }.bind(this))
  }

  async open () {
    const { lastLoginCredentialsKey, loginUri, storage, control } = this

    control.error = ''
    control.info = ''
    control.initialized = false
    control.show = true

    // Check lastLoginCredentials
    if (!this.control.loggedInId) {
      try {
        const lastLoginCredentialsStr = storage.getItem(lastLoginCredentialsKey)
        const lastLoginCredentials = JSON.parse(lastLoginCredentialsStr)
        const { type, provider, data } = lastLoginCredentials
        const response = await axios.get(`${loginUri}/last-login-info`, {
          params: {
            lastLoginCredentials: data
          }
        })
        const { data: { username } } = response
        this.control.loggedInId = {
          email: username,
          type,
          provider
        }
      } catch (e) {
      }
    }
    control.initialized = true
  }

  close () {
    this.control.show = false
  }

  async login ({ username, password, lastLoginCredentials }) {
    const { loginUri, storage } = this
    try {
      const response = await axios.post(`${loginUri}/login`, {
        username,
        password,
        lastLoginCredentials,
        scope: this.opts.auth.scope
      })
      const { data } = response
      const { lastLoginCredentials: newLastLoginCredentials } = data
      storage.setItem(this.lastLoginCredentialsKey, JSON.stringify(newLastLoginCredentials))
      this.emit('authenticated', data)
      this.close()
    } catch (e) {
      if (e.response) {
        throw new Error(e.response.data)
      } else {
        throw e
      }
    }
  }

  async socialLogin ({ provider, access_token: accessToken, id_token: idToken, lastLoginCredentials }) {
    const { loginUri, lastLoginCredentialsKey, storage } = this
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
        device,
        lastLoginCredentials
      })
      const { data } = response
      const { lastLoginCredentials: newLastLoginCredentials } = data
      storage.setItem(lastLoginCredentialsKey, JSON.stringify(newLastLoginCredentials))
      this.emit('authenticated', data)
      this.close()
    } catch (e) {
      throw new Error(e.response.data)
    }
  }

  async lastLoginLogin () {
    const { storage, lastLoginCredentialsKey } = this
    const lastLoginCredentialsStr = storage.getItem(lastLoginCredentialsKey)
    const lastLoginCredentials = JSON.parse(lastLoginCredentialsStr)
    const { type, provider, data } = lastLoginCredentials
    switch (type) {
      case 'email':
        return this.login({ lastLoginCredentials: data })
      case 'social':
        return this.socialLogin({ provider, lastLoginCredentials: data })
    }
  }

  async register ({ username, password }) {
    const { loginUri } = this
    try {
      const response = await axios.post(`${loginUri}/register`, {
        email: username,
        password
      })
      this.control.info = response.data
      this.vue.$refs.login.currentTab = LoginTabs.LOGIN
    } catch (e) {
      this.control.error = e.response.data
    }
  }

  async forgotPassword ({ username }) {
    const { loginUri } = this
    try {
      const response = await axios.post(`${loginUri}/forgot-password`, {
        email: username
      })
      this.control.info = response.data
      this.vue.$refs.login.currentTab = LoginTabs.LOGIN
    } catch (e) {
      this.control.error = e.response.data
    }
  }

  async logout () {
    const { storage, lastLoginCredentialsKey } = this
    storage.removeItem(lastLoginCredentialsKey)
    this.control.loggedInId = undefined
  }
}

export default FusionAuth
