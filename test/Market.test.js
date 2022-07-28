const { expect, assert } = require('chai');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

const MyNFT = artifacts.require('MyNFT');
const Market = artifacts.require('Market');
const Weth = artifacts.require('Weth9');

// Start test block
contract('Market', function ([deployer, user1, user2]) {
  let nftInstance;
  let marketInstance;
  let wethInstance;
  let marketContractAddress;
  let nftContractAddress;

  let LISTING_FEE = "0.0000001";
  let OFFER_ACCEPTANCE_FEE = "0.0001"
  const COMMON_NFT_PRICE = "0.05"; // Put on sale NFTs for this price. So no need to fetch the NFT's price every time.

  /*************************************** HELPER FUNCTIONS ***************************************/
  async function mintToken(minter = user1) {
    await nftInstance.mintToken("randomUri", { from: minter });
  }

  async function setApprovalForAll(address = marketContractAddress, isApproved = true, approver = user1) {
    await nftInstance.setApprovalForAll(address, isApproved, { from: approver })
  }

  async function putOnSale(nftAddress = nftContractAddress, tokenId = 1, price = COMMON_NFT_PRICE, msgSender = user1, msgValue = LISTING_FEE) {
    await marketInstance.putOnSale(
      nftAddress,
      tokenId,
      web3.utils.toWei(price.toString(), 'ether'),
      { from: msgSender, value: web3.utils.toWei(msgValue.toString(), 'ether') }
    );
  }

  async function buyNFT(listingId = 1, msgSender = user1, msgValue = COMMON_NFT_PRICE) {
    return await marketInstance.buyNFT(
      listingId,
      { from: msgSender, value: web3.utils.toWei(msgValue.toString(), 'ether') }
    )
  }

  async function makeOffer(contractAddress, tokenId, price = COMMON_NFT_PRICE, msgSender = user1) {
    return await marketInstance.makeOffer(
      contractAddress,
      tokenId,
      web3.utils.toWei(price.toString(), 'ether'),
      { from: msgSender }
    )
  }

  async function acceptOffer(offerId, msgSender = user1, msgValue = OFFER_ACCEPTANCE_FEE) {
    return await marketInstance.acceptOffer(offerId, { from: msgSender, value: web3.utils.toWei(msgValue.toString(), "ether") })
  }

  async function cancelOffer(offerId, msgSender = user1) {
    return await marketInstance.cancelOffer(offerId, { from: msgSender })
  }

  /*************************************** ***************************************/

  describe('PutOnSale', function () {
    beforeEach(async function () {
      nftInstance = await MyNFT.new();
      marketInstance = await Market.new();

      nftContractAddress = nftInstance.address;
      marketContractAddress = marketInstance.address;
    });

    it('requires the listing fee', async function () {
      try {
        await putOnSale();
        assert(false);
      } catch (error) {
        assert(error);
      }
    })

    // Test case
    it('lets users list their NFTs after fee is paid', async function () {
      await mintToken();
      await setApprovalForAll();
      await putOnSale();

      const marketListings = await marketInstance.marketListings(1);
      expect(marketListings.ownerAddress).to.equal(user1);
    });
  })

  describe('CancelSale', function () {
    beforeEach(async function () {
      nftInstance = await MyNFT.new();
      marketInstance = await Market.new();

      nftContractAddress = nftInstance.address;
      marketContractAddress = marketInstance.address;
    });

    it('requires the user to be owner of the token to cancel sale', async function () {
      await mintToken();
      await setApprovalForAll();
      await putOnSale();

      try {
        await marketInstance.cancelSale(1, { from: user2 })
        assert(false);
      } catch (error) {
        assert(error)
      }
    })

    it('lets users cancel their listings', async function () {
      await mintToken();
      await mintToken();
      await setApprovalForAll();
      await putOnSale();
      await putOnSale(undefined, 2, undefined, undefined, undefined);

      await marketInstance.cancelSale(1, { from: user1 });

      const listing = await marketInstance.marketListings(1);
      const listing2 = await marketInstance.marketListings(2);

      expect(listing.isCancelled).be.true;
      expect(listing2.isCancelled).be.false;
    })

    it('transfers the token to the real owner after listing is cancelled', async function () {
      await mintToken();
      await setApprovalForAll();
      await putOnSale();

      await marketInstance.cancelSale(1, { from: user1 });

      const owner = await nftInstance.ownerOf(1);
      expect(owner).to.equal(user1);
    })

    it('requires listing is not cancelled before', async function () {
      await mintToken();
      await setApprovalForAll();
      await putOnSale();

      await marketInstance.cancelSale(1, { from: user1 });

      try {
        await marketInstance.cancelSale(1, { from: user1 });
        assert(false);
      } catch (error) {
        assert(error);
      }
    })
  })

  describe('Buy NFT', function () {
    before(async function () {
      nftInstance = await MyNFT.new();
      marketInstance = await Market.new();

      nftContractAddress = nftInstance.address;
      marketContractAddress = marketInstance.address;

      // User2 mints 2 NFT, approves MarketContract, and put these NFTs for sale.
      // Then removes 2nd token from sale
      await mintToken(user2)
      await mintToken(user2)
      await setApprovalForAll(undefined, undefined, user2);

      await nftInstance.getApproved(1)

      await putOnSale(undefined, 1, undefined, user2, undefined);
      await putOnSale(undefined, 2, undefined, user2, undefined);

      await marketInstance.cancelSale(2, { from: user2 })
    })

    it('should revert -- listing not found', async function () {
      try {
        await buyNFT(5, user1) // NOTE: There is not a listing with id 5
        assert(false)
      } catch (error) {
        assert(error)
      }
    })

    it('should revert -- listing is cancelled', async function () {
      try {
        await buyNFT(2, user1) // NOTE: Listing with id 2 was cancelled in the `before` hook
        assert(false);
      } catch (error) {
        assert(error);
      }
    })

    it('should let users buy a listed NFT', async function () {
      const initialUser2Balance = await web3.eth.getBalance(user2);
      const tx = await buyNFT(1, user1)

      expectEvent(tx, 'Sale', {
        listingId: "1",
        seller: user2,
        buyer: user1,
        nftContractAddress: nftContractAddress,
        tokenId: "1",
        price: web3.utils.toWei(COMMON_NFT_PRICE.toString(), 'ether')
      });

      const afterUser2Balance = await web3.eth.getBalance(user2);
      expect(afterUser2Balance - initialUser2Balance).to.be.gt(parseFloat(COMMON_NFT_PRICE))
    })

    it('should revert -- item is already sold', async function () {
      try {
        await buyNFT(1, user1); // Item with listing id 1 was already sold
        assert(false);
      } catch (error) {
        assert(error)
      }
    })
  })

  describe('Place Offer', function () {
    before(async function () {
      nftInstance = await MyNFT.new();
      marketInstance = await Market.new();
      wethInstance = await Weth.new();

      nftContractAddress = nftInstance.address;
      marketContractAddress = marketInstance.address;

      // NOTE: We are simulating the WETH in our local chain. WETH address is not significant before deployment.
      // So we need to change it after deployment
      await marketInstance.setWethAddress(wethInstance.address);

      await mintToken(user2); // NOTE: Need 2 NFT to test `Bid to own token` case. 
      await mintToken(user2); // One is listed  and one is not listed on the `Market`

      await setApprovalForAll(undefined, undefined, user2);

      await putOnSale(undefined, 1, undefined, user2, undefined); // List the token with id 1
    })

    it('should revert -- Insufficient WETH allowance', async function () {
      await expectRevert(
        makeOffer(nftContractAddress, 2, 23, user1), "Market: Insufficient WETH allowance"
      )
    })

    it('should revert -- Bid to own token', async function () {
      await wethInstance.approve(marketContractAddress, web3.utils.toWei("40", "ether"), { from: user2 });

      /**
       * If an NFT is listed, official owner will be the `Market` contract.
       * We need to test this scenario too.
       */
      await expectRevert(makeOffer(nftContractAddress, 1, 3, user2), "Market: Offer to own token");
      await expectRevert(makeOffer(nftContractAddress, 2, 2, user2), "Market: Offer to own token");
    });

    it('should make an offer', async function () {
      await wethInstance.approve(marketContractAddress, web3.utils.toWei("10", "ether"), { from: user1 });
      const tx = await makeOffer(nftContractAddress, 1, 4)
      await makeOffer(nftContractAddress, 2, 7)

      expectEvent(tx, "OfferMade", {
        offerId: "1",
        offerer: user1,
        nftContractAddress: nftContractAddress,
        tokenId: "1",
        price: web3.utils.toWei("4", 'ether'),
      })

      const offer = await marketInstance.offers(1);
      expect(offer.offererAddress).to.equal(user1)
    });
  })

  describe('Cancel Offer', function () {
    before(async function () {
      nftInstance = await MyNFT.new();
      marketInstance = await Market.new();
      wethInstance = await Weth.new();

      nftContractAddress = nftInstance.address;
      marketContractAddress = marketInstance.address;

      await mintToken(user2);
      await mintToken(user2);

      await marketInstance.setWethAddress(wethInstance.address);
      await wethInstance.approve(marketContractAddress, web3.utils.toWei("10", "ether"), { from: user1 });

      await makeOffer(nftContractAddress, 1, 4, user1);
      await makeOffer(nftContractAddress, 2, 4, user1);
    })

    it('should revert -- Offer not found', async function () {
      await expectRevert(
        cancelOffer(5, user2),
        "Market: Offer not found"
      );
    })

    it('should revert -- Only token owner can do this', async function () {
      await expectRevert(
        cancelOffer(2, user2),
        "Market: Not token owner"
      )
    })

    it('should cancel offer', async function () {
      const tx = await cancelOffer(2, user1);

      expectEvent(tx, "OfferCancelled", {
        offerId: '2',
        offerer: user1
      })

      const offer = await marketInstance.offers(2);
      expect(offer.isCancelled).be.true;
    })

    it('should revert -- Already cancelled', async function () {
      await expectRevert(
        cancelOffer(2, user1),
        "Market: Offer is already cancelled"
      )
    })
  })

  describe('Accept Offer', function () {
    beforeEach(async function () {
      nftInstance = await MyNFT.new();
      marketInstance = await Market.new();
      wethInstance = await Weth.new();

      nftContractAddress = nftInstance.address;
      marketContractAddress = marketInstance.address;

      await marketInstance.setWethAddress(wethInstance.address);

      // User1 will be the offerer
      // User2 will be the seller
      await setApprovalForAll(marketContractAddress, true, user2);
      await wethInstance.deposit({ from: user1, value: web3.utils.toWei('5', "ether") })
      await wethInstance.approve(marketContractAddress, web3.utils.toWei("5", "ether"), { from: user1 });
    })

    it('should revert -- Offer not found', async function () {
      await expectRevert(
        acceptOffer(11, user2),
        "Market: Offer not found"
      );
    })

    it('should revert -- Only token owner can do this', async function () {
      await mintToken(user2)
      await makeOffer(nftContractAddress, 1, 2.1, user1)

      await expectRevert(
        acceptOffer(1, user1),
        "Market: Not token owner"
      )
    });

    it('should revert -- Fee must be sent', async function () {
      await mintToken(user2)
      await makeOffer(nftContractAddress, 1, 2.1, user1)

      await expectRevert(
        acceptOffer(1, user2, 0),
        "Market: Fee must be sent"
      )
    });

    /**
     * Should emit `OfferAccepted`
     */
    context('NFT was not listed before', async function () {
      it('should accept the offer', async function () {
        await mintToken(user2)
        await makeOffer(nftContractAddress, 1, 2.1, user1)

        const tx = await acceptOffer(1, user2);

        expectEvent(tx, "OfferAccepted", {
          offerId: "1",
          seller: user2,
        })
      })
    });

    context('NFT was already listed', async function () {
      it('should make the `Listing` sold then accept the offer', async function () {
        await mintToken(user2)
        await putOnSale(nftContractAddress, 1, 1.3, user2)
        await makeOffer(nftContractAddress, 1, 2.1, user1)

        const tx = await acceptOffer(1, user2);

        expectEvent(tx, "OfferAccepted", {
          offerId: "1",
          seller: user2,
        })

        const listing = await marketInstance.marketListings(1);
        expect(listing.isSold).be.true;
      })
    });

    it('should transfer WETH to the seller & transfer the NFT to the buyer', async function () {
      const user2WethBalance = await wethInstance.balanceOf(user2);

      await mintToken(user2)
      await makeOffer(nftContractAddress, 1, 0.45, user1)
      await acceptOffer(1, user2);

      const user2WethBalanceAfter = await wethInstance.balanceOf(user2);
      const newOwner = await nftInstance.ownerOf(1);

      expect(newOwner).to.equal(user1);
      expect(user2WethBalanceAfter - user2WethBalance).to.be.gt(0.44);
    })

    it('should revert -- Offer is already accepted', async function () {
      await mintToken(user2)
      await makeOffer(nftContractAddress, 1, 2.5, user1)
      await acceptOffer(1, user2);

      await expectRevert(
        acceptOffer(1, user2),
        "Market: Offer is already accepted"
      );
    });

    it('should revert -- Offer is cancelled', async function () {
      await mintToken(user2)
      await makeOffer(nftContractAddress, 1, 2.5, user1)
      await cancelOffer(1, user1);
      
      await expectRevert(
        acceptOffer(1, user2),
        "Market: Offer is cancelled"
      );
    })

    it('should revert -- Offer is expired', async function () {
      await mintToken(user2)
      await makeOffer(nftContractAddress, 1, 2.5, user1)

      const now = Math.floor(Date.now() / 1000)
      // Set the timestamp 2 weeks later
      await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", params: [now + (14 * 24 * 60 * 60)], id: 123 }, (err, _) => { console.log(err) })

      await expectRevert(
        acceptOffer(1, user2),
        "Market: Offer is expired"
      )
    })
  })
});