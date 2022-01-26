const { ethers } = require('hardhat');
const { expect } = require('chai')

const mintPrice = ethers.utils.parseEther("1");
const tokenId = 12345;
const tokenURI = "ipfs://123456789";
const code = "";
const salePrice = ethers.utils.parseEther("2");
const royaltyBasisPoints = 495; // = 4.95%

let c; // the contract, for brevity
let chainId;
let provider;
let sigDomain
let sigTypes;

// accounts
let owner;
let anonA;
let anonB;
let zero = ethers.constants.AddressZero;

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
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenURI', type: 'string' },
      { name: 'code', type: 'string' }
    ]
  };
});

// nb, use...
// expect(await  ... for read functions succeeding
// await expect( ... for read functions failing, and all write functions


it('setPrice, buy', async function () {
  const startingBalance4 = await anonB.getBalance();

  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  /*
  // anonA attempt setPrice
  await expect(c.connect(anonA).setPrice(tokenId, salePrice))
    .to.be.revertedWith('caller is not token owner');

  // anonA attempt buy
  await expect(c.connect(anonA).buy(tokenId, { value: salePrice }))
    .to.be.revertedWith('token not for sale');

  // anonB setPrice
  await expect(c.connect(anonB).setPrice(tokenId, salePrice))
    .to.emit(c, 'PriceSet')
    .withArgs(tokenId, salePrice);

  // anonB attempt buy, is already owner
  await expect(c.connect(anonB).buy(tokenId, { value: salePrice }))
    .to.be.revertedWith('caller is token owner');

  // anonA attempt buy, insufficient value
  await expect(c.connect(anonA).buy(tokenId, { value: ethers.BigNumber.from(salePrice).sub(1) }))
    .to.be.revertedWith('insufficient ETH sent');

  // anonA price
  expect(await c.connect(anonA).price(tokenId))
    .to.equal(salePrice);

  const startingBalance3 = await anonA.getBalance();

  // anonA buy
  await expect(c.connect(anonA).buy(tokenId, { value: salePrice }))
    .to.emit(c, 'Bought')
    .withArgs(tokenId, anonA.address);

  const closingBalance3 = await anonA.getBalance()
  const closingBalance4 = await anonB.getBalance();

  // anonB price
  expect(await c.connect(anonB).price(tokenId))
    .to.equal(0);

  // anonB attempt setPrice
  await expect(c.connect(anonB).setPrice(tokenId, salePrice))
    .to.be.revertedWith('caller is not token owner');

  // anonB ownerOf
  expect(await c.connect(anonB).ownerOf(tokenId))
    .to.equal(anonA.address);

  // owner attempt buy
  await expect(c.connect(anonB).buy(tokenId, { value: salePrice }))
    .to.be.revertedWith('token not for sale');

  // gas fee makes the closing balances inexact, so need to rely on gt/lt
  expect(closingBalance3.lt(startingBalance3.sub(salePrice)))
    .to.equal(true);

  expect(closingBalance4.gt(startingBalance4)
    && closingBalance4.lt(startingBalance4.add(salePrice)))
    .to.equal(true);
  */
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
  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
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
    .to.be.revertedWith('token not for sale');
});


it('setPrice, transfer', async function () {
  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonB setPrice
  await expect(c.connect(anonB).setPrice(tokenId, salePrice))
    .to.emit(c, 'PriceSet')
    .withArgs(tokenId, salePrice);

  // owner price
  expect(await c.connect(owner).price(tokenId))
    .to.equal(salePrice);

  // anonB transferFrom to anonA
  await expect(c.connect(anonB).transferFrom(anonB.address, anonA.address, tokenId))
    .to.emit(c, 'Transfer')
    .withArgs(anonB.address, anonA.address, tokenId);

  // owner price
  expect(await c.connect(owner).price(tokenId))
    .to.equal(0);

  // anonB attempt buy
  await expect(c.connect(anonB).buy(tokenId, { value: salePrice }))
    .to.be.revertedWith('token not for sale');
});


