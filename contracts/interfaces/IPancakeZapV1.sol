// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IPancakeZapV1 {
    /*
     * @notice Zap a token in (e.g. token/other token)
     * @param _tokenToZap: token to zap
     * @param _tokenAmountIn: amount of token to swap
     * @param _lpToken: LP token address (e.g. CAKE/BUSD)
     * @param _tokenAmountOutMin: minimum token to receive (e.g. CAKE) in the intermediary swap (e.g. BUSD --> CAKE)
     */
    function zapInToken(
        address _tokenToZap,
        uint256 _tokenAmountIn,
        address _lpToken,
        uint256 _tokenAmountOutMin
    ) external;

    /*
     * @notice View the details for single zap
     * @dev Use WBNB for _tokenToZap (if BNB is the input)
     * @param _tokenToZap: address of the token to zap
     * @param _tokenAmountIn: amount of token to zap inputed
     * @param _lpToken: address of the LP token
     * @return swapAmountIn: amount that is expected to get swapped in intermediary swap
     * @return swapAmountOut: amount that is expected to get received in intermediary swap
     * @return swapTokenOut: token address of the token that is used in the intermediary swap
     */
    function estimateZapInSwap(
        address _tokenToZap,
        uint256 _tokenAmountIn,
        address _lpToken
    )
    external
    view
    returns (
        uint256 swapAmountIn,
        uint256 swapAmountOut,
        address swapTokenOut
    );
}
