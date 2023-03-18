// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IPancakeZapV1.sol";

contract BscLpAutoProvider is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    /// @notice Pancakeswap factory contract address
    IUniswapV2Factory public pancakeswapFactoryAddress;

    /// @notice Pancakeswap routerV2 contract address
    IUniswapV2Router public pancakeswapRouter;

    /// @notice Pancakeswap zapV1 contract address
    IPancakeZapV1 public pancakeswapZap;

    /// @notice The pair address of PCS
    address public pairAddress;

    /// @notice percentage of loss acceptance when performing a swap
    uint24 public slippageTolerance;

    /// @notice the address of multisig wallet
    address public ownerAddress;

    event LiquidityProvided(
        address indexed sender,
        address indexed token,
        address pool,
        uint256 lpTokensReceived
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _ownerAddress,
        address _timelockAddress,
        address _pairAddress
    ) external initializer {
        require(
            _ownerAddress != address(0),
            "initialize: owner address cannot be empty"
        );

        require(
            _timelockAddress != address(0),
            "initialize: timelock address cannot be empty"
        );

        require(
            _pairAddress != address(0),
            "initialize: pair address cannot be empty"
        );

        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        ownerAddress = _ownerAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, ownerAddress);
        _grantRole(UPGRADER_ROLE, ownerAddress);
        _grantRole(OPERATOR_ROLE, ownerAddress);
        _grantRole(PAUSER_ROLE, ownerAddress);

        _grantRole(WITHDRAWER_ROLE, _timelockAddress);

        pairAddress = _pairAddress;

        pancakeswapFactoryAddress = IUniswapV2Factory(
            0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73
        );

        pancakeswapRouter = IUniswapV2Router(
            0x10ED43C718714eb63d5aA57B78B54704E256024E
        );

        pancakeswapZap = IPancakeZapV1(
            0xD85835207054F25620109bdc745EC1D1f84F04e1
        );

        slippageTolerance = 100; // 1%
    }

    /// @dev Pause the smart contract in case of emergency
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @dev unpause the smart contract when everything is safe
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setSlippageTolerance(
        uint24 _newPercentage
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(
            _newPercentage >= 0 && _newPercentage <= 500,
            "slippageTolerance: must be between 0% and 5%"
        );

        slippageTolerance = _newPercentage;
    }

    /// @notice Add liquidity to Pancakeswap pools with ETH/ERC20 Tokens
    /// @param _tokenAddress The ERC20 token used
    /// @param _amount The amount of fromToken to invest
    function provideLiquidity(
        address _tokenAddress,
        uint256 _amount
    ) external whenNotPaused {
        require(
            _tokenAddress != address(0),
            "provideLiquidity: zero token address"
        );

        require(_amount > 0, "provideLiquidity: bad amount");

        // Transfers user's token to this contract
        IERC20(_tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        // Calls PCS Zapin contract to perform the swap-and-add-liquidity flow
        _performZapIn(
            _tokenAddress,
            _amount,
            calculateAmountOutMinimum(_amount)
        );

        emit LiquidityProvided(
            msg.sender,
            _tokenAddress,
            pairAddress,
            IERC20(pairAddress).balanceOf(address(this))
        );
    }

    /// @notice Transfer all LP tokens to owner address
    /// @dev Only the timelock can perform this operation
    function withdrawLpTokens() external onlyRole(WITHDRAWER_ROLE) {
        uint256 lpTokenAmount = IERC20(pairAddress).balanceOf(address(this));

        IERC20(pairAddress).transfer(ownerAddress, lpTokenAmount);
    }

    /// @notice Automatically approves Zap contract to spend the input tokens. Then perform the Zap
    function _performZapIn(
        address _tokenAddress,
        uint256 _amount,
        uint256 _minOut
    ) internal {
        IERC20(_tokenAddress).safeApprove(address(pancakeswapZap), _amount);

        pancakeswapZap.zapInToken(_tokenAddress, _amount, pairAddress, _minOut);
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(UPGRADER_ROLE) {}

    /// @dev returns the minimum amount amount using the provided acceptable loss percentage
    function calculateAmountOutMinimum(
        uint256 amountOut
    ) internal view returns (uint256) {
        return (amountOut * (10000 - slippageTolerance)) / 10000;
    }
}
