## Attention: This is highly under development! Don't use it productively!
# Luiq
> Flashloan Smartcontract with Arbitrage Trading Node

## Prepare

Install Deps

```shell
yarn
```

change the variables for `.env`

```shell
cp .env.example .env
```

## Compile and deploy

To compile and deploy the Smart Contract Hardhat is used

```shell
yarn compile
```

Recently the Repo is prepared for Fantom Network. You can find the addresses in `./addresses`

## Deploy and Execute

```shell
yarn deploy:fantom
```

Copy and paste the Smart Contract Address into the `./scripts/trade.js` first paramter of the function. 
