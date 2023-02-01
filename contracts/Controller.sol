// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IERC20MintableUpgradeable.sol";

import "./AGC.sol";
import "./USC.sol";

/// @title TokenController is the contract that allows users to stake USDT and yield USC rewards.
contract TokenController is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant REDEEMER_ROLE = keccak256("REDEEMER_ROLE");

    AGC public AGCToken;
    USC public USCToken;

    event AGCRedeemed(address indexed redeemer, uint256 inputAGC, uint256 outputUSC);
    event USCRedeemed(address indexed redeemer, uint256 inputUSC, uint256 outputAGC);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function initialize(address _AGC, address _USC) public initializer  {
        require(_AGC != address(0), "agc address must not be empty");
        require(_USC != address(0), "usc address must not be empty");

        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(REDEEMER_ROLE, msg.sender);

        AGCToken = AGC(_AGC);
        USCToken = USC(_USC);
    }

    function redeemAGC(address userAddress, uint256 _burnAGCAmount, uint256 _mintUSCAmount) public onlyRole(REDEEMER_ROLE) whenNotPaused {
        require(userAddress != address(0), "TokenController: cannot redeem for zero address");
        require (_burnAGCAmount > 0, "TokenController: AGC amount must be larger than 0");
        require (_mintUSCAmount > 0, "TokenController: USC amount must be larger than 0");
        require(AGCToken.balanceOf(userAddress) >= _burnAGCAmount, "TokenController: insufficient AGC balance");

        AGCToken.burnFrom(userAddress, _burnAGCAmount);
        USCToken.mint(userAddress, _mintUSCAmount);

        emit AGCRedeemed(userAddress, _burnAGCAmount, _mintUSCAmount);
    }

    function redeemUSC(address userAddress, uint256 _burnUSCAmount, uint256 _mintAGCAmount) public onlyRole(REDEEMER_ROLE) whenNotPaused {
        // Assumption: The company multisig address has approved the token controller to burn a large enough amount
        require(userAddress != address(0), "TokenController: cannot redeem for zero address");
        require (_burnUSCAmount > 0, "TokenController: USC amount must be larger than 0");
        require (_mintAGCAmount > 0, "TokenController: AGC amount must be larger than 0");
        require(USCToken.balanceOf(userAddress) >= _burnUSCAmount, "TokenController: insufficient USC balance");

        uint256 userAllowance = USCToken.allowance(userAddress, address(this));
        require(userAllowance >= _burnUSCAmount, "TokenController: insufficient USC allowance for burning");

        USCToken.burnFrom(userAddress, _burnUSCAmount);
        AGCToken.mint(userAddress, _mintAGCAmount);

        emit USCRedeemed(userAddress, _burnUSCAmount, _mintAGCAmount);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}