// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUniswapV2Factory {
    function feeTo() external view returns (address);

    function admin() external view returns (address);

    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address);

    function allPairs(uint256) external view returns (address pair);

    function allPairsLength() external view returns (uint256);

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair);

    function setFeeTo(address) external;

    function setAdmin(address) external;
}
