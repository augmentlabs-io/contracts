// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "./IERC20MintableUpgradeable.sol";
import "./USC.sol";

contract MasterChef is Initializable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20MintableUpgradeable;

    struct UserInfo {
        uint256 amount; // How many staking tokens the user has provided.
        uint256 lastRewardTimestamp; // The last block that the reward was paid
        uint256 accumulatedRewards; // The rewards accumulated.
    }

    IERC20MintableUpgradeable public USCToken;
    IERC20MintableUpgradeable public USDTToken;

    uint256 public totalStaked;
    uint256 public ROIPerYear;

    mapping(address => UserInfo) public userInfo;

    /* ========== EVENTS ========== */
    event Deposit(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20MintableUpgradeable _USCToken,
        IERC20MintableUpgradeable _USDTToken,
        uint256 _roiPerYear
    ) initializer public {
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        USCToken = _USCToken;
        USDTToken = _USDTToken;
        ROIPerYear = _roiPerYear;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // View function to see USC rewards.
    function earnedUSC(address _userAddress) public view returns (uint256) {
        UserInfo storage user = userInfo[_userAddress];

        uint256 secondsInAYear = 365 days;
        uint256 timeDiff = block.timestamp - user.lastRewardTimestamp; // timediff in seconds
        uint256 newRewards = user.amount.mul(ROIPerYear).mul(timeDiff).div(secondsInAYear).div(1e4);

        uint256 totalRewards = user.accumulatedRewards.add(newRewards);

        return totalRewards;
    }

    // Deposit USDT tokens to MasterChef for USC allocation.
    function deposit(uint256 _amount) public whenNotPaused nonReentrant updateReward() {
        require (_amount > 0, "deposit: amount must be larger than 0");

        UserInfo storage user = userInfo[msg.sender];

        USDTToken.safeTransferFrom(msg.sender, address(this), _amount);

        user.amount = user.amount.add(_amount);
        totalStaked = totalStaked.add(_amount);

        emit Deposit(msg.sender, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _amount) public whenNotPaused nonReentrant updateReward() {
        require(_amount > 0, "withdraw: cannot withdraw 0");

        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "withdraw: amount exceeds balance");

        user.amount = user.amount.sub(_amount);
        totalStaked = totalStaked.sub(_amount);

        USDTToken.safeTransfer(msg.sender, _amount);

        emit Withdrawn(msg.sender, _amount);
    }

    function getReward() public whenNotPaused nonReentrant updateReward() {
        UserInfo storage user = userInfo[msg.sender];

        uint256 rewardAmount = user.accumulatedRewards;
        if (rewardAmount == 0) {
            return;
        }

        user.accumulatedRewards = 0;

        // Mint USC tokens to pay for reward
        USCToken.mint(address(this), rewardAmount);

        // Send rewards
        USCToken.safeTransfer(msg.sender, rewardAmount);

        emit RewardPaid(msg.sender, rewardAmount);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}

    /* ========== MODIFIERS ========== */

    modifier updateReward() {
        UserInfo storage user = userInfo[msg.sender];

        user.accumulatedRewards = earnedUSC(msg.sender);
        user.lastRewardTimestamp = block.timestamp;

        _;
    }
}