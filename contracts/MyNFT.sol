// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC721("MyNFT", "MNFT") {
        _tokenIds.increment(); // start the token ids from 1
    }

    function mintToken(string memory tokenURI) public {
        uint256 tokenId = _tokenIds.current();
        _tokenIds.increment();
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);
    }
}
