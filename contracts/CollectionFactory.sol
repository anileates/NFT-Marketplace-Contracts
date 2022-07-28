// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./CustomNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * The `CollectionFactory` lets users create their own collection through our Marketplace.
 * `CollectionFactory` creates a new `CustomNFT` contract then passes the ownership of the new `CustomNFT` collection.
 */
contract CollectionFactory is Ownable {
    uint256 public COLLECTION_CREATION_FEE = 0.000001 ether;

    event CollectionCreated(address indexed creator, address indexed contractAddress);

    constructor() {
    }

    // Do not let the other smart contracts request
    modifier onlyAccounts() {
        require(msg.sender == tx.origin, "Not allowed origin");
        _;
    }

    function setCollectionCreationFee(uint256 _newFee) public onlyOwner {
        COLLECTION_CREATION_FEE = _newFee;
    }

    /*
     * Creates a new `CustomNFT` contract (i.e. collection).
     * Then, passes the ownership of the new `CustomNFT` contract to the user.
     *
     * @param _name The name of the new collection
     * @param _symbol The symbol of the new collection
     *
     * NOTE: Emits newly created collection's address. Front-end should scrape it from events if needed.
     */
    function createCollection(string memory _name, string memory _symbol)
        public
        payable
        onlyAccounts
        returns (address)
    {
        require(msg.value >= COLLECTION_CREATION_FEE);

        CustomNFT collection = new CustomNFT(_name, _symbol);
        collection.transferOwnership(msg.sender);

        emit CollectionCreated(msg.sender, address(collection));
    }
}
