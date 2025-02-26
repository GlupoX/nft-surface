require('dotenv').config();
require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require("hardhat-gas-reporter");

const {
	CREATOR_ADDRESS,
	CREATOR_PRIVATE_KEY,
	RINKEBY_API_URL,
	//MUMBAI_API_URL,
	//ARB_RINKEBY_API_URL,
	ETHERSCAN_API_KEY,
	POLYGONSCAN_API_KEY,
	PINATA_API_KEY,
	PINATA_API_SECRET
} = process.env;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {},
		rinkeby: {
			url: RINKEBY_API_URL,
			accounts: [CREATOR_PRIVATE_KEY]
		},
		/*
		mumbai: {
			chainId: 80001, 
			url: MUMBAI_API_URL,
			accounts: [CREATOR_PRIVATE_KEY]
		},
		arbrinkeby: {
			chainId: 421611,
			url: ARB_RINKEBY_API_URL,
			accounts: [CREATOR_PRIVATE_KEY]
		}
		*/
	},
	etherscan: {
		apiKey: ETHERSCAN_API_KEY
	},
	polygonscan: {
		apiKey: POLYGONSCAN_API_KEY
	},
	solidity: {
		version: "0.8.2",
		settings: {
			optimizer: {
				enabled: true,
				runs: 20, // 20 seems optimal according to hardhat-gas-reporter
			}
		}
	}
};

/**
 * Summary. Deploy the smart contract
 * Description. Deploys the contract using constructor arguments defined by the specified module (and runs a signature test against it)
 * @example npx hardhat deploy --args ./delpoyment_args_localhost.js --network localhost 
 */
task("deploy", "Deploys the contract using constructor arguments in the specified file (and runs a signature test against the contract)")
	.addParam("args", "Relative path to the arguments module")
	.setAction(async (args, hre) => {
		await hre.run('compile');
		const deploymentArgs = require(args.args);
		const [deployer] = await ethers.getSigners();
		const NFTsurface = await ethers.getContractFactory('NFTsurface');
		const contract = await NFTsurface.deploy(...deploymentArgs);
		await contract.deployed();

		const contractAddress = contract.address;
		const { chainId } = await ethers.provider.getNetwork();
		const signature = await hre.run('sign', {
			id: 123,
			uri: "ipfs://foo.bar/123",
			code: "a freebie",
			contract: contractAddress,
			quiet: true
		});
		console.log('Contract deployed:')
		console.log({
			contractAddress,
			chainId,
			signatureTest: signature ? "succeeded" : "failed"
		});
	});


/**
 * Summary. Generates a signature
 * Description. Generates a signature for the 'mint' contract method, and tests it against the contract
 * @example npx hardhat sign --network localhost --id 123 --uri ipfs://foo.bar/123 --contract 0xe7f17...etc 
 */
task("sign", "Generates a signature for the 'mint' contract method, and tests it against the deployed contract")
	.addParam("contract", "The contract address", undefined, types.address)
	.addParam("id", "The intended tokenId of the NFT", undefined, types.int)
	.addParam("uri", "The intended tokenURI of the NFT", "", types.string)
	.addOptionalParam("price", "A specific wei price, can be 0", "", types.string)
	.addOptionalParam("quiet", "Suppress all output", false, types.boolean)
	.setAction(async (args) => {
		const tokenId = args.id;
		const tokenURI = args.uri;
		const contractAddress = args.contract;

		const MAX_INT256 = ethers.constants.MaxUint256;

		let price;
		if (args.price.length > 0) {
			price = ethers.BigNumber.from(args.price)
		} else {
			price = MAX_INT256;
		}

		if (!ethers.utils.isAddress(contractAddress)) {
			console.log("Error: invalid address value for contract")
			return;
		}

		const [defaultAcc] = await ethers.getSigners();
		const NFTsurface = await ethers.getContractFactory('NFTsurface');
		const contract = await NFTsurface.attach(contractAddress);
		const { chainId } = await ethers.provider.getNetwork();

		const signature = await defaultAcc._signTypedData(
			{
				name: 'NFTsurface',
				version: '1.0.0',
				chainId: chainId,
				verifyingContract: contractAddress,
			},
			{
				mint: [
					{ name: 'price', type: 'uint256' },
					{ name: 'tokenId', type: 'uint256' },
					{ name: 'tokenURI', type: 'string' }
				],
			},
			{ price, tokenId, tokenURI },
		);

		try {
			const isMintable = await contract.mintable(price, tokenId, tokenURI, signature);
			!args.quiet && console.log({
				tokenId,
				tokenURI,
				price: price.toString(),
				signature
			});
			return signature;

		} catch (e) {
			const kmownError = "signature invalid or signer unauthorized";
			if (e.message.includes(kmownError)) {
				!args.quiet && console.log(kmownError);
			} else {
				!args.quiet && console.log(e.message);
			}
			return false;
		}
	});


/**
 * Summary. Catalog preparation
 * Description. ...
 * @example npx hardhat catalog --network localhost --contract 0x5FbDB2315678afecb367f032d93F642f64180aa3
 */
