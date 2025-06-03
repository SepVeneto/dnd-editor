module.exports = {
  "plugins": [
      require('postcss-selector-replace')({
        before: [':root'],
        after: [':host'],
        include: /node_modules\/element-plus/,
      })
    ]
}