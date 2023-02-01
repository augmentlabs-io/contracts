// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title AGC is the token to be used and managed by Augmentlabs in the ecosystem with restricted permissions for normal users.
contract AGC is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    address private companyAddress;
    mapping (address => uint256) private _userBalance;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _companyAddress) public initializer {
        require(_companyAddress != address(0), "company address must not be empty");

        __ERC20_init("AGC", "AGC");
        __ERC20Burnable_init();
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        companyAddress = _companyAddress;
    }

    function mint(address userAddress, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(amount > 0, "AGC: cannot mint zero token");
        require(userAddress != companyAddress, "AGC: company cannot update its own balance");
        _mint(companyAddress, amount);
        
        _userBalance[userAddress] += amount;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function burn(uint256 amount) public pure override {
        revert("burn is not allowed");
    }

    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burnFrom(address userAddress, uint256 amount) public override onlyRole(MINTER_ROLE) whenNotPaused {
        require(userAddress != address(0), "ERC20: burn from zero address");
        require(amount <= _userBalance[userAddress], "AGC: insufficient AGC to burn");

        _burn(companyAddress, amount);

        _userBalance[userAddress] -= amount;
    }

    function balanceOf(address userAddress) public view override returns (uint256) {
        require(userAddress != address(0), "AGC: can not view zero address");

        if (userAddress == companyAddress) {
            return super.balanceOf(companyAddress);
        }

        return _userBalance[userAddress];
    }

    function transfer(address to, uint256 amount) public pure override returns (bool) {
        revert("transfer is not allowed");
    }

    function transferFrom(address from,address to, uint256 amount) public pure override returns (bool) {
        revert("transferFrom is not allowed");
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}