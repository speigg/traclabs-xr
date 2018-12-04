import App from './app'
import SnubberDemoA from './demos/SnubberDemoA'

const app = window['app'] = new App

app.startXR().catch((e)=>{
    console.error(e)
    alert(e)
})

const snubberDemoA = window['snubberDemo'] = new SnubberDemoA(app)