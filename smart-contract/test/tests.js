const { ethers } = require('hardhat');
const { expect } = require('chai')

const mintPrice = ethers.utils.parseEther("1");
const tokenId = 12345;
const tokenURI = "ipfs://123456789";
const salePrice = ethers.utils.parseEther("2");
const royaltyBasisPoints = 495; // = 4.95%
const maxUint256 = ethers.constants.MaxUint256;

let c; // the contract, for brevity
let chainId;
let provider;
let sigDomain;
let sigTypes;
let sigParams;
let signature;

// accounts
let owner;
let anonA;
let anonB;
let zero = ethers.constants.AddressZero;

// Revert messages
const error_incorrect_ETH = 'incorrect ETH sent';
const error_signature_invalid = 'signature invalid or signer unauthorized';
const error_not_owner = 'caller is not token owner';
const error_is_owner = 'caller is token owner';
const error_token_already_minted = 'tokenId already minted';
const error_token_not_for_sale = 'token not for sale';
const error_id_below_floor = 'tokenId below floor';
const error_unauthorized_to_mint = 'unauthorized to mint';
const error_uri_cannot_be_empty = 'tokenURI cannot be empty';
const error_unauthorized_to_set_floor = 'unauthorized to set idFloor';


beforeEach(async function () {
  const accounts = await ethers.getSigners();
  owner = accounts[0];
  anonA = accounts[1];
  anonB = accounts[2];

  ({ chainId } = await ethers.provider.getNetwork());

  const NFTsurface = await ethers.getContractFactory('NFTsurface');

  c = await NFTsurface.deploy( // c is the contract
    "Testy McTestface",
    "TEST",
    mintPrice,
    royaltyBasisPoints
  );

  await c.deployed();

  provider = ethers.provider;

  sigDomain = {
    name: 'NFTsurface',
    version: '1.0.0',
    chainId: chainId,
    verifyingContract: c.address,
  };

  sigTypes = {
    mint: [
      { name: 'price', type: 'uint256' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenURI', type: 'string' }
    ]
  };

  sigParams = {
    price: maxUint256,
    tokenId,
    tokenURI
  };

  signature = await owner._signTypedData(sigDomain, sigTypes, sigParams);
});

// nb, use...
// expect(await  ... for read functions succeeding
// await expect( ... for read functions failing, and all write functions


it('setPrice, buy', async function () {
  const startingBalance4 = await anonB.getBalance();

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonA attempt setPrice
  await expect(c.connect(anonA).setPrice(tokenId, salePrice))
    .to.be.revertedWith(error_not_owner);

  // anonA attempt buy
  await expect(c.connect(anonA).buy(tokenId, { value: salePrice }))
    .to.be.revertedWith(error_token_not_for_sale);

  // anonB setPrice
  await expect(c.connect(anonB).setPrice(tokenId, salePrice))
    .to.emit(c, 'PriceSet')
    .withArgs(tokenId, salePrice);

  // anonB attempt buy, is already owner
  await expect(c.connect(anonB).buy(tokenId, { value: salePrice }))
    .to.be.revertedWith(error_is_owner);

  // anonA attempt buy, insufficient value
  await expect(c.connect(anonA).buy(tokenId, { value: ethers.BigNumber.from(salePrice).sub(1) }))
    .to.be.revertedWith(error_incorrect_ETH);

  // anonA price
  expect(await c.connect(anonA).priceOf(tokenId))
    .to.equal(salePrice);

  const startingBalance3 = await anonA.getBalance();

  // anonA buy
  await expect(c.connect(anonA).buy(tokenId, { value: salePrice }))
    .to.emit(c, 'Bought')
    .withArgs(tokenId, anonA.address);

  const closingBalance3 = await anonA.getBalance()
  const closingBalance4 = await anonB.getBalance();

  // anonB price
  expect(await c.connect(anonB).priceOf(tokenId))
    .to.equal(0);

  // anonB attempt setPrice
  await expect(c.connect(anonB).setPrice(tokenId, salePrice))
    .to.be.revertedWith(error_not_owner);

  // anonB ownerOf
  expect(await c.connect(anonB).ownerOf(tokenId))
    .to.equal(anonA.address);

  // owner attempt buy
  await expect(c.connect(anonB).buy(tokenId, { value: salePrice }))
    .to.be.revertedWith(error_token_not_for_sale);

  // gas fee makes the closing balances inexact, so need to rely on gt/lt
  expect(closingBalance3.lt(startingBalance3.sub(salePrice)))
    .to.equal(true);

  expect(closingBalance4.gt(startingBalance4)
    && closingBalance4.lt(startingBalance4.add(salePrice)))
    .to.equal(true);
});


it('royalty', async function () {
  // anonB royalty
  expect(await c.connect(anonB).royaltyBasisPoints())
    .to.equal(royaltyBasisPoints);

  // owner mintAuthorized for anonB
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId, tokenURI))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonB setPrice
  await expect(c.connect(anonB).setPrice(tokenId, salePrice))
    .to.emit(c, 'PriceSet')
    .withArgs(tokenId, salePrice);

  // anonA buy
  await expect(c.connect(anonA).buy(tokenId, { value: salePrice }))
    .to.emit(c, 'Bought')
    .withArgs(tokenId, anonA.address);

  const contractBalance = await provider.getBalance(c.address);
  let contractEthBalance = ethers.utils.formatEther(contractBalance);
  contractEthBalance = Math.round(contractEthBalance * 1e4) / 1e4;

  let expectedEthRoyalty = ethers.utils.formatEther(salePrice);
  expectedEthRoyalty = Math.round(expectedEthRoyalty * 1e6 * royaltyBasisPoints) / (1e10);

  expect(contractEthBalance).to.equal(expectedEthRoyalty);
});


