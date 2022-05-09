require('dotenv').config();
const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const { performance } = require('perf_hooks');

const Flashswap_ABI = require('../artifacts/contracts/Flashswap.sol/Flashswap.json');
const BlockSubscriber = require('./block_subscriber');
const TransactionSender = require('./transaction_send');

const fs = require('fs');
const util = require('util');
const request = require('async-request');

module.exports = (FLASHSWAP_CONTRACT, pairs) => {

  var log_file = fs.createWriteStream(__dirname + '/log_arbitrage.txt', { flags: 'w' });
  var log_stdout = process.stdout;
  console.log = function (d) {
      log_file.write(util.format(d) + '\n');
      log_stdout.write(util.format(d) + '\n');
  };


  const web3 = new Web3(
      new Web3.providers.WebsocketProvider(process.env.WSS_BLOCKS, {
          reconnect: {
              auto: true,
              delay: 5000, // ms
              maxAttempts: 15,
              onTimeout: false
          }
      })
  );

  const { address: admin } = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY);

  const prices = {};
  const getPrices = async () => {
      const response = await request('https://api.coingecko.com/api/v3/simple/price?ids=fantom,usd-coin&vs_currencies=usd');

      const prices = {};

      try {
          const json = JSON.parse(response.body);
          prices['0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'.toLowerCase()] = json.fantom.usd;
          prices['0x04068da6c83afcfa0e13ba15a6696662335d5b75'.toLowerCase()] = json['usd-coin'].usd;
          // prices['??'.toLowerCase()] = json['usd-coin'].usd;
      } catch (e) {
          console.error(e)
          return {};
      }
      console.log(`Price FTM ${prices['0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'.toLowerCase()]}`);
      console.log(`Price USDC ${prices['0x04068da6c83afcfa0e13ba15a6696662335d5b75'.toLowerCase()]}`);
      return prices;
  }

  const flashswap = new web3.eth.Contract(Flashswap_ABI.abi, FLASHSWAP_CONTRACT);

  const init = async () => {
      console.log('starting: ', JSON.stringify(pairs.map(p => p.name)));

      const transactionSender = TransactionSender.factory(process.env.WSS_BLOCKS.split(','));

      let nonce = await web3.eth.getTransactionCount(admin);
      let gasPrice = await web3.eth.getGasPrice();

      setInterval(async () => {
          nonce = await web3.eth.getTransactionCount(admin);
      }, 1000 * 19);

      setInterval(async () => {
          gasPrice = await web3.eth.getGasPrice()
      }, 1000 * 60 * 3);

      const owner = await flashswap.methods.owner().call();

      console.log(`started: wallet ${admin} - gasPrice ${gasPrice} - contract owner: ${owner}`);

      let handler = async () => {
          const myPrices = await getPrices();
          if (Object.keys(myPrices).length > 0) {
              for (const [key, value] of Object.entries(myPrices)) {
                  prices[key.toLowerCase()] = value;
              }
          }
      };

      await handler();
      setInterval(handler, 1000 * 60 * 5);

      const onBlock = async (block, web3, provider) => {
          const start = performance.now();

          const calls = [];

          const flashswap = new web3.eth.Contract(Flashswap_ABI.abi, FLASHSWAP_CONTRACT);

          pairs.forEach((pair) => {
            // console.log(pair);
              calls.push(async () => {
                  try {
                    const check = await flashswap.methods.check(pair.tokenSwap, new BigNumber(pair.amountTokenPay * pair.tokenPayDecimal), pair.tokenPay, pair.sourceRouter, pair.targetRouter).call();

                    const profit = check[0];

                    let s = pair.tokenPay.toLowerCase();
                    const price = prices[s];
                    if (!price) {
                      console.log('invalid price', pair.tokenPay);
                      return;
                    }
                  } catch (e) {
                    console.log(`Contract error: ${e}`);
                  }

                  const profitUsd = profit / pair.tokenPayDecimal * price;
                  const percentage = (100 * (profit / pair.tokenPayDecimal)) / pair.amountTokenPay;
                  console.log(`[${block.number}] [${new Date().toLocaleString()}]: [${provider}] [${pair.name}] Arbitrage checked! Expected profit: ${(profit / pair.tokenPayDecimal).toFixed(3)} $${profitUsd.toFixed(2)} - ${percentage.toFixed(2)}%`);

                  if (profit > 0) {
                      console.log(`[${block.number}] [${new Date().toLocaleString()}]: [${provider}] [${pair.name}] Arbitrage opportunity found! Expected profit: ${(profit / pair.tokenPayDecimal).toFixed(3)} $${profitUsd.toFixed(2)} - ${percentage.toFixed(2)}%`);

                      const tx = flashswap.methods.start(
                          block.number + 2,
                          pair.tokenSwap,
                          new BigNumber(pair.amountTokenPay * pair.tokenPayDecimal),
                          pair.tokenPay,
                          pair.sourceRouter,
                          pair.targetRouter,
                          pair.sourceFactory,
                      );

                      let estimateGas
                      try {
                          estimateGas = await tx.estimateGas({from: admin});
                      } catch (e) {
                          console.log(`[${block.number}] [${new Date().toLocaleString()}]: [${pair.name}]`, 'gasCost error', e.message);
                          return;
                      }

                      const myGasPrice = new BigNumber(gasPrice).plus(gasPrice * 0.2212).toString();
                      const txCostBNB = Web3.utils.toBN(estimateGas) * Web3.utils.toBN(myGasPrice);

                      let gasCostUsd = (txCostBNB / pair.tokenPayDecimal) * prices[BNB_MAINNET.toLowerCase()];
                      const profitMinusFeeInUsd = profitUsd - gasCostUsd;

                      if (profitMinusFeeInUsd < 0.6) {
                          console.log(`[${block.number}] [${new Date().toLocaleString()}] [${provider}]: [${pair.name}] stopped: `, JSON.stringify({
                              profit: "$" + profitMinusFeeInUsd.toFixed(2),
                              profitWithoutGasCost: "$" + profitUsd.toFixed(2),
                              gasCost: "$" + gasCostUsd.toFixed(2),
                              duration: `${(performance.now() - start).toFixed(2)} ms`,
                              provider: provider,
                              myGasPrice: myGasPrice.toString(),
                              txCostBNB: txCostBNB / pair.tokenPayDecimal,
                              estimateGas: estimateGas,
                          }));
                      }

                      if (profitMinusFeeInUsd > 0.6) {
                          console.log(`[${block.number}] [${new Date().toLocaleString()}] [${provider}]: [${pair.name}] and go: `, JSON.stringify({
                              profit: "$" + profitMinusFeeInUsd.toFixed(2),
                              profitWithoutGasCost: "$" + profitUsd.toFixed(2),
                              gasCost: "$" + gasCostUsd.toFixed(2),
                              duration: `${(performance.now() - start).toFixed(2)} ms`,
                              provider: provider,
                          }));

                          const data = tx.encodeABI();
                          const txData = {
                              from: admin,
                              to: flashswap.options.address,
                              data: data,
                              gas: estimateGas,
                              gasPrice: new BigNumber(myGasPrice),
                              nonce: nonce
                          };

                          let number = performance.now() - start;
                          if (number > 1500) {
                              console.error('out of time window: ', number);
                              return;
                          }

                          console.log(`[${block.number}] [${new Date().toLocaleString()}] [${provider}]: sending transactions...`, JSON.stringify(txData))

                          try {
                              await transactionSender.sendTransaction(txData);
                          } catch (e) {
                              console.error('transaction error', e);
                          }
                      }
                  }
              })
          })

          try {
              await Promise.all(calls.map(fn => fn()));
          } catch (e) {
              console.log('error', e)
          }

          let number = performance.now() - start;
          if (number > 1500) {
              console.error('warning to slow', number);
          }

          if (block.number % 40 === 0) {
              console.log(`[${block.number}] [${new Date().toLocaleString()}]: alive (${provider}) - took ${number.toFixed(2)} ms`);
          }
      };

      BlockSubscriber.subscribe(process.env.WSS_BLOCKS.split(','), onBlock);
  }

  init();
}
