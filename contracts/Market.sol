// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Market is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _listingCounts;
    Counters.Counter private _offerCounts;
    Counters.Counter private _saleCounts;

    struct Offer {
        uint256 id;
        address offererAddress;
        address contractAddress;
        uint256 tokenId;
        uint256 price;
        bool isAccepted;
        bool isCancelled;
        uint256 expirationDate;
    }

    struct Listing {
        uint256 listingId;
        address contractAddress;
        uint256 tokenId;
        address ownerAddress;
        uint256 price;
        bool isSold;
        bool isCancelled;
    }

    mapping(uint256 => Listing) public marketListings;
    mapping(uint256 => Offer) public offers;

    uint256 public LISTING_PRICE = 0.0000001 ether;
    uint256 public OFFER_ACCEPTANCE_FEE = 0.0001 ether;
    address public WETH_ADDRESS = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // Mainnet WETH address. For test purposes, change it using `setWethAddress` function after contract is deployed.

    event WethAddressChanged(address newAddress);

    event ListingCreated(
        uint256 listingId,
        address indexed owner,
        address indexed nftContractAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed owner,
        address indexed nftContractAddress,
        uint256 tokenId
    );

    event OfferMade(
        uint256 offerId,
        address indexed offerer,
        address indexed nftContractAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event OfferCancelled(uint256 indexed offerId, address indexed offerer);

    event OfferAccepted(uint256 indexed offerId, address indexed seller);

    event Sale(
        uint256 indexed listingId,
        address seller,
        address buyer,
        address indexed nftContractAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    constructor() payable {
        _listingCounts.increment(); // start from 1
        _offerCounts.increment(); // start from 1
    }

    modifier onlyAccounts() {
        require(msg.sender == tx.origin, "Not allowed origin");
        _;
    }

    receive() external payable {}

    fallback() external payable {}

    function putOnSale(
        address _contractAddress,
        uint256 _tokenId,
        uint256 _price
    ) public payable onlyAccounts {
        require(msg.value >= LISTING_PRICE, "Market: Listing fee must be sent");

        ERC721 nft = ERC721(_contractAddress);
        nft.transferFrom(msg.sender, address(this), _tokenId);

        uint256 itemId = _listingCounts.current();
        marketListings[itemId] = Listing(
            itemId,
            _contractAddress,
            _tokenId,
            msg.sender,
            _price,
            false,
            false
        );

        _listingCounts.increment();

        emit ListingCreated(
            itemId,
            msg.sender,
            _contractAddress,
            _tokenId,
            _price
        );
    }

    function cancelSale(uint256 listingId) public {
        Listing storage listing = marketListings[listingId];

        require(
            msg.sender == listing.ownerAddress,
            "Only token owner can do this action"
        );
        require(!listing.isSold, "Market: Item is already sold");
        require(!listing.isCancelled, "Market: Listing already cancelled");

        listing.isCancelled = true;

        IERC721(address(listing.contractAddress)).transferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );

        emit ListingCancelled(
            listing.listingId,
            listing.ownerAddress,
            listing.contractAddress,
            listing.tokenId
        );
    }

    function buyNFT(uint256 _listingId) public payable {
        Listing storage listing = marketListings[_listingId];

        require(
            listing.contractAddress != address(0),
            "Market: Listing not found"
        );
        require(!listing.isSold, "Market: Item is already sold");
        require(!listing.isCancelled, "Market: Listing is cancelled");
        require(msg.value >= listing.price, "Market: Send the listing price");

        listing.isSold = true;

        payable(address(listing.ownerAddress)).transfer(listing.price);
        ERC721(listing.contractAddress).transferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );

        emit Sale(
            _listingId,
            listing.ownerAddress,
            msg.sender,
            listing.contractAddress,
            listing.tokenId,
            listing.price
        );
    }

    function makeOffer(
        address _contractAddress,
        uint256 _tokenId,
        uint256 _price
    ) public {
        // Find the WETH allowance.
        IERC20 wethContract = IERC20(WETH_ADDRESS);
        uint256 allowance = wethContract.allowance(msg.sender, address(this));

        require(allowance >= _price, "Market: Insufficient WETH allowance");

        IERC721 nftContract = IERC721(_contractAddress);
        address owner = nftContract.ownerOf(_tokenId);

        // Owner is `market`. So we need to find the real owner from `marketListings`
        if (owner == address(this)) {
            for (uint256 i = 0; i <= _listingCounts.current(); i++) {
                if (
                    marketListings[i].contractAddress == _contractAddress &&
                    marketListings[i].tokenId == _tokenId &&
                    !marketListings[i].isSold &&
                    !marketListings[i].isCancelled
                ) {
                    owner = marketListings[i].ownerAddress;
                }
            }
        }

        require(msg.sender != owner, "Market: Offer to own token");

        offers[_offerCounts.current()] = Offer(
            _offerCounts.current(),
            msg.sender,
            _contractAddress,
            _tokenId,
            _price,
            false,
            false,
            block.timestamp + 1 weeks
        );

        emit OfferMade(
            _offerCounts.current(),
            msg.sender,
            _contractAddress,
            _tokenId,
            _price
        );
        _offerCounts.increment();
    }

    function cancelOffer(uint256 _offerId) public {
        Offer storage offer = offers[_offerId];

        require(offer.id != 0, "Market: Offer not found");
        require(offer.offererAddress == msg.sender, "Market: Not token owner");
        require(!offer.isAccepted, "Market: Offer is already accepted");
        require(!offer.isCancelled, "Market: Offer is already cancelled");

        offer.isCancelled = true;
        emit OfferCancelled(_offerId, msg.sender);
    }

    function acceptOffer(uint256 _offerId) public payable {
        Offer storage offer = offers[_offerId];
        require(offer.id != 0, "Market: Offer not found");

        require(
            block.timestamp < offer.expirationDate,
            "Market: Offer is expired"
        );

        require(!offer.isCancelled, "Market: Offer is cancelled");
        require(!offer.isAccepted, "Market: Offer is already accepted");
        require(msg.value >= OFFER_ACCEPTANCE_FEE, "Market: Fee must be sent");

        IERC721 nftContract = IERC721(offer.contractAddress);
        address tokenOwner = nftContract.ownerOf(offer.tokenId);
        uint256 listingId = 0;

        // If the token owner is this contract, we need to find the real owner from listing
        if (tokenOwner == address(this)) {
            for (uint256 i = 0; i <= _listingCounts.current(); i++) {
                if (
                    marketListings[i].contractAddress ==
                    offer.contractAddress &&
                    marketListings[i].tokenId == offer.tokenId &&
                    !marketListings[i].isSold &&
                    !marketListings[i].isCancelled
                ) {
                    tokenOwner = marketListings[i].ownerAddress;
                    listingId = marketListings[i].listingId;
                }
            }
        }

        require(msg.sender == tokenOwner, "Market: Not token owner");

        offer.isAccepted = true;

        IERC20 weth = IERC20(WETH_ADDRESS);
        weth.transferFrom(offer.offererAddress, msg.sender, offer.price);

        Listing storage listing = marketListings[listingId];
        listing.isSold = true;

        // If the `lisitngId` is NOT 0, that means the NFT is listed and owner is `Market` contract
        // So transfer from `Market` contract
        if (listingId != 0) {
            nftContract.transferFrom(
                address(this),
                offer.offererAddress,
                offer.tokenId
            );
        } else {
            nftContract.transferFrom(
                tokenOwner,
                offer.offererAddress,
                offer.tokenId
            );
        }

        emit OfferAccepted(_offerId, msg.sender);
    }

    function setWethAddress(address _wethAddress) public onlyOwner {
        require(_wethAddress != address(0), "Zero address");
        WETH_ADDRESS = _wethAddress;

        emit WethAddressChanged(_wethAddress);
    }

    function withdraw() public onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }
}
