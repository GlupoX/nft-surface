// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

/**
 *  @title NFT Smart Contract
 *  @author Stephan Fowler
 *  @notice ERC721 contract for stand-alone NFT collections with lazy-minting
 *  @dev Enables lazy-minting by any user via precomputed signatures
 */
contract NFTsurface is ERC721, EIP712 {
    event IdFloorSet(uint256 idFloor);
    event Receipt(uint256 value);
    event Withdrawal(uint256 value);
    event MintPriceSet(uint256 mintPrice);
    event PriceSet(uint256 id, uint256 price);
    event Bought(uint256 id, address buyer);

    address public immutable owner;

    uint256 public mintPrice;
    uint256 public totalSupply;
    uint256 public idFloor;
    uint256 public immutable royaltyBasisPoints;

    mapping(uint256 => string) private tokenURIs;
    mapping(uint256 => uint256) private prices;

    /**
     *  @dev Constructor immutably sets "owner" to the message sender; be sure to deploy contract using the account of the creator/artist/brand/etc.
     *  @param _name ERC721 token name
     *  @param _symbol ERC721 token symbol
     *  @param _mintPrice The initial mint price in wei
     *  @param _royaltyBasisPoints Percentage basis-points for royalty on secondary sales, eg 495 == 4.95%
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _mintPrice,
        uint256 _royaltyBasisPoints
    ) ERC721(_name, _symbol) EIP712("NFTsurface", "1.0.0") {
        owner = _msgSender();
        mintPrice = _mintPrice;
        royaltyBasisPoints = _royaltyBasisPoints;
    }

    /**
     *  @notice Receive ETH
     */
    receive() external payable {
        emit Receipt(msg.value);
    }

    /**
     *  @notice Withdraw ETH balance
     */
    function withdraw() external {
        require(_msgSender() == owner, "unauthorized to withdraw");
        uint256 balance = address(this).balance;
        (bool success, ) = _msgSender().call{value: balance}("");
        require(success, "transfer failed");
        emit Withdrawal(balance);
    }

    /**
     *  @notice Minting by the agent only
     *  @param recipient The recipient of the NFT
     *  @param id The intended token id
     *  @param uri The intended token URI
     */
    function mintAuthorized(
        address recipient,
        uint256 id,
        string memory uri
    ) external {
        require(_msgSender() == owner, "unauthorized to mint");
        require(vacant(id));
        _mint(recipient, id, uri);
    }

    /**
     *  @notice Minting by any caller
     *  @dev Enables "lazy" minting by any user who can provide an agent's signature for the specified params and value
     *  @param id The intended token id
     *  @param uri The intended token URI
     *  @param signature The ERC712 signature of the hash of message value, id, and uri
     */
    function mint(
        uint256 id,
        string memory uri,
        bytes calldata signature
    ) external payable {
        require(msg.value >= mintPrice, "insufficient ETH sent");
        require(mintable(id, uri, signature));
        _mint(_msgSender(), id, uri);
    }

    /**
     *  @notice Checks availability for minting and validity of a signature
     *  @dev Typically run before offering a mint option to users
     *  @param id The intended token id
     *  @param uri The intended token URI
     *  @param signature The ERC712 signature of the hash of id and uri
     */
    function mintable(
        uint256 id,
        string memory uri,
        bytes calldata signature
    ) public view returns (bool) {
        require(vacant(id));
        require(
            owner == ECDSA.recover(_hash(id, uri), signature),
            "signature invalid or signer unauthorized"
        );
        return true;
    }

    /**
     *  @notice Checks the availability of a token id
     *  @dev Reverts if the id is previously minted or below floor
     *  @param id The token id
     */
    function vacant(uint256 id) public view returns (bool) {
        require(!_exists(id), "tokenId already minted");
        require(id >= idFloor, "tokenId below floor");
        return true;
    }

    /**
     *  @notice Sets the price at which a token may be bought
     *  @dev Setting a zero price cancels the sale (all prices are zero by default)
     *  @param id The token id
     *  @param _price The token price in wei
     */
    function setPrice(uint256 id, uint256 _price) external {
        require(_msgSender() == ownerOf(id), "caller is not token owner");
        prices[id] = _price;
        emit PriceSet(id, _price);
    }

    /**
     *  @notice Returns the price at which a token may be bought
     *  @dev A zero price means the token is not for sale
     *  @param id The token id
     */
    function price(uint256 id) external view returns (uint256) {
        return prices[id];
    }

    /**
     *  @notice Transfers the token to the caller, transfers the paid ETH to its owner (minus any royalty)
     *  @dev A zero price means the token is not for sale
     *  @param id The token id
     */
    function buy(uint256 id) external payable {
        require(_msgSender() != ownerOf(id), "caller is token owner");
        require(prices[id] > 0, "token not for sale");
        require(msg.value >= prices[id], "insufficient ETH sent");
        address seller = ownerOf(id);
        delete prices[id];
        _safeTransfer(seller, _msgSender(), id, "");
        Address.sendValue(
            payable(seller),
            (10000 - royaltyBasisPoints) * (msg.value / 10000)
        );
        emit Bought(id, _msgSender());
    }

    /**
     *  @notice Sets the mint price
     *  @param _mintPrice The new mint price
     */
    function setMintPrice(uint256 _mintPrice) external {
        require(_msgSender() == owner, "unauthorized to set mintPrice");
        mintPrice = _mintPrice;
        emit MintPriceSet(_mintPrice);
    }

    /**
     *  @notice Revokes token Ids below a given floor, to disable any signatures that include them
     *  @param floor The floor for token Ids minted from now onward
     */
    function setIdFloor(uint256 floor) external {
        require(_msgSender() == owner, "unauthorized to set idFloor");
        idFloor = floor;
        emit IdFloorSet(idFloor);
    }

    /**
     *  @notice Returns the token URI, given the token id
     *  @param id The token id
     */
    function tokenURI(uint256 id) public view override returns (string memory) {
        return tokenURIs[id];
    }

    /**
     *  @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Minting also increments totalSupply
     */
    function _mint(
        address recipient,
        uint256 id,
        string memory uri
    ) internal {
        _safeMint(recipient, id);
        _setTokenURI(id, uri);
        totalSupply += 1;
    }

    /**
     * @dev Recreates the hash that the signer (may have) signed
     */
    function _hash(uint256 id, string memory uri)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256("mint(uint256 tokenId,string tokenURI)"),
                        id,
                        keccak256(bytes(uri))
                    )
                )
            );
    }

    /**
     * @dev record a token's URI against its id
     */
    function _setTokenURI(uint256 id, string memory uri) internal {
        require(bytes(uri).length != 0, "tokenURI cannot be empty");
        tokenURIs[id] = uri;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721) {
        super._beforeTokenTransfer(from, to, tokenId);
        delete prices[tokenId];
    }
}
