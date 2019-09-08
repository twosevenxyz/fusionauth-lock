import axios from 'axios'
import LoginComponent from './login-component/src/components/LoginComponent.vue'

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

    const { social = {}, loginUri, links = {} } = opts
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
    el.innerHTML = `<div id="__fusionauth__"></div>`
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
        theme: opts.theme,
        social,
        control,
        links
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
              case 0:
                await self.login(username, password)
                // Close the modal
                this.control.show = false
                break
              case 1:
                await self.register(username, password)
                break
              case 2:
                await self.forgotPassword(forgotEmail)
                break
            }
          } catch (e) {
            this.control.error = e.message
          } finally {
            this.$refs.login.isSubmitting = false
          }
        },
        async onSocialLogin (data) {
          await self.socialLogin(data)
          this.control.show = false
        }
      },
      render (h) {
        return h(LoginComponent, {
          props: {
            ...opts.theme,
            social,
            show: control.show,
            error: control.error,
            info: control.info,
            tos: links.tos,
            privacyPolicy: links.privacyPolicy
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
    this.control.error = ''
    this.control.info = ''
    this.control.show = true
  }
  close () {
    this.control.show = false
  }

  async login (username, password) {
    const { loginUri } = this
    try {
      const response = await axios.post(`${loginUri}/login`, {
        username,
        password
      })
      const { data } = response
      const { access_token: accessToken, id_token: idToken } = data
      const result = {
        token: accessToken
      }
      this.emit('authenticated', result)
    } catch (e) {
      throw new Error(e.response.data)
    }
  }

  async socialLogin (data) {
    if (data.error) {
      this.control.error = data.error
      return
    }

    let finalToken
    const { provider, access_token: accessToken, id_token: idToken } = data
    const { loginUri } = this
    const providerClientId = this.opts.social.providers[provider].clientId
    finalToken = idToken || accessToken

    try {
      const response = await axios.post(`${loginUri}/social-login`, {
        provider,
        token: finalToken,
        clientId: providerClientId
      })
      const { data: loginData } = response
      const { token } = loginData
      const result = {
        token
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
      this.vue.$refs.login.currentTab = 0
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
      this.vue.$refs.login.currentTab = 0
    } catch (e) {
      this.control.error = e.response.data
    }
  }
}

export default FusionAuth