it('role assignments', async function () {
  // anonB owner
  expect(await c.connect(anonB).owner())
    .to.equal(owner.address);
});


it('receiving and withdrawing', async function () {
  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
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
    .to.be.revertedWith('tokenId already minted');
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
    .to.be.revertedWith('tokenId below floor');
});


it('mintAuthorized', async function () {
  // anonB attempt mintAuthorized
  await expect(c.connect(anonB).mintAuthorized(anonB.address, tokenId, tokenURI))
    .to.be.revertedWith('unauthorized to mint');

  // owner attempt mintAuthorized, no tokeURI
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId, ""))
    .to.be.revertedWith('tokenURI cannot be empty');

  // owner mintAuthorized for anonB
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId, tokenURI))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // owner attempt another mintAuthorized, same tokenId 
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId, tokenURI))
    .to.be.revertedWith('tokenId already minted');
});


it('total supply', async function () {
  // anonB totalSupply
  expect(await c.connect(anonB).totalSupply())
    .to.equal(0);

  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // owner mintAuthorized
  await expect(c.connect(owner).mintAuthorized(anonB.address, tokenId + 1, tokenURI))
    .to.emit(c, 'Transfer')

  expect(await c.connect(anonB).totalSupply())
    .to.equal(2);
});


it('signers, authorised and not', async function () {
  // owner sign (signature will be invalid)
  const sig0 = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonA attempt mintable
  expect(await c.connect(anonA).mintable(tokenId, tokenURI, code, sig0))
    .to.equal(true);

  // anonB sign (signature will be invalid)
  const sig2 = await anonB._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonA attempt mintable
  await expect(c.connect(anonA).mintable(tokenId, tokenURI, code, sig2))
    .to.be.revertedWith('signature invalid or signer unauthorized');
});


it('signature verification, good and bad inputs', async function () {
  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB mintable
  expect(await c.connect(anonB).mintable(tokenId, tokenURI, code, signature))
    .to.equal(true);

  // anonB attempt mintable, with incorreet tokenId
  await expect(c.connect(anonB).mintable(tokenId + 1, tokenURI, code, signature))
    .to.be.revertedWith('signature invalid or signer unauthorized');

  // anonB attempt mintable, with incorreet tokenURI
  await expect(c.connect(anonB).mintable(tokenId, tokenURI + "#", code, signature))
    .to.be.revertedWith('signature invalid or signer unauthorized');
});

it('mint multiples', async function () {
  let tokenId = 0;
  let signature;

  for (let i = 0; i < 20; i++) {
    tokenId += 1;

    // owner sign
    signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

    // anonA mint
    await expect(c.connect(anonA).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
      .to.emit(c, 'Transfer')
      .withArgs(zero, anonA.address, tokenId);
  }
});


it('mint, re-mint', async function () {
  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB mintable
  expect(await c.connect(anonB).mintable(tokenId, tokenURI, code, signature))
    .to.equal(true);

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);

  // anonB attempt mintable
  await expect(c.connect(anonB).mintable(tokenId, tokenURI, code, signature))
    .to.be.revertedWith('tokenId already minted');

  // anonA attempt mint
  await expect(c.connect(anonA).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
    .to.be.revertedWith('tokenId already minted');
});


it('mint, various ETH values', async function () {
  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB attempt mint, insufficient ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: ethers.BigNumber.from(mintPrice).sub(1) }))
    .to.be.revertedWith('insufficient ETH sent');

  // anonB mint, excessive ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: ethers.BigNumber.from(mintPrice).add(1) }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('mint, code with default 0 price', async function () {
  let code = "freebie"

  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB mintable
  expect(await c.connect(anonB).mintable(tokenId, tokenURI, code, signature))
    .to.equal(true);

  // anonB mint, zero ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('mint, setCodePrice', async function () {
  const codePrice = ethers.utils.parseEther(".0001");
  let code = ""

  // owner setCodePrice
  await expect(c.connect(owner).setCodePrice(ethers.BigNumber.from(codePrice)))
    .to.emit(c, 'CodePriceSet')
    .withArgs(ethers.BigNumber.from(codePrice));

  // owner sign
  let signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB attempt mint at codePrice, but no code
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: ethers.BigNumber.from(codePrice) }))
    .to.be.revertedWith('insufficient ETH sent');

  code = "freebie"

  // owner sign
  signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB attempt mint, zero ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature))
    .to.be.revertedWith('insufficient ETH sent');

  // anonB mint 
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: ethers.BigNumber.from(codePrice) }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('mint, incorrect promo code', async function () {
  let code = ""

  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  code = "not a freebie"

  // anonB attempt mintable
  await expect(c.connect(anonB).mintable(tokenId, tokenURI, code, signature))
    .to.be.revertedWith('signature invalid or signer unauthorized');

  // anonB attempt mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature))
    .to.be.revertedWith('signature invalid or signer unauthorized');

  // anonB attempt mint, with ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
    .to.be.revertedWith('signature invalid or signer unauthorized');
});


