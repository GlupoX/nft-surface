# NFT Surface - smart contract & NFT catalog

Everything relating to the smart contract and the NFT catalog is in the `smart-contract` folder/sub-project, is built on Hardhat and ethers.js, and uses Alchemy for blockchain access and Pinata for IPFS storage (though could be modified to use other services, eg Infura). A distinct client app sub-project lives in the `client` folder. 

## Installation
Clone this repo, then:
```
cd smart-contract
npm install
npx hardhat test
```

## Environment variables

The Hardhat project expects the below `.env` file in the `smart-contract` folder.

IMPORTANT!!! The `.env` file will contain secrets and MUST be referenced in `.gitignore`

```
# Private key of the Creator. This conceptually encompasses the contract deployer, contract owner, catalog signer, and ideally the artist themselves; these roles are inseparable to ensure maximum confidence in NFTs' provenance. The private key must have the 0x prefix.
CREATOR_PRIVATE_KEY = 0x...

# Public address of the Creator. This is added to the catalog and all metadata files on IPFS. 
CREATOR_ADDRESS = 0x...

# BLOCKCHAIN API URLs
# For Ethereum Rinkeby deployments
RINKEBY_API_URL = ...
# For Ethereum Mainnet deployments
MAINNET_API_URL = ...
# For Polygon Mumbai deployments
MUMBAI_API_URL = ...
# For Arbitrum Rinkeby deployments
ARB_RINKEBY_API_URL = ...

# For verifying contracts on Etherscan for Ethereum/Polygon/etc mainnets and testnets
ETHERSCAN_API_KEY = ...

# For NFT metadata and image uploads to IPFS:
PINATA_API_KEY = ...
PINATA_API_SECRET = ...
```

### Contract constructor arguments

The contract's constructor arguments should be specified in the `deployment_args.js` file. For example:

```
module.exports = [
    "Testy McTestface",  // ERC721 token name 
    "TESTY",             // ERC721 token symbol
    "50000000000000000", // Base price in wei, for lazy-minting. Can be modified later. 
    "495"                // Royalty basis points, 495 mean 4.95%. IMMUTABLE - cannot be modified later!
];
```

## Tasks

The following additional Hardhat tasks are provided by the project:

 * __deploy__ : Deploys the contract and runs a signature test against it
 * __catalog__ : Processes the NFT catalog file (generate lay-mint signatures, do IPFS uploads, process images)
 * __sign__ : Generates a signature, for special-case lazy minting

For specific task usage, do `npx hardhat help <the task name>`

## Deployment

The deployment command (for example to the Rinkeby testnet) is: 
```
npx hardhat deploy --network rinkeby --args ./delpoyment_args.js
```

## Etherscan contract verification 

Contract verification on the Etherscan family of blockchain explorers uses hardhat-etherscan which expects the property `ETHERSCAN_API_KEY` in the `.env` file in the case of both Etherscan and Polygonscan. These are however distinct APIs so require distinct values.

```
npx hardhat verify --network rinkeby --constructor-args delpoyment_args.js <DEPLOYED_CONTRACT_ADDRESS>
```

## Catalog management

### Catalog file

The NFT catalog is defined in a json file, located by default in `client/public/catalog` (you may specify a different absolute location using the `catalogdir` argument to the `catalog` task - see below).

You'll need distinct json catalog files _for each network_ that you deploy to (eg. localhost, a testnet such as Rinkeby, Mainnet). Distinct files are necessary because they contain signatures ([in EIP712 form](https://eips.ethereum.org/EIPS/eip-712)) that take the chain ID and contract address as inputs, to prevent cross-chain or cross-contract exploits.

