// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./interfaces/IAugmentRouter01.sol";
import "./interfaces/IAugmentPair.sol";

contract LpAutoProviderV2 is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    /// @dev the Augmentlab router
    IAugmentRouter01 public augmentRouter;

    /// @notice The pair address of USC/USDT pair
    IAugmentPair public augmentPair;

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
        uint256 liquidity
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
        address _routerAddress
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

        require(
            _routerAddress != address(0),
            "initialize: router address cannot be empty"
        );

        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        ownerAddress = _ownerAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, ownerAddress);
        _grantRole(OPERATOR_ROLE, ownerAddress);
        _grantRole(PAUSER_ROLE, ownerAddress);

        _grantRole(UPGRADER_ROLE, _timelockAddress);
        _grantRole(WITHDRAWER_ROLE, _timelockAddress);

        augmentRouter = IAugmentRouter01(_routerAddress);
        augmentPair = IAugmentPair(_pairAddress);
        timelockAddress = _timelockAddress;

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
            _tokenAddress == augmentPair.token0() ||
                _tokenAddress == augmentPair.token1(),
            "provideLiquidity: invalid token address"
        );

        require(_amount > 0, "provideLiquidity: bad amount");
        (uint256 reserve0, uint256 reserve1, ) = augmentPair.getReserves();

        bool isToken0 = augmentPair.token0() == _tokenAddress;

        uint256 amountOut;

        address[] memory callPath = new address[](2);
        callPath[0] = augmentPair.token0();
        callPath[1] = augmentPair.token1();

        if (isToken0) {
            amountOut = augmentRouter.getAmountOut(
                _amount / 2,
                reserve0,
                reserve1
            );
        } else {
            amountOut = augmentRouter.getAmountOut(
                _amount / 2,
                reserve1,
                reserve0
            );
        }

        // calculate slippage protection amount over ideal ratio
        uint256 minOut = calculateAmountOutMinimum(amountOut);

        // Transfers user's token to this contract
        augmentPair.transferFrom(msg.sender, address(this), _amount);

        uint256 swapped = augmentRouter.swapExactTokensForTokens(
            _amount / 2, // swap 50% off the user input amount
            minOut,
            callPath,
            address(this),
            block.timestamp
        )[1];

        require(swapped >= minOut, "provideLiquidity: slippage protection");

        (, , uint256 liquidity) = augmentRouter.addLiquidity(
            augmentPair.token0(),
            augmentPair.token1(),
            isToken0 ? _amount / 2 : swapped,
            isToken0 ? swapped : _amount / 2,
            0,
            0,
            address(this),
            block.timestamp
        );

        emit LiquidityProvided(
            msg.sender,
            _tokenAddress,
            address(augmentPair),
            liquidity
        );
    }

    /// @notice Transfer all LP tokens to owner address
    /// @dev Only the timelock can perform this operation
    function withdrawLpTokens() external onlyRole(WITHDRAWER_ROLE) {
        uint256 lpTokenAmount = augmentPair.balanceOf(address(this));

        require(lpTokenAmount > 0, "withdrawLpTokens: withdraw zero amount");

        augmentPair.transfer(ownerAddress, lpTokenAmount);

        emit WithdrawnLpTokens(
            address(augmentPair),
            ownerAddress,
            lpTokenAmount
        );
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
