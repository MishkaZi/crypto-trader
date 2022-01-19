import dotenv from 'dotenv';
import ccxt from 'ccxt';
import axios from 'axios';
dotenv.config();

let sold = false;
let bought = false;

let marketPrice = 0;

const tick = async (config, binanceClient) => {
  const { asset, base, spread, allocation } = config;
  const market = `${asset}/${base}`;

  // Cancel open orders left from previou tick, if any
  const orders = await binanceClient.fetchOpenOrders(market);
  orders.forEach(async (order) => {
    await binanceClient.cancelOrder(order.id, 'ONE/USDT');
  });

  // Fetch current market prices
  const results = await Promise.all([
    axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=harmony&vs_currencies=usd'
    ),
    axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd'
    ),
  ]);

  const currentMarketPrice =
    results[0].data.harmony.usd / results[1].data.tether.usd;

  if (marketPrice === 0) {
    marketPrice = currentMarketPrice;
  }

  //If there is less than 15$ of assets left, block sell option
  if (currentMarketPrice * assetBalance <= 15) {
    sold = true;
  }

  // Calculate new orders parameters
  const sellPrice = marketPrice * (1 + spread);
  const buyPrice = marketPrice * (1 - spread);
  const balances = await binanceClient.fetchBalance();
  const assetBalance = balances.free[asset];
  const baseBalance = balances.free[base];
  const sellVolume = assetBalance * allocation;
  const buyVolume = (baseBalance * allocation) / marketPrice;

  if (currentMarketPrice >= sellPrice && sold === false) {
    //Sell order
    try {
      //Sell limit
      await binanceClient.createLimitSellOrder(market, sellVolume, sellPrice);
      console.log(`
      New tick for sell ${market}...
      Created limit sell order for ${sellVolume.toFixed(
        3
      )} ONE coins for ${sellPrice.toFixed(3)} each  

   `);
    } catch (error) {
      console.log(error);
    }

    marketPrice = currentMarketPrice;
    bought = false;
    sold = true;
  }

  if (currentMarketPrice <= buyPrice && bought === false) {
    //Buy order
    try {
      //Buy order
      await binanceClient.createLimitBuyOrder(market, buyVolume, buyPrice);
      console.log(`
        New tick for buy ${market}...
        Created limit buy  order for ${buyVolume.toFixed(
          3
        )} ONE coins for ${buyPrice.toFixed(3)} each 
    `);
    } catch (error) {
      console.log(error);
    }

    marketPrice = currentMarketPrice;

    bought = true;
    sold = false;
  }

  console.log('Current market price: ' + currentMarketPrice.toFixed(3));
  console.log('Original market price: ' + marketPrice.toFixed(3));

  console.log('Asset balance: ' + assetBalance.toFixed(3));
  console.log('Base balance: ' + baseBalance.toFixed(3));

  console.log('Sell price: ' + sellPrice.toFixed(3));
  console.log('Buy price: ' + buyPrice.toFixed(3));
  console.log('-------------------------------------------------------');
};

const run = () => {
  const config = {
    asset: 'ONE',
    base: 'USDT',
    allocation: 1, // Percentage of our available funds that we trade
    spread: 0.1, // Percentage above and below market prices for sell and buy orders
    tickInterval: 10000, // Duration between each tick, in milliseconds
  };
  const binanceClient = new ccxt.binance({
    apiKey: process.env.API_KEY,
    secret: process.env.API_SECRET,
  });
  tick(config, binanceClient);
  setInterval(tick, config.tickInterval, config, binanceClient);
};

// run();