Catalog filenames are differentiated by the integer [chain ID](https://besu.hyperledger.org/en/stable/Concepts/NetworkID-And-ChainID/) of the relevant network. The filenames must follow this form:
```
catalog_chainid_<chainid of the network>.json
```
For example, `catalog_chainid_1.json` for Mainnet, `catalog_chainid_4.json` for Rinkeby, etc. Note that the Hardhat local network has a chainId of 31337. 

### Catalog file format

The catalog file has this structure:

```
{
    "NFTs": [],    // add NFT spec here
    "context": {}  // auto populated by the catalog task
}
```

To the `NFTs` array, manually add the basic spec for each NFT in the default order you want them displayed. Each NFT should follow this example (and these should obviously be comma-separated):
```
{
    "tokenId": 10,
    "sourceImage": "images/my_image_10.jpg",
    "metadata": {
        "name": "Don't Deceive Yourself",
        "description": "My Painfully Cliched Artwork",
        "external_url": "https://exmple.com/nft/10"
    }
}
```
IMPORTANT: you must specify unique integer `tokenId` values. The value itself has no meaning, at least in the project logic. The `catalog` task will help you by disallowing tokenId duplicates within the json file, `tokenId` omissions or non-integer values, an will not add a signature if the `tokenId` is already minted.

All `sourceImage` paths must be relative to catalog folder (which is by default `client/public/catalog`). A simple practice is to put all images in `client/public/catalog/images`.

Other properties may be added to parent or `metadata` property (e.g. `date`, `collection`, ...) for the purpose of rendering, additional provenance assertions, etc.

### Catalog task

The `catalog` task will add lazy-mint signatures, manage IPFS metadata and image uploads, and run image measurement and optimisation. The initial manually-entered data is annotated in-place with various new properties. Always run the task after adding or editing any NFT spec. Commiting catalog files to Git is recommended, given that the `catalog` irreversibly modifies the catalog files. 

Run the command like this:
```
npx hardhat catalog --network rinkeby --contract <DEPLOYED_CONTRACT_ADDRESS>  
```

The following properties will be added by the `catalog` task.

Added to the `metadata` property: 
* `image` - IPFS URI of the `sourceImage` file uploaded to IPFS by the task
* `width` - the pixel width of `sourceImage`
* `height` - the pixel height of `sourceImage`

Added to the root level of the NFT's catalog entry: 
* `tokenURI` - IPFS URI of the metadata file uploaded to IPFS by the task
* `signature` - a signature which enables lazy minting of the accompanying `tokenId` and `tokenURI` (using the contract's `mint` method)
* `webOptimizedImage` - smaller low quality version of `sourceImage` for web display
* `placeholderImage` - tiny placeholder version of `sourceImage` for lazy image loading

Example NFT definition after script is run:
```
{
    "tokenId": 603,
    "sourceImage": "images/my_image_10.jpg",
    "metadata": {
        "name": "Don't Deceive Yourself",
        "description": "My Painfully Cliched Artwork",
        "external_url": "https://exmple.com/nft/10",
        "image": "ipfs://QmSShS85tNiGQfY3G3mPW2Yv2w1w8wdDBSkXdG1...",
        "width": 1883,
        "height": 2368
    },
    "tokenURI": "ipfs://Qma5ysnKpCK1PtaVvGPNc6eCssbftpJzhGykavrF...",
    "signature": "0x255ad96c61585acb950f9f5014d4c9cd236fcaa1a1bd... ",
    "placeholderImage": "data:image/jpeg;base64,/9j/2wBDAAYEBQYF... ",
    "webOptimizedImage": "images/my_image_web.jpg"
}
```
The `catalog` task also adds the following context values to the catalog file, based on the arguments passed to the task and values read from the contract itself. This acts as configuration to the `client` app which will consume the catalog file:

```
"context": {
		"creatorAddress": "0x72dA9f5014dd71E445...",
		"contractAddress": "0x1211b3959f5014dE2...",
		"chainId": 4,
        "mintPrice": "50000000000000000",
        "royaltyBasisPoints": "495"
}
```

## Sign task

Generates a signature for the (lazy) `mint` contract method, and tests it against the deployed contract. Note that the `catalog` task itself uses the `sign` task to generate all the signatures in a particular catalog file. You will only need to use the `sign` task in special cases, for example to offer a "promo code" equivalent by signing a special mint price for a specific NFT.

```
# Enable free minting of an NFT with tokenId 123 and tokenURI ipfs://foo.bar/123 
npx hardhat sign --network rinkeby --price 0 --id 123 --uri ipfs://foo.bar/123 --contract <DEPLOYED_CONTRACT_ADDRESS>
```

## Status

The NFTsurface smart contact has extensive [test coverage](/smart-contract/test/tests.js)
