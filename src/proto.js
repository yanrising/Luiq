require('dotenv').config();
const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const { performance } = require('perf_hooks');

const Flashswap = require('./build/contracts/Flashswap.json');
const BlockSubscriber = require('./block_subscriber');
const TransactionSender = require('./transaction_send');

const fs = require('fs');
const util = require('util');
const request = require('async-request');

class Luiq {

  logger;

  web3;
  admin;
  contract;
  dexes;

  prices;

  constructor({ CONTRACT, DEXES, LOG_PATH, PRIVATE_KEY, WSS_BLOCKS }) {

    this.dexes = DEXES

    let log_file = fs.createWriteStream(__dirname + LOG_PATH || '/log.txt', { flags: 'w' });
    let log_stdout = process.stdout;
    this.logger = (d) => {
        log_file.write(util.format(d) + '\n');
        log_stdout.write(util.format(d) + '\n');
    };

    this.web3 = new Web3(
        new Web3.providers.WebsocketProvider(WSS_BLOCKS, {
            reconnect: {
                auto: true,
                delay: 5000, // ms
                maxAttempts: 15,
                onTimeout: false
            }
        })
    );

    const { address: admin } = this.web3.eth.accounts.wallet.add(PRIVATE_KEY);
    this.admin = admin;

    this.contract = new this.web3.eth.Contract(
        Flashswap.abi,
        CONTRACT
    );

  };

  async init() {
    this.logger('starting: ', JSON.stringify(this.dexes.map(p => p.name)));

    const transactionSender = TransactionSender.factory(WSS_BLOCKS.split(','));

    let nonce = await this.web3.eth.getTransactionCount(this.admin);
    let gasPrice = await this.web3.eth.getGasPrice();

    setInterval(async () => {
        nonce = await this.web3.eth.getTransactionCount(this.admin);
    }, 1000 * 19);

    setInterval(async () => {
        gasPrice = await this.web3.eth.getGasPrice()
    }, 1000 * 60 * 3);

    const owner = await this.contract.methods.owner().call();
    this.logger(`started: wallet ${admin} - gasPrice ${gasPrice} - contract owner: ${owner}`);

    await this.handler(); // get prices from CoinGecko
    setInterval(this.handler, 1000 * 60 * 5);

    BlockSubscriber.subscribe(WSS_BLOCKS.split(','), this.onBlock);
  };

  async onBlock(block, web3, provider) {
    const start = performance.now();
    const calls = [];

    this.dexes.forEach((pair) => {
      calls.push(async () => {
        // pair.tokenPayDecimal is a decimal for amoutTokenPay, you will need to change it based on currency
        const check = await this.contract.methods.check(pair.tokenPay, pair.tokenSwap, new BigNumber(pair.amountTokenPay * pair.tokenPayDecimal), pair.sourceRouter, pair.targetRouter).call();

        const profit = check[0];

        let s = pair.tokenPay.toLowerCase();
        const price = prices[s];
        if (!price) {
          this.logger('invalid price', pair.tokenPay);
          return;
        }

        const profitUsd = profit / pair.tokenPayDecimal * price;
        const percentage = (100 * (profit / pair.tokenPayDecimal)) / pair.amountTokenPay;
        this.logger(`[${block.number}] [${new Date().toLocaleString()}]: [${provider}] [${pair.name}] Arbitrage checked! Expected profit: ${(profit / pair.tokenPayDecimal).toFixed(3)} $${profitUsd.toFixed(2)} - ${percentage.toFixed(2)}%`);

        if (profit > 0) {
          this.logger(`[${block.number}] [${new Date().toLocaleString()}]: [${provider}] [${pair.name}] Arbitrage opportunity found! Expected profit: ${(profit / pair.tokenPayDecimal).toFixed(3)} $${profitUsd.toFixed(2)} - ${percentage.toFixed(2)}%`);

          const tx = this.contract.methods.startArbitrage(
            block.number + process.env.BLOCKNUMBER,
            pair.tokenPay,
            pair.tokenSwap,
            new BigNumber(pair.amountTokenPay * pair.tokenPayDecimal),
            pair.sourceRouter,
            pair.targetRouter,
            pair.sourceFactory,
          );

          let estimateGas
          try {
            estimateGas = await tx.estimateGas({ from: this.admin });
          } catch (e) {
            this.logger(`[${block.number}] [${new Date().toLocaleString()}]: [${pair.name}]`, 'gasCost error', e.message);
            return;
          }

          const myGasPrice = new BigNumber(gasPrice).plus(gasPrice * 0.2212).toString();
          const txCostBNB = Web3.utils.toBN(estimateGas) * Web3.utils.toBN(myGasPrice);

          // calculate the estimated gas cost in USD
          let gasCostUsd = (txCostBNB / pair.tokenPayDecimal) * prices[BNB_MAINNET.toLowerCase()];
          const profitMinusFeeInUsd = profitUsd - gasCostUsd;

          if (profitMinusFeeInUsd < 0.6) {
            this.logger(`[${block.number}] [${new Date().toLocaleString()}] [${provider}]: [${pair.name}] stopped: `, JSON.stringify({
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
            this.logger(`[${block.number}] [${new Date().toLocaleString()}] [${provider}]: [${pair.name}] and go: `, JSON.stringify({
              profit: "$" + profitMinusFeeInUsd.toFixed(2),
              profitWithoutGasCost: "$" + profitUsd.toFixed(2),
              gasCost: "$" + gasCostUsd.toFixed(2),
              duration: `${(performance.now() - start).toFixed(2)} ms`,
              provider: provider,
            }));

            const data = tx.encodeABI();
            const txData = {
              from: admin,
              to: this.contract.options.address,
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

            this.logger(`[${block.number}] [${new Date().toLocaleString()}] [${provider}]: sending transactions...`, JSON.stringify(txData))

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
      this.logger('error', e)
    }

    let number = performance.now() - start;
    if (number > 1500) {
      console.error('warning to slow', number);
    }

    if (block.number % 40 === 0) {
      this.logger(`[${block.number}] [${new Date().toLocaleString()}]: alive (${provider}) - took ${number.toFixed(2)} ms`);
    }
  }

  async handler() {
    const myPrices = await this.getPrices();
    if (Object.keys(myPrices).length > 0) {
      for (const [key, value] of Object.entries(myPrices)) {
        this.prices[key.toLowerCase()] = value;
      }
    }
  };

  async getPrices() {
    const response = await request('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,ethereum,bitcoin,tether,usd-coin,busd&vs_currencies=usd');

    try {
      const json = JSON.parse(response.body);
      this.prices['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'.toLowerCase()] = json.binancecoin.usd;
      this.prices['0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'.toLowerCase()] = json.busd.usd;
      this.prices['0x2170Ed0880ac9A755fd29B2688956BD959F933F8'.toLowerCase()] = json.ethereum.usd;
      this.prices['0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'.toLowerCase()] = json.bitcoin.usd;
      this.prices['0x55d398326f99059ff775485246999027b3197955'.toLowerCase()] = json.tether.usd;
      // prices['??'.toLowerCase()] = json['usd-coin'].usd;
    } catch (e) {
      console.error(e)
      return {};
    }
  }
};

exports.module = Luiq
