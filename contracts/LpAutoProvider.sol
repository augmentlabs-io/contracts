// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "hardhat/console.sol";

contract LpAutoProvider is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    /// @dev the position manager
    INonfungiblePositionManager public nonfungiblePositionManager;

    /// @dev the uniswap router
    ISwapRouter public swapRouter;

    /// @dev the token0
    address public uscAddress;

    /// @dev the token1
    address public usdtAddress;

    /// @dev owner address to transfer all the funds to
    address public ownerAddress;

    /// @dev the fee tier of the initialized pool
    uint24 public feeTier;

    /// @dev the token id when we init the pool
    uint256 public companyTokenId;

    /// @dev percentage of loss acceptance when performing a swap
    uint24 public slippageTolerance;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _ownerAddress,
        address _usdtAddress,
        address _uscAddress,
        uint24 _feeTier,
        uint256 _tokenId,
        address _timelockAddress
    ) external initializer {
        require(
            _ownerAddress != address(0),
            "initialize: owner address cannot be empty"
        );
        require(
            _usdtAddress != address(0),
            "initialize: usdt address cannot be empty"
        );
        require(
            _uscAddress != address(0),
            "initialize: usc address cannot be empty"
        );
        require(_feeTier > 0, "initialize: feeTier must be larger than zero");
        require(_tokenId > 0, "initialize: tokenId must be larger than zero");

        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _ownerAddress);
        _grantRole(UPGRADER_ROLE, _ownerAddress);
        _grantRole(PAUSER_ROLE, _ownerAddress);
        _grantRole(OPERATOR_ROLE, _ownerAddress);

        // Only timelock granted as withdrawal role
        _grantRole(WITHDRAWER_ROLE, _timelockAddress);

        ownerAddress = _ownerAddress;
        usdtAddress = _usdtAddress;
        uscAddress = _uscAddress;
        feeTier = _feeTier;
        companyTokenId = _tokenId;

        nonfungiblePositionManager = INonfungiblePositionManager(
            0xC36442b4a4522E871399CD717aBDD847Ab11FE88
        );
        swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
        slippageTolerance = 50; // 0.5%
    }

    /// @dev Pause the smart contract in case of emergency
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @dev unpause the smart contract when everything is safe
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setSlippageTolerance(uint24 _newPercentage)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
    {
        require(
            _newPercentage >= 0 && _newPercentage <= 500,
            "slippageTolerance: must be between 0% and 5%"
        );

        slippageTolerance = _newPercentage;
    }

    function setCompanyTokenId(uint256 _newTokenId)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
    {
        require(
            _newTokenId > companyTokenId,
            "companyTokenId: must be larger than previous id"
        );

        companyTokenId = _newTokenId;
    }

    function setFeeTier(uint24 _newFeeTier)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
    {
        require(
            _newFeeTier >= 100,
            "setFeeTier: fee must be equal or larger than 0.01%"
        );
        require(
            _newFeeTier <= 10000,
            "setFeeTier: fee must be less or equal to 1%"
        );

        feeTier = _newFeeTier;
    }

    /// @notice callback to accept ERC721 tokens
    function onERC721Received(
        address operator,
        address,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /// @dev swaps and add liquidity using contract's USC balance
    /// @notice swaps 50% of the USC amount to USDT then perform the swap.
    /// Then use the swapped amount together with the remaining USC to provide liquidity.
    function swapAndAddUSC(uint256 uscAmount)
        external
        whenNotPaused
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        require(
            uscAmount > 0,
            "swapAndAddUSC: amount must be larger than zero"
        );
        TransferHelper.safeTransferFrom(
            uscAddress,
            msg.sender,
            address(this),
            uscAmount
        );

        uint256 depositUSCAmount = uscAmount / 2;

        uint256 swappedUSDT = swapUSCForUSDT(uscAmount - depositUSCAmount);
        require(swappedUSDT > 0, "swapAndAddUSC: swapped 0 USDT");

        TransferHelper.safeApprove(
            uscAddress,
            address(nonfungiblePositionManager),
            depositUSCAmount
        );
        TransferHelper.safeApprove(
            usdtAddress,
            address(nonfungiblePositionManager),
            swappedUSDT
        );

        (liquidity, amount0, amount1) = increaseLiquidityCurrentRange(
            depositUSCAmount,
            swappedUSDT
        );
    }

    /// @dev swaps and add liquidity using contract's USDT balance
    /// @notice swaps 50% of the USDT amount to USC then perform the swap.
    /// Then use the swapped amount together with the remaining USDT to provide liquidity.
    function swapAndAddUSDT(uint256 usdtAmount)
        external
        whenNotPaused
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        require(
            usdtAmount > 0,
            "swapAndAddUSDT: amount must be larger than zero"
        );
        TransferHelper.safeTransferFrom(
            usdtAddress,
            msg.sender,
            address(this),
            usdtAmount
        );

        uint256 depositUSDTAmount = usdtAmount / 2;

        uint256 swappedUSC = swapUSDTForUSC(usdtAmount - depositUSDTAmount);
        require(swappedUSC > 0, "swapAndAddUSDT: swapped 0 USC");

        TransferHelper.safeApprove(
            uscAddress,
            address(nonfungiblePositionManager),
            swappedUSC
        );
        TransferHelper.safeApprove(
            usdtAddress,
            address(nonfungiblePositionManager),
            depositUSDTAmount
        );

        (liquidity, amount0, amount1) = increaseLiquidityCurrentRange(
            swappedUSC,
            depositUSDTAmount
        );
    }

    function collectFee()
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256 amount0, uint256 amount1)
    {
        // Caller must own the ERC721 position
        // Call to safeTransfer will trigger `onERC721Received` which must return the selector else transfer will fail
        nonfungiblePositionManager.safeTransferFrom(
            msg.sender,
            address(this),
            companyTokenId
        );

        // set amount0Max and amount1Max to uint256.max to collect all fees
        // alternatively can set recipient to msg.sender and avoid another transaction in `sendToOwner`
        INonfungiblePositionManager.CollectParams
            memory params = INonfungiblePositionManager.CollectParams({
                tokenId: companyTokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (amount0, amount1) = nonfungiblePositionManager.collect(params);

        // send collected feed back to owner
        _sendToOwner(amount0, amount1);
    }

    /// @notice Withdraws all USDT and USC token to company address
    function withdrawLiquidity(uint128 _withdrawAmount)
        external
        onlyRole(WITHDRAWER_ROLE)
        returns (uint256 amount0, uint256 amount1)
    {
        // amount0Min and amount1Min are price slippage checks
        // if the amount received after burning is not greater than these minimums, transaction will fail
        INonfungiblePositionManager.DecreaseLiquidityParams
            memory params = INonfungiblePositionManager
                .DecreaseLiquidityParams({
                    tokenId: companyTokenId,
                    liquidity: _withdrawAmount,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                });

        (amount0, amount1) = nonfungiblePositionManager.decreaseLiquidity(
            params
        );

        //send liquidity back to owner
        _sendToOwner(amount0, amount1);
    }

    /// @notice Increases liquidity of the USC/USDT pool in the current range
    /// @param amountAddUSC The amount to add of token0
    /// @param amountAddUSDT The amount to add of token1
    function increaseLiquidityCurrentRange(
        uint256 amountAddUSC,
        uint256 amountAddUSDT
    )
        internal
        returns (
            uint128 liquidity,
            uint256 amountUSC,
            uint256 amountUSDT
        )
    {
        INonfungiblePositionManager.IncreaseLiquidityParams
            memory params = INonfungiblePositionManager
                .IncreaseLiquidityParams({
                    tokenId: companyTokenId,
                    amount0Desired: amountAddUSC,
                    amount1Desired: amountAddUSDT,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                });

        (liquidity, amountUSC, amountUSDT) = nonfungiblePositionManager
            .increaseLiquidity(params);
    }

    /// @dev swap 50% of all available USC for USDT
    /// @param uscAmount the amount of USC to swap for USDT
    function swapUSCForUSDT(uint256 uscAmount)
        internal
        returns (uint256 amountOut)
    {
        uint256 amountOutMinimum = calculateAmountOutMinimum(uscAmount);

        TransferHelper.safeApprove(uscAddress, address(swapRouter), uscAmount);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: uscAddress,
                tokenOut: usdtAddress,
                fee: feeTier,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: uscAmount,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0 // swap exact input amount
            });

        amountOut = swapRouter.exactInputSingle(params);

        return amountOut;
    }

    /// @dev swap 50% of all available USDT for USC
    /// @param usdtAmount the amount of USDT to swap for USC
    function swapUSDTForUSC(uint256 usdtAmount)
        internal
        returns (uint256 amountOut)
    {
        uint256 amountOutMinimum = calculateAmountOutMinimum(usdtAmount);

        TransferHelper.safeApprove(
            usdtAddress,
            address(swapRouter),
            usdtAmount
        );

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: usdtAddress,
                tokenOut: uscAddress,
                fee: feeTier,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: usdtAmount,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0 // swap exact input amount
            });

        amountOut = swapRouter.exactInputSingle(params);

        return amountOut;
    }

    /// @notice Transfers funds to owner of NFT
    /// @param tokenId The id of the erc721
    /// @param amount0 The amount of token0
    /// @param amount1 The amount of token1
    function _sendToOwner(uint256 amount0, uint256 amount1) internal {
        TransferHelper.safeTransfer(uscAddress, ownerAddress, amount0);
        TransferHelper.safeTransfer(usdtAddress, ownerAddress, amount1);
    }

    function _authorizeUpgrade(address)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    /// @dev returns the minimum amount amount using the provided acceptable loss percentage
    function calculateAmountOutMinimum(uint256 amountOut)
        internal
        view
        returns (uint256)
    {
        return (amountOut * (10000 - slippageTolerance)) / 10000;
    }
}
