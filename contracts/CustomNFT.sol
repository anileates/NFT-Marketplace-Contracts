// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * This contract will be used to create a collection for the users on our Market.
 * NOTE: Unlike the MyNFT contract, only owner (collection creator) can mint a `Custom Token`.
 */
contract CustomNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
      _tokenIds.increment(); // start tokenIds from 1
    }

    /**
     * @param _tokenURI is the metadata's IPFS uri.
     */
    function mintToken(string memory _tokenURI) public payable onlyOwner {
      uint256 tokenId = _tokenIds.current();
      _tokenIds.increment();
      _mint(msg.sender, tokenId);
      _setTokenURI(tokenId, _tokenURI);
    }
}
