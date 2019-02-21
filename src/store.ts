import Vue from 'vue'
import PRIDEClient from './lib/PRIDEClient'
// import Vuex from 'vuex';


export default {
  debug: true,
  state: {
    message: 'Hello!',
  },
  setMessageAction(newValue: any) {
    if (this.debug) { console.log('setMessageAction triggered with', newValue); }
    this.state.message = newValue;
  },
  clearMessageAction() {
    if (this.debug) { console.log('clearMessageAction triggered'); }
    this.state.message = '';
  },
};
