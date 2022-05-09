
module.exports = (dexes) => {
  //
  // let pairs = []
  //
  //
  // for (let dex in dexes) {
  //   const pair = {
  //     name: 'BNB to BUSD, bakery>pancake',
  //     amountTokenPay: process.env.SPENDNING_AMOUNT,
  //     tokenPay: BNB_MAINNET,
  //     tokenSwap: BUSD_MAINNET,
  //     sourceRouter: addresses.bakery.router,
  //     targetRouter: addresses.pancake.router,
  //     sourceFactory: addresses.bakery.factory,
  //   }
  // }
  //
  // return pairs

  // Temp Fantom Params
  const NATIVE_TOKEN = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'; // wFTM
  const STABLE_TOKEN = '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75'; // USDC

  return [
    {
      name: 'FTM to USDC, dfyn>kyber',
      amountTokenPay: process.env.SPENDNING_AMOUNT,
      tokenPay: NATIVE_TOKEN,
      tokenPayDecimal: 1e18,
      tokenSwap: STABLE_TOKEN,
      sourceRouter: dexes.dfyn.router,
      targetRouter: dexes.kyber.router,
      sourceFactory: dexes.dfyn.factory,
    },
    {
      name: 'FTM to USDC, kyber>sushi',
      amountTokenPay: process.env.SPENDNING_AMOUNT,
      tokenPay: NATIVE_TOKEN,
      tokenPayDecimal: 1e18,
      tokenSwap: STABLE_TOKEN,
      sourceRouter: dexes.kyber.router,
      targetRouter: dexes.sushi.router,
      sourceFactory: dexes.kyber.factory,
    },
    {
      name: 'FTM to USDC, sushi>empire',
      amountTokenPay: process.env.SPENDNING_AMOUNT,
      tokenPay: NATIVE_TOKEN,
      tokenPayDecimal: 1e18,
      tokenSwap: STABLE_TOKEN,
      sourceRouter: dexes.sushi.router,
      targetRouter: dexes.empire.router,
      sourceFactory: dexes.sushi.factory,
    },
    {
      name: 'FTM to USDC, empire>elk',
      amountTokenPay: process.env.SPENDNING_AMOUNT,
      tokenPay: NATIVE_TOKEN,
      tokenPayDecimal: 1e18,
      tokenSwap: STABLE_TOKEN,
      sourceRouter: dexes.empire.router,
      targetRouter: dexes.elk.router,
      sourceFactory: dexes.empire.factory,
    },
    {
      name: 'FTM to USDC, jet>kyber',
      amountTokenPay: process.env.SPENDNING_AMOUNT,
      tokenPay: NATIVE_TOKEN,
      tokenPayDecimal: 1e18,
      tokenSwap: STABLE_TOKEN,
      sourceRouter: dexes.jet.router,
      targetRouter: dexes.kyber.router,
      sourceFactory: dexes.jet.factory,
    },
    {
      name: 'FTM to USDC, kyber>jet',
      amountTokenPay: process.env.SPENDNING_AMOUNT,
      tokenPay: NATIVE_TOKEN,
      tokenPayDecimal: 1e18,
      tokenSwap: STABLE_TOKEN,
      sourceRouter: dexes.kyber.router,
      targetRouter: dexes.jet.router,
      sourceFactory: dexes.kyber.factory,
    }
  ]
}