it('un-setPrice', async function () {
  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonB setPrice
  await expect(c.connect(anonB).setPrice(tokenId, salePrice))
    .to.emit(c, 'PriceSet')
    .withArgs(tokenId, salePrice);

  // anonB setPrice to 0 (remove from sale)
  await expect(c.connect(anonB).setPrice(tokenId, 0))
    .to.emit(c, 'PriceSet')
    .withArgs(tokenId, 0);

  // anonA attempt buy
  await expect(c.connect(anonA).buy(tokenId, { value: 123456 }))
    .to.be.revertedWith(error_token_not_for_sale);
});


it('setPrice, transfer', async function () {
  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonB setPrice
  await expect(c.connect(anonB).setPrice(tokenId, salePrice))
    .to.emit(c, 'PriceSet')
    .withArgs(tokenId, salePrice);

  // owner price
  expect(await c.connect(owner).priceOf(tokenId))
    .to.equal(salePrice);

  // anonB transferFrom to anonA
  await expect(c.connect(anonB).transferFrom(anonB.address, anonA.address, tokenId))
    .to.emit(c, 'Transfer')
    .withArgs(anonB.address, anonA.address, tokenId);

  // owner price
  expect(await c.connect(owner).priceOf(tokenId))
    .to.equal(0);

  // anonB attempt buy
  await expect(c.connect(anonB).buy(tokenId, { value: salePrice }))
    .to.be.revertedWith(error_token_not_for_sale);
});


it('role assignments', async function () {
  // anonB owner
  expect(await c.connect(anonB).owner())
    .to.equal(owner.address);
});


it('receiving and withdrawing', async function () {
  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonA send 9 ETH
  await expect(anonA.sendTransaction({ to: c.address, value: ethers.utils.parseEther("9") }))
    .to.emit(c, 'Receipt')
    .withArgs(ethers.utils.parseEther("9"));

  // totalReceived is now 10 ETH (ie from mint + send)

  // owner withdraws
  await expect(c.connect(owner).withdraw())
    .to.emit(c, 'Withdrawal')
    .withArgs(ethers.utils.parseEther("10"));
});


