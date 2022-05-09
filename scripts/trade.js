const trade = require('../src');
const dex = require('../src/dex');
const { FANTOM } = require('../addresses');
//
// const luiq = new Luiq({
//   CONTRACT: '0x',
//   DEXES: dex(FANTOM),
//   PRIVATE_KEY: process.env.PRIVATE_KEY,
//   LOG_PATH: 'log.txt',
//   WSS_BLOCKS: ''
// })
//
// luiq.init()

trade('0xfC4f3A00DF000655B42c04Ce65B9Df34fd3b45E9', dex(FANTOM))
