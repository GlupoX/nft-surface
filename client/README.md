# NFT Surface - client application

The frontend is built with next.js and is deployable on [Vercel](https://vercel.com/) (recommended), [Netflify](https://www.netlify.com/), etc. 

It can also be run locally using Hardhat, which is highly recommended to familiarise yourself with the project end-to-end.

You will obviously need to design/style the front page, which is provided here only as an example. 

## Local deployment

First deploy the smart contract and prepare a catalog (see [smart-contract](/smart-contract) README). Then, in the `client` directory:
```
npm install
```
Do the configuration (see below), then
```
npm run dev
```

## Configuration

You will need to amend `client/.env`. (Note that this file dose NOT contain secrets, unlike `smart-contract/.env`). 

```
# The appropriate catalog file, depending on which network the contract is deployed to
catalogFilename = 'catalog_chainid_4.json'

# Directory containing the catalog file.
# Either relative to client/public, or a remote URL path to a directory, eg. 'http://example.com/catalog'
catalogBase = '/catalog'

# Blockchain RPC provider key, depending on which network the contract is deployed to.
# (Note that this is only used when Metamask is unavailable in the user's browser.)
# IMPORTANT! See below wrt restricting access
networkKey = 'https://eth-rinkeby.alchemyapi.io/v2/JZzxf4....'

# Values for display only in the client app 
creatorName     = 'FLOX'
siteTitle       = 'FLOX NFT Catalog'
siteDescription = 'Artworks by FLOX for minting, trading or linking to secondary open NFT marketplaces'
twitterHandle   = '@stephanfowler'

```

IMPORTANT! The `networkKey` property contains an API key that will be visible in the client. You should configure your blockchain RPC provider (eg. Alchemy) to restrict access to requests _from_ your client's domain and/or _to_ your contract's address.

If your images are hosted on an seperate domain to that on which your client is deployed, you must whitelist that domain as an image source in in `next.config.js`: 
```
module.exports = {
    env: {
      ...
    },
    images: {
      domains: ['myimages.com'],
    },
  }
  ```

## Status

The client app has been tested against Ethereum testnet (Rinkeby), Polygn testnet (Mumbai), Arbitrum testnet (Rinkeby).