it('vacant, mintAuthorized', async function () {
  // anonB vacant
  expect(await c.connect(anonB).vacant(tokenId))
    .to.equal(true);

  // owner mintAuthorized
  await expect(c.connect(owner).mintAuthorized(owner.address, tokenId, tokenURI))
    .to.emit(c, 'Transfer')
    .withArgs(zero, owner.address, tokenId);

  // anonB attempt vacant
  await expect(c.connect(anonB).vacant(tokenId))
    .to.be.revertedWith(error_token_already_minted);
});


it('vacant, floor', async function () {
  // anonB vacant
  expect(await c.connect(anonB).vacant(tokenId))
    .to.equal(true);

  // owner set floor
  await expect(c.connect(owner).setIdFloor(tokenId + 1))
    .to.emit(c, 'IdFloorSet')
    .withArgs(tokenId + 1);

  expect(await c.connect(owner).idFloor())
    .to.equal(tokenId + 1)

  // anonB attempt vacant
  await expect(c.connect(anonB).vacant(tokenId))
    .to.be.revertedWith(error_id_below_floor);
});


it('mintAuthorized', async function () {
  // anonB attempt mintAuthorized
  await expect(c.connect(anonB).mintAuthorized(anonB.address, tokenId, tokenURI))
    .to.be.revertedWith(error_unauthorized_to_mint);

  // owner attempt mintAuthorized, no tokeURI
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId, ""))
    .to.be.revertedWith(error_uri_cannot_be_empty);

  // owner mintAuthorized for anonB
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId, tokenURI))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // owner attempt another mintAuthorized, same tokenId 
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId, tokenURI))
    .to.be.revertedWith(error_token_already_minted);
});


it('total supply', async function () {
  // anonB totalSupply
  expect(await c.connect(anonB).totalSupply())
    .to.equal(0);

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // owner mintAuthorized
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId + 1, tokenURI))
    .to.emit(c, 'Transfer')

  expect(await c.connect(anonB).totalSupply())
    .to.equal(2);
});


it('signer unauthorised', async function () {
  // anonB sign (signature will be invalid)
  const sig2 = await anonB._signTypedData(sigDomain, sigTypes, sigParams);

  // anonA attempt mintable
  await expect(c.connect(anonA).mintable(maxUint256, tokenId, tokenURI, sig2))
    .to.be.revertedWith(error_signature_invalid);
});


it('signature verification, good and bad inputs', async function () {
  // anonB mintable
  expect(await c.connect(anonB).mintable(maxUint256, tokenId, tokenURI, signature))
    .to.equal(true);

  // anonB attempt mintable, with incorreet tokenId
  await expect(c.connect(anonB).mintable(maxUint256, tokenId + 1, tokenURI, signature))
    .to.be.revertedWith(error_signature_invalid);

  // anonB attempt mintable, with incorreet tokenURI
  await expect(c.connect(anonB).mintable(maxUint256, tokenId, tokenURI + "#", signature))
    .to.be.revertedWith(error_signature_invalid);
});


it('mint multiples', async function () {
  let tokenId = 0;
  let signature;

  for (let i = 0; i < 20; i++) {
    tokenId += 1;

    // owner sign
    signature = await owner._signTypedData(sigDomain, sigTypes, { price: maxUint256, tokenId, tokenURI });

    // anonA mint
    await expect(c.connect(anonA).mint(tokenId, tokenURI, signature, { value: mintPrice }))
      .to.emit(c, 'Transfer')
      .withArgs(zero, anonA.address, tokenId);
  }
});


it('mint, re-mint', async function () {
  // anonB mintable
  expect(await c.connect(anonB).mintable(maxUint256, tokenId, tokenURI, signature))
    .to.equal(true);

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonB attempt mintable
  await expect(c.connect(anonB).mintable(maxUint256, tokenId, tokenURI, signature))
    .to.be.revertedWith(error_token_already_minted);

  // anonA attempt mint
  await expect(c.connect(anonA).mint(tokenId, tokenURI, signature, { value: mintPrice }))
    .to.be.revertedWith(error_token_already_minted);
});


