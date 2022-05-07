const dex = require('src/dex');
const trade = require('src');
// const Luiq = require('src');
const { BSC } = require('../addresses')
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

trade('', dex(FANTOM))
