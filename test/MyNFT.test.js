const { expect } = require('chai');

const MyNFT = artifacts.require('MyNFT');

// Start test block
contract('MyNFT', function () {
  beforeEach(async function () {
    // Deploy a new Box contract for each test
    this.myNFT = await MyNFT.new();
  });

  // Test case
  it('mints an NFT', async function () {
    await this.myNFT.mintToken('exampleTokenUri');

    expect((await this.myNFT.tokenURI(1)).toString()).to.equal('exampleTokenUri');
  });
});