it('mint, promo code, wrong token', async function () {
  let code = "freebie"

  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB attempt mintable, zero ETH
  await expect(c.connect(anonB).mintable(tokenId + 1, tokenURI, code, signature))
    .to.be.revertedWith('signature invalid or signer unauthorized');

  // anonB attempt mint, zero ETH
  await expect(c.connect(anonB).mint(tokenId + 1, tokenURI, code, signature))
    .to.be.revertedWith('signature invalid or signer unauthorized');
});


it('mint, setMintPrice', async function () {
  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB attempt mint, insufficient ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: ethers.BigNumber.from(mintPrice).sub(1) }))
    .to.be.revertedWith('insufficient ETH sent');

  // owner setMintPrice
  await expect(c.connect(owner).setMintPrice(ethers.BigNumber.from(mintPrice).sub(1)))
    .to.emit(c, 'MintPriceSet')
    .withArgs(ethers.BigNumber.from(mintPrice).sub(1));

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: ethers.BigNumber.from(mintPrice).sub(1) }))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('mint, setMintPrice zero', async function () {
  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB attempt mint, insufficient ETH
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature))
    .to.be.revertedWith('insufficient ETH sent');

  // owner setMintPrice
  await expect(c.connect(owner).setMintPrice(0))
    .to.emit(c, 'MintPriceSet')
    .withArgs(0);

  // anonB mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature))
    .to.emit(c, 'Transfer')
    .withArgs(zero, anonB.address, tokenId);
});


it('setIdFloor', async function () {
  // anonA attempt set floor
  await expect(c.connect(anonA).setIdFloor(tokenId + 1))
    .to.be.revertedWith('unauthorized to set idFloor');

  // owner set floor
  await expect(c.connect(owner).setIdFloor(tokenId + 1))
    .to.emit(c, 'IdFloorSet')
    .withArgs(tokenId + 1);

  // anonB floor
  expect(await c.connect(anonB).idFloor())
    .to.equal(tokenId + 1);

  // owner attempt mintAuthorized
  await expect(c.connect(owner).mintAuthorized(owner.address, tokenId, tokenURI))
    .to.be.revertedWith('tokenId below floor');

  // owner sign
  const signature = await owner._signTypedData(sigDomain, sigTypes, { tokenId, tokenURI, code });

  // anonB attempt mintable
  await expect(c.connect(anonB).mintable(tokenId, tokenURI, code, signature))
    .to.be.revertedWith('tokenId below floor');

  // anonB attempt mint
  await expect(c.connect(anonB).mint(tokenId, tokenURI, code, signature, { value: mintPrice }))
    .to.be.revertedWith('tokenId below floor');
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