task("catalog", "Given a json catalog file, automatically manages IPFS metadata and image uploads, lay-minting signatures, etc")
	.addParam("contract", "The contract address", undefined, types.address)
	.addOptionalParam("catalogdir", "Absolute path of local directory containing catalog and images. By default, the directory used is client/public/catalog ")
	.addOptionalParam("force", "Force a reprocess of all items, except image upload ", false, types.boolean)
	.addOptionalParam("forceimage", "Force a reprocess of all items, including image upload ", false, types.boolean)
	.setAction(async (args, hre) => {
		const contractAddress = args.contract;

		const catalogDirectory = args.catalogdir || __dirname + "/../client/public/catalog";

		const sharp = require("sharp");
		const _ = require('lodash');
		const fs = require('fs');

		const MAX_INT256 = ethers.constants.MaxUint256;

		const pinataSDK = require('@pinata/sdk');
		const pinata = pinataSDK(PINATA_API_KEY, PINATA_API_SECRET);
		const contractABI = require("./artifacts/contracts/NFTsurface.sol/NFTsurface.json");

		console.log("Connecting...");

		const [signer] = await ethers.getSigners();
		const contract = new ethers.Contract(contractAddress, contractABI.abi, signer)
		const { chainId, name } = await ethers.provider.getNetwork();

		// Confirm we have the right contract, and "agent" role
		try {
			await contract.deployed();
			console.log("Contract " + contractAddress + " found on network " + chainId + " (" + name + ")")
		} catch (e) {
			e.reason = e.reason || "";
			if (e.reason.includes("contract not deployed")) {
				console.log("Error: Contract " + contractAddress + " was NOT found on network " + chainId + " (" + name + ")")
			} else if (e.reason.includes("cannot estimate gas")) {
				console.log("Error: NOT behaving as expected. Wrong combination of contract + network?")
			} else {
				console.log(e);
			}
			return;
		}

		const catalogFilePath = catalogDirectory + "/catalog_chainid_" + chainId + ".json";
		const catalog = require(catalogFilePath);

		const tokenIds = _.map(catalog.NFTs, 'tokenId');

		const missingIds = _.includes(tokenIds, undefined);
		if (missingIds) {
			console.log("ERROR: some items are missing a tokenId.");
			console.log(tokenIds);
			return;
		}

		const duplicateIds = (_.filter(tokenIds, (val, i, iteratee) => _.includes(iteratee, val, i + 1)));
		if (duplicateIds.length) {
			console.log("ERROR: duplicates found for tokenIds: " + duplicateIds);
			console.log(tokenIds);
			return;
		};

		const nonIntegers = tokenIds.some(i => !Number.isInteger(i))
		if (nonIntegers) {
			console.log("ERROR: tokenIds must be integers");
			console.log(tokenIds);
			return;
		};

		const catalogUpdated = { NFTs: [] };
		let hasInvalidProperties = false;
		let failedSignatures = false;

		const idsNewlyMinted = [];
		const idsNewlyBurntOrRevoked = [];
		const idsUploadedImage = [];
		const idsUpdatedMetadata = [];
		const idsMintable = [];

		function checkValidProperties(nft) {
			// nb. tokenId is checked elsewhere
			const valid =
				nft.metadata &&
				nft.metadata.name &&
				nft.metadata.description &&
				nft.sourceImage
			return valid;
		}

		function pad(num, size) {
			var s = "000000000" + num;
			return s.substr(s.length - size);
		}

		async function processImage(filePath) {
			try {
				const sharpImg = sharp(filePath);
				const meta = await sharpImg.metadata();
				const width = meta.width;
				const height = meta.height
				const placeholderImgWidth = 10;
				const imgAspectRatio = width / height;
				const placeholderImgHeight = Math.round(placeholderImgWidth / imgAspectRatio);
				const blurredBase64 = await sharpImg
					.resize(placeholderImgWidth, placeholderImgHeight)
					.toBuffer()
					.then(
						buffer => `data:image/${meta.format};base64,${buffer.toString('base64')}`
					);
				const webOptimizedFilePath = filePath.replace(/\.[^/.]+$/, "") + "_web.jpg";
				const webOptimised = await sharpImg
					.resize(1200, 1200, {
						fit: sharp.fit.inside,
						withoutEnlargement: true
					})
					.toFormat('jpeg', { progressive: true, quality: 75 })
					.toFile(webOptimizedFilePath);

				return {
					width,
					height,
					blurredBase64,
					webOptimizedFilePath
				}
			} catch (error) {
				console.log(`Error during image processing: ${error}`);
			}
		}

		function randomHexStr(size) {
			return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
		}

		///////////////////////
		// Iterate over NFTs //
		///////////////////////

		for (const nft of catalog.NFTs) {

			const skip = nft.tokenURI && !args.force && !args.forceimage

			if (skip) {
				catalogUpdated.NFTs.push(nft)
			} else {
				const tokenId = nft.tokenId;
				let minted = false;
				let burnt = false;

				if (hasInvalidProperties) {
					return;
				} else if (!checkValidProperties(nft)) {
					console.log("Invalid props found for tokenId  " + tokenId);
					hasInvalidProperties = true;
					return;
				}

				// Fetch the tokenURI  
				const mintedTokenURI = await contract.tokenURI(tokenId);

				if (mintedTokenURI) {
					// we're already minted
					idsNewlyMinted.push(tokenId)
					nft.tokenURI = mintedTokenURI;
					delete nft.signature;
					minted = true;
				} else {
					try {
						// if this passes, we're neiter minted or burnt...
						await contract.vacant(tokenId);
					} catch (error) {
						// ah, we're burnt
						idsNewlyBurntOrRevoked.push(tokenId);
						delete nft.signature;
						burnt = true;
					}
				}

				if (minted || burnt) {
					console.log("Ignored " + tokenId + (minted ? " (minted)" : "") + (burnt ? " (burnt)" : ""))

				} else {
					// Make a meaningful filename for IPFS uploads
					const ipfsFilename = pad(tokenId, 6) + "_" + nft.metadata.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

					// If not done already, process the image (upload to IPFS, get dimensions, generate web optimised and placeholder images
					if (args.forceimage || !nft.metadata.image || !nft.metadata.width || !nft.metadata.height || !nft.placeholderImage || !nft.webOptimizedImage) {
						const imageFilePath = catalogDirectory + "/" + nft.sourceImage;
						const fileStream = fs.createReadStream(imageFilePath);
						pinnedImage = await pinata.pinFileToIPFS(fileStream, { pinataMetadata: { name: ipfsFilename } });
						nft.metadata.image = "ipfs://" + pinnedImage.IpfsHash;

						const imageData = await processImage(imageFilePath);
						nft.metadata.width = imageData.width;
						nft.metadata.height = imageData.height;
						nft.placeholderImage = imageData.blurredBase64;
						nft.webOptimizedImage = imageData.webOptimizedFilePath.replace(catalogDirectory + "/", "");

						idsUploadedImage.push(tokenId);
					}

					// (re)create the tokenURI by uploading metadata JSON to IPFS
					const ipfsMetadata = { ...nft.metadata };
					ipfsMetadata.creatorAddress = CREATOR_ADDRESS;
					ipfsMetadata.contractAddress = contractAddress;
					ipfsMetadata.tokenId = tokenId;
					pinnedMetadata = await pinata.pinJSONToIPFS(ipfsMetadata, { pinataMetadata: { name: ipfsFilename + ".json" } });
					const newTokenURI = "ipfs://" + pinnedMetadata.IpfsHash;
					const oldTokenURI = nft.tokenURI + "";
					if (newTokenURI !== oldTokenURI) {
						idsUpdatedMetadata.push(tokenId);
						nft.tokenURI = newTokenURI;
						if (oldTokenURI) {
							// remove old metadata from IPFS
							await pinata.unpin(nft.tokenURI.replace("ipfs://", ""));
						}
					}


					// Generate the signature
					const specificPrice = (nft.mintPrice || MAX_INT256).toString(); 
					const signature = await hre.run('sign', {
						price: specificPrice,
						id: tokenId,
						uri: nft.tokenURI,
						contract: contractAddress,
						quiet: true
					});

					// Test signature / mintableness 
					try {
						await contract.mintable(specificPrice, tokenId, nft.tokenURI, signature);
						nft.signature = signature;
						idsMintable.push(nft.tokenId);
						console.log("Updated " + tokenId + " (mintable)" );
					} catch (error) {
						failedSignatures = true;
						console.log("Errored " + tokenId + " ...signature invalid?")
					}
				}
				catalogUpdated.NFTs.push(nft)
			}
		}

		// Warn on duplicate tokenURIs. This may be accidental or intended (tho kinda weird)
		const tokenURIs = _.map(catalogUpdated.NFTs, 'tokenURI');
		const duplicateURIs = (_.filter(tokenURIs, (val, i, iteratee) => _.includes(iteratee, val, i + 1)));
		if (duplicateURIs.length) {
			console.log("WARNING: duplicate tokenURIs found for: ");
			console.log(duplicateURIs);
		};

		// Abort on failed signatures
		if (failedSignatures) {
			console.log("ERROR: sigatures failed for unknown reason. Check your .env values?");
			return;
		}

		// Get the min price, for info
		const baseMintPrice = (await contract.baseMintPrice()).toString();

		// Get the royalty rate, for info
		const royaltyBasisPoints = (await contract.royaltyBasisPoints()).toString();

		// OK all's good

		// Add the context
		// The client relies on this to know which network (chainId) the catalog is built for.
		catalogUpdated.context = {
			creatorAddress: CREATOR_ADDRESS,
			contractAddress,
			chainId,
			baseMintPrice,
			royaltyBasisPoints
		};

		// Update the catalog file
		fs.writeFileSync(catalogFilePath, JSON.stringify(catalogUpdated, null, 4));

		// Log some useful stuff
		console.log({
			idsNewlyMinted,
			idsNewlyBurntOrRevoked,
			idsMintable,
			idsUploadedImage,
			idsUpdatedMetadata
		});

		console.log("Updated file:", catalogFilePath)
	});