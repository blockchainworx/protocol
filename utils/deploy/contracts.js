import Api from "@parity/api";
import {deployContract} from "../lib/contracts";

const fs = require("fs");
const pkgInfo = require("../../package.json");
const environmentConfig = require("../config/environment.js");
const tokenInfo = require("../info/tokenInfo.js");

// TODO: make clearer the separation between deployments in different environments
async function deploy(environment) {
  try {
    let addressBook;
    let mlnAddr;
    let ethTokenAddress;
    let mlnToken;
    let eurToken;
    let ethToken;
    let pricefeed;
    let fund;
    let governance;
    let compliance;
    let riskMgmt;
    let simpleAdapter;
    let centralizedAdapter;
    let simpleMarket;
    let version;
    let ranking;
    const pricefeedOnly = false;
    const addressBookFile = "./addressBook.json";
    const config = environmentConfig[environment];
    const provider = new Api.Provider.Http(
      `http://${config.host}:${config.port}`,
    );
    const api = new Api(provider);

    const mockBytes = "0x86b5eed81db5f691c36cc83eb58cb5205bd2090bf3763a19f0c5bf2f074dd84b";
    const mockAddress = "0x083c41ea13af6c2d5aaddf6e73142eb9a7b00183";
    const yearInSeconds = 60 * 60 * 24 * 365;
    if (
      Number(config.networkId) !== Number(await api.net.version()) &&
      config.networkId !== "*"
    ) {
      throw new Error(`Deployment for environment ${environment} not defined`);
    }
    const accounts = await api.eth.accounts();
    const opts = {
      from: accounts[0],
      gas: config.gas,
      gasPrice: config.gasPrice,
    };

    if (environment === "kovan") {
      mlnAddr = `0x${tokenInfo[environment].find(t => t.symbol === "MLN-T").address}`;
      ethTokenAddress = `0x${tokenInfo[environment].find(t => t.symbol === "ETH-T").address}`;

      pricefeed = await deployContract("pricefeeds/PriceFeed",
        opts, [
        mlnAddr,
        'Melon Token',
        'MLN-T',
        18,
        'melonport.com',
        mockBytes,
        mockBytes,
        mockAddress,
        mockAddress,
        config.protocol.pricefeed.interval,
        config.protocol.pricefeed.validity,
      ]);

      // simpleMarket = await deployContract("exchange/thirdparty/SimpleMarket", opts);
      simpleMarket = '0x7B1a19E7C84036503a177a456CF1C13e0239Fc02';
      console.log(`Using already-deployed SimpleMarket at ${simpleMarket}\n`);

      compliance = await deployContract("compliance/NoCompliance", opts);
      riskMgmt = await deployContract("riskmgmt/RMMakeOrders", opts);
      governance = await deployContract("system/Governance", opts, [[accounts[0]], 1, yearInSeconds]);
      simpleAdapter = await deployContract("exchange/adapter/simpleAdapter", opts);
      centralizedAdapter = await deployContract("exchange/adapter/CentralizedAdapter", opts);
      version = await deployContract("version/Version", Object.assign(opts, {gas: 6900000}), [pkgInfo.version, governance.address, ethTokenAddress], () => {}, true);
      ranking = await deployContract("FundRanking", opts, [version.address]);

      // add Version to Governance tracking
      await governance.instance.proposeVersion.postTransaction({from: accounts[0]}, [version.address]);
      await governance.instance.approveVersion.postTransaction({from: accounts[0]}, [version.address]);
      await governance.instance.triggerVersion.postTransaction({from: accounts[0]}, [version.address]);


      // register assets
      await Promise.all(
        config.protocol.registrar.assetsToRegister.map(async (assetSymbol) => {
          console.log(`Registering ${assetSymbol}`);
          const [tokenEntry] = tokenInfo[environment].filter(entry => entry.symbol === assetSymbol);
          await pricefeed.instance.register
            .postTransaction(opts, [
              `0x${tokenEntry.address}`,
              tokenEntry.name,
              tokenEntry.symbol,
              tokenEntry.decimals,
              tokenEntry.url,
              mockBytes,
              mockBytes,
              mockAddress,
              mockAddress,
            ]);
          console.log(`Registered ${assetSymbol}`);
        })
      );

      // update address book
      if (fs.existsSync(addressBookFile)) {
        addressBook = JSON.parse(fs.readFileSync(addressBookFile));
      } else addressBook = {};

      addressBook[environment] = {
        PriceFeed: pricefeed.address,
        SimpleMarket: simpleMarket.address,
        NoCompliance: compliance.address,
        RMMakeOrders: riskMgmt.address,
        Governance: governance.address,
        simpleAdapter: simpleAdapter.address,
        Version: version.address,
        Ranking: ranking.address
      };
    } else if (environment === "live") {
      mlnAddr = `0x${tokenInfo[environment].find(t => t.symbol === "MLN").address}`;
      ethTokenAddress = `0x${tokenInfo[environment].find(t => t.symbol === "OW-ETH").address}`;

      if (pricefeedOnly) {
        pricefeed = await deployContract("pricefeeds/PriceFeed", opts, [
            mlnAddr,
            'Melon Token',
            'MLN',
            18,
            'melonport.com',
            mockBytes,
            mockBytes,
            mockAddress,
            mockAddress,
            config.protocol.pricefeed.interval,
            config.protocol.pricefeed.validity,
          ]);

        await Promise.all(
          config.protocol.registrar.assetsToRegister.map(async (assetSymbol) => {
            console.log(`Registering ${assetSymbol}`);
            const [tokenEntry] = tokenInfo[environment].filter(entry => entry.symbol === assetSymbol);
            await pricefeed.instance.register
              .postTransaction({from: accounts[0], gas: 6000000}, [
                `0x${tokenEntry.address}`,
                tokenEntry.name,
                tokenEntry.symbol,
                tokenEntry.decimals,
                tokenEntry.url,
                mockBytes,
                mockBytes,
                mockAddress,
                mockAddress,
              ])
              .then(() => console.log(`Registered ${assetSymbol}`));
          })
        );

        // update address book
        if (fs.existsSync(addressBookFile)) {
          addressBook = JSON.parse(fs.readFileSync(addressBookFile));
        } else addressBook = {};

        addressBook[environment] = {
          PriceFeed: pricefeed.address,
        };
      } else if (!pricefeedOnly) {
        compliance = await deployContract("compliance/NoCompliance", opts);
        riskMgmt = await deployContract("riskmgmt/RMMakeOrders", opts);
        simpleAdapter = await deployContract("exchange/adapter/simpleAdapter", opts);

        // TODO: move this to config
        const authorityAddress = '0x00b5d2D3DB5CBAb9c2eb3ED3642A0c289008425B';
        governance = await deployContract("system/Governance", opts, [
          [authorityAddress],
          1,
          yearInSeconds
        ]);

        version = await deployContract("version/Version", Object.assign(opts, {gas: 6700000}), [pkgInfo.version, governance.address, ethTokenAddress], () => {}, true);

        // add Version to Governance tracking
        await governance.instance.proposeVersion.postTransaction({from: authorityAddress}, [version.address]);
        await governance.instance.approveVersion.postTransaction({from: authorityAddress}, [version.address]);
        await governance.instance.triggerVersion.postTransaction({from: authorityAddress}, [version.address]);

        // TODO: cleaner way to write to address book
        // update address book
        if (fs.existsSync(addressBookFile)) {
          addressBook = JSON.parse(fs.readFileSync(addressBookFile));
        } else addressBook = {};

        addressBook[environment] = {
          NoCompliance: compliance.address,
          RMMakeOrders: riskMgmt.address,
          simpleAdapter: simpleAdapter.address,
          governance: governance.address,
          version: version.address,
        };
      }
    } else if (environment === "development") {
      ethToken = await deployContract("assets/PreminedAsset", opts);
      console.log("Deployed ether token");
      mlnToken = await deployContract("assets/PreminedAsset", opts);
      console.log("Deployed melon token");
      eurToken = await deployContract("assets/PreminedAsset", opts);
      console.log("Deployed euro token");

      pricefeed = await deployContract("pricefeeds/PriceFeed", opts, [
        mlnToken.address,
        'Melon Token',
        'MLN-T',
        18,
        'melonport.com',
        mockBytes,
        mockBytes,
        mockAddress,
        mockAddress,
        config.protocol.pricefeed.interval,
        config.protocol.pricefeed.validity,
      ]);

      simpleMarket = await deployContract("exchange/thirdparty/SimpleMarket", opts);
      compliance = await deployContract("compliance/NoCompliance", opts);
      riskMgmt = await deployContract("riskmgmt/RMMakeOrders", opts);
      governance = await deployContract("system/Governance", opts, [[accounts[0]], 1, 100000]);
      simpleAdapter = await deployContract("exchange/adapter/simpleAdapter", opts);
      centralizedAdapter = await deployContract("exchange/adapter/CentralizedAdapter", opts);
      version = await deployContract("version/Version", Object.assign(opts, {gas: 6900000}), [pkgInfo.version, governance.address, ethToken.address], () => {}, true);

      // add Version to Governance tracking
      await governance.instance.proposeVersion.postTransaction({from: accounts[0]}, [version.address]);
      await governance.instance.approveVersion.postTransaction({from: accounts[0]}, [version.address]);
      await governance.instance.triggerVersion.postTransaction({from: accounts[0]}, [version.address]);
      console.log('Version added to Governance');

      // TODO: is fund deployed this way actually used?
      // deploy fund to test with
      fund = await deployContract("Fund", Object.assign(opts, {gas: 6900000}),
        [
          accounts[0],
          "Melon Portfolio",
          mlnToken.address, // base asset
          0, // management reward
          0, // performance reward
          ethToken.address, // Native Asset
          compliance.address,
          riskMgmt.address,
          pricefeed.address,
          [simpleMarket.address],
          [simpleAdapter.address]
        ],
        () => {},
        true
      );

      // register assets
      await pricefeed.instance.register.postTransaction({}, [
        ethToken.address,
        "Ether token",
        "ETH-T",
        18,
        "ethereum.org",
        mockBytes,
        mockBytes,
        mockAddress,
        mockAddress,
      ]);
      await pricefeed.instance.register.postTransaction({}, [
        eurToken.address,
        "Euro token",
        "EUR-T",
        18,
        "europa.eu",
        mockBytes,
        mockBytes,
        mockAddress,
        mockAddress,
      ]);
      await pricefeed.instance.register.postTransaction({}, [
        mlnToken.address,
        "Melon token",
        "MLN-T",
        18,
        "melonport.com",
        mockBytes,
        mockBytes,
        mockAddress,
        mockAddress,
      ]);
      console.log("Done registration");

      // update address book
      if (fs.existsSync(addressBookFile)) {
        addressBook = JSON.parse(fs.readFileSync(addressBookFile));
      } else addressBook = {};

      addressBook[environment] = {
        PriceFeed: pricefeed.address,
        SimpleMarket: simpleMarket.address,
        NoCompliance: compliance.address,
        RMMakeOrders: riskMgmt.address,
        Governance: governance.address,
        simpleAdapter: simpleAdapter.address,
        centralizedAdapter: centralizedAdapter.address,
        Version: version.address,
        MlnToken: mlnToken.address,
        EurToken: eurToken.address,
        EthToken: ethToken.address,
        Fund: fund.address,
      };
    }

    // write out addressBook
    console.log(`Writing addresses to ${addressBookFile}`);
    fs.writeFileSync(
      addressBookFile,
      JSON.stringify(addressBook, null, "\t"),
      "utf8",
    );

    if (require.main === module) {
      process.exit();
    }
  } catch (err) {
    console.log(err.stack);
  }
}

if (require.main === module) {
  if (process.argv.length < 2) {
    throw new Error(`Please specify a deployment environment`);
  } else {
    deploy(process.argv[2]);
  }
}

export default deploy;
