module.exports = {
    chainWebpack: config => {
        config.plugin('html').tap(args => {
            args[0].hash = true
            return args
        })
    },
    devServer: {
        disableHostCheck: true
    }
}