it('mint, various ETH values', async function () {
  // anonB attempt mint, insufficient ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: ethers.BigNumber.from(mintPrice).sub(1) }))
    .to.be.revertedWith(error_incorrect_ETH);

  // anonB mint, excessive ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: ethers.BigNumber.from(mintPrice).add(1) }))
    .to.be.revertedWith(error_incorrect_ETH);
});


it('mint, setBaseMintPrice', async function () {
  // anonB attempt mint, insufficient ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: ethers.BigNumber.from(mintPrice).sub(1) }))
    .to.be.revertedWith(error_incorrect_ETH);

  // owner setBaseMintPrice
  await expect(c.connect(owner).setBaseMintPrice(ethers.BigNumber.from(mintPrice).sub(1)))
    .to.emit(c, 'BaseMintPriceSet')
    .withArgs(ethers.BigNumber.from(mintPrice).sub(1));

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: ethers.BigNumber.from(mintPrice).sub(1) }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('mint, setBaseMintPrice zero', async function () {
  // anonB attempt mint, insufficient ETH (zero)
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature))
    .to.be.revertedWith(error_incorrect_ETH);

  // owner setBaseMintPrice
  await expect(c.connect(owner).setBaseMintPrice(0))
    .to.emit(c, 'BaseMintPriceSet')
    .withArgs(0);

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('mintAtPrice, lower', async function () {
  const lowerPrice = ethers.BigNumber.from(mintPrice).sub(1);

  // anonB attempt mintable at lowerPrice
  await expect(c.connect(anonB).mintable(lowerPrice, tokenId, tokenURI, signature))
    .to.be.revertedWith(error_signature_invalid);

  // anonB attempt mint at lower price
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: lowerPrice }))
    .to.be.revertedWith(error_incorrect_ETH);

  // anonB attempt mintAtPrice at lower price
  await expect(c.connect(anonB).mintAtPrice(lowerPrice, tokenId, tokenURI, signature, { value: lowerPrice }))
    .to.be.revertedWith(error_signature_invalid);

  // owner signs a lower price
  let signatureLowerPrice = await owner._signTypedData(sigDomain, sigTypes, { price: lowerPrice, tokenId, tokenURI });

  // anonB mintable at lowerPrice
  expect(await c.connect(anonB).mintable(lowerPrice, tokenId, tokenURI, signatureLowerPrice))
    .to.equal(true);

  // anonB attempt mint at lower price (still fails because minAtPrice should be used)
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: lowerPrice }))
    .to.be.revertedWith(error_incorrect_ETH);

  // anonB mintAtPrice at lowerPrice of another id
  await expect(c.connect(anonB).mintAtPrice(lowerPrice, tokenId + 1, tokenURI, signatureLowerPrice, { value: lowerPrice }))
    .to.be.revertedWith(error_signature_invalid);

  // anonB mintAtPrice at lowerPrice
  await expect(c.connect(anonB).mintAtPrice(lowerPrice, tokenId, tokenURI, signatureLowerPrice, { value: lowerPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('mintAtPrice, higher', async function () {
  const higherPrice = ethers.BigNumber.from(mintPrice).add(1);

  // anonB attempt mintable at higherPrice
  await expect(c.connect(anonB).mintable(higherPrice, tokenId, tokenURI, signature))
    .to.be.revertedWith(error_signature_invalid);

  // anonB attempt mint at higher price
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: higherPrice }))
    .to.be.revertedWith(error_incorrect_ETH);

  // anonB attempt mintAtPrice at higher price
  await expect(c.connect(anonB).mintAtPrice(higherPrice, tokenId, tokenURI, signature, { value: higherPrice }))
    .to.be.revertedWith(error_signature_invalid);

  // owner signs a higher price
  let signatureHigherPrice = await owner._signTypedData(sigDomain, sigTypes, { price: higherPrice, tokenId, tokenURI });

  // anonB mintable at higherPrice
  expect(await c.connect(anonB).mintable(higherPrice, tokenId, tokenURI, signatureHigherPrice))
    .to.equal(true);

  // anonB attempt mint at higher price (still fails because mintPrice should be used)
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: higherPrice }))
    .to.be.revertedWith(error_incorrect_ETH);

  // anonB mintAtPrice at higherPrice of another id
  await expect(c.connect(anonB).mintAtPrice(higherPrice, tokenId + 1, tokenURI, signatureHigherPrice, { value: higherPrice }))
    .to.be.revertedWith(error_signature_invalid);

  // anonB mintAtPrice at higherPrice
  await expect(c.connect(anonB).mintAtPrice(higherPrice, tokenId, tokenURI, signatureHigherPrice, { value: higherPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('mintAtPrice, zero', async function () {
  const zeroPrice = ethers.BigNumber.from(0);

  // anonB attempt mintable at zeroPrice
  await expect(c.connect(anonB).mintable(zeroPrice, tokenId, tokenURI, signature))
    .to.be.revertedWith(error_signature_invalid);

  // anonB attempt mint at zero price
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature))
    .to.be.revertedWith(error_incorrect_ETH);

  // anonB attempt mintAtPrice at zero price
  await expect(c.connect(anonB).mintAtPrice(zeroPrice, tokenId, tokenURI, signature))
    .to.be.revertedWith(error_signature_invalid);

  // owner signs a zero price
  let signatureLowerPrice = await owner._signTypedData(sigDomain, sigTypes, { price: zeroPrice, tokenId, tokenURI });

  // anonB mintable at zeroPrice
  expect(await c.connect(anonB).mintable(zeroPrice, tokenId, tokenURI, signatureLowerPrice))
    .to.equal(true);

  // anonB attempt mint at zero price (still fails because minAtPrice should be used)
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature))
    .to.be.revertedWith(error_incorrect_ETH);

  // anonB mintAtPrice at zeroPrice of another id
  await expect(c.connect(anonB).mintAtPrice(zeroPrice, tokenId + 1, tokenURI, signatureLowerPrice))
    .to.be.revertedWith(error_signature_invalid);

  // anonB mintAtPrice at zeroPrice
  await expect(c.connect(anonB).mintAtPrice(zeroPrice, tokenId, tokenURI, signatureLowerPrice))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('setIdFloor', async function () {
  // anonA attempt set floor
  await expect(c.connect(anonA).setIdFloor(tokenId + 1))
    .to.be.revertedWith(error_unauthorized_to_set_floor);

  // owner set floor
  await expect(c.connect(owner).setIdFloor(tokenId + 1))
    .to.emit(c, 'IdFloorSet')
    .withArgs(tokenId + 1);

  // anonB floor
  expect(await c.connect(anonB).idFloor())
    .to.equal(tokenId + 1);

  // owner attempt mintAuthorized
  await expect(c.connect(owner).mintAuthorized(owner.address, tokenId, tokenURI))
    .to.be.revertedWith(error_id_below_floor);

  // anonB attempt mintable
  await expect(c.connect(anonB).mintable(maxUint256, tokenId, tokenURI, signature))
    .to.be.revertedWith(error_id_below_floor);

  // anonB attempt mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, signature, { value: mintPrice }))
    .to.be.revertedWith(error_id_below_floor);
});


it('tokenURI', async function () {
  // anonB tokenUri
  expect(await c.connect(anonB).tokenURI(tokenId))
    .to.equal("");

  // owner mintAuthorized
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId, tokenURI))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonB tokenUri
  expect(await c.connect(anonB).tokenURI(tokenId))
    .to.equal(tokenURI);
});
