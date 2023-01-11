// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


import "./AGC.sol";
import "./USC.sol";

contract TokenController is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant REDEEMER_ROLE = keccak256("REDEEMER_ROLE");

    AGC AGCToken;
    USC USCToken;

    address public companyAddress;

    event AGCRedeemed(address indexed redeemer, uint256 inputAGC, uint256 outputUSC);
    event USCRedeemed(address indexed redeemer, uint256 inputUSC, uint256 outputAGC);
    event CompanyAddressUpdated(address oldAddress, address newAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _AGC, address _USC, address _companyAddress) initializer public {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(REDEEMER_ROLE, msg.sender);

        AGCToken = AGC(_AGC);
        USCToken = USC(_USC);
        companyAddress = _companyAddress;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}

    function getAGCAddress() external view returns (address) {
        return address(AGCToken);
    }

    function getUSCAddress() external view returns (address) {
        return address(USCToken);
    }

    function setCompanyAddress(address _newCompanyAddress) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        address oldAddress = companyAddress;
        companyAddress = _newCompanyAddress;

        emit CompanyAddressUpdated(oldAddress, _newCompanyAddress);
    }

    function redeemAGC(address userAddress, uint256 _burnAGCAmount, uint256 _mintUSCAmount) public virtual onlyRole(REDEEMER_ROLE) whenNotPaused {
        require (_burnAGCAmount > 0, "TokenController: AGC amount must be larger than 0");
        require (_mintUSCAmount > 0, "TokenController: USC amount must be larger than 0");
        require(AGCToken.balanceOf(userAddress) >= _burnAGCAmount, "TokenController: insufficient AGC balance");

        AGCToken.burnFrom(userAddress, _burnAGCAmount);
        USCToken.mint(userAddress, _mintUSCAmount);

        emit AGCRedeemed(userAddress, _burnAGCAmount, _mintUSCAmount);
    }

    function redeemUSC(address userAddress, uint256 _burnUSCAmount, uint256 _mintAGCAmount) public virtual onlyRole(REDEEMER_ROLE) whenNotPaused {
        // Assumption: The company multisig address has approved the token controller to burn a large enough amount

        require (_burnUSCAmount > 0, "TokenController: USC amount must be larger than 0");
        require (_mintAGCAmount > 0, "TokenController: AGC amount must be larger than 0");
        require(USCToken.balanceOf(companyAddress) >= _burnUSCAmount, "TokenController: insufficient USC balance");

        uint256 companyUSCAllowance = USCToken.allowance(companyAddress, address(this));
        require(companyUSCAllowance >= _burnUSCAmount, "TokenController: insufficient USC allowance for burning");

        USCToken.burnFrom(companyAddress, _burnUSCAmount);
        AGCToken.mint(userAddress, _mintAGCAmount);

        emit AGCRedeemed(userAddress, _burnUSCAmount, _mintAGCAmount);
    }
}