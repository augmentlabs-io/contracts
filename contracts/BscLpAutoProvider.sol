// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "./interfaces/IPancakeZapV1.sol";

contract BscLpAutoProvider is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    /// @notice Pancakeswap zapV1 contract address
    IPancakeZapV1 public pancakeswapZap;

    /// @notice The pair address of PCS
    address public pairAddress;

    /// @notice percentage of loss acceptance when performing a swap
    uint24 public slippageTolerance;

    /// @notice the address of multisig wallet
    address public ownerAddress;

    /// @notice the address of the timelock
    address public timelockAddress;

    event LiquidityProvided(
        address indexed sender,
        address indexed token,
        address pool,
        uint256 lpTokensReceived
    );

    event WithdrawnLpTokens(
        address indexed pairAddress,
        address indexed toUser,
        uint256 amount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _ownerAddress,
        address _timelockAddress,
        address _pairAddress,
        address _zapAddress
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
        timelockAddress = _timelockAddress;
        pancakeswapZap = IPancakeZapV1(_zapAddress);

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

    function setSlippageTolerance(
        uint24 _newPercentage
    ) external whenNotPaused onlyRole(OPERATOR_ROLE) {
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

        // calculate slippage protection amount over ideal ratio
        uint256 minOut = calculateAmountOutMinimum(_amount / 2);

        // Transfers user's token to this contract
        IERC20Upgradeable(_tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        // Calls PCS Zapin contract to perform the swap-and-add-liquidity flow
        _performZapIn(_tokenAddress, _amount, minOut);

        emit LiquidityProvided(
            msg.sender,
            _tokenAddress,
            pairAddress,
            IERC20Upgradeable(pairAddress).balanceOf(address(this))
        );
    }

    /// @notice Transfer all LP tokens to owner address
    /// @dev Only the timelock can perform this operation
    function withdrawLpTokens() external onlyRole(WITHDRAWER_ROLE) {
        uint256 lpTokenAmount = IERC20Upgradeable(pairAddress).balanceOf(
            address(this)
        );

        require(lpTokenAmount > 0, "withdrawLpTokens: withdraw zero amount");

        IERC20Upgradeable(pairAddress).transfer(ownerAddress, lpTokenAmount);

        emit WithdrawnLpTokens(pairAddress, ownerAddress, lpTokenAmount);
    }

    /// @notice Automatically approves Zap contract to spend the input tokens. Then perform the Zap
    function _performZapIn(
        address _tokenAddress,
        uint256 _amount,
        uint256 _minOut
    ) internal {
        IERC20Upgradeable(_tokenAddress).safeApprove(
            address(pancakeswapZap),
            _amount
        );

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
