// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./USC.sol";

contract MasterChef is Initializable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 entranceBlock; // Block number when user enters the pool
        uint256 lastRewardBlock; // The last block that the reward was paid
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 multiplier;
        uint256 rewardLockupBlock; // The number of blocks must be passed for the reward to be paid
        bool isActive; // If false then can't yield any rewards
    }

    // The USC Token!
    USC public USCToken;

    // Info of each pool.
    PoolInfo[] public poolInfo;

    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Pool Exists Mapper
    mapping(IERC20 => bool) public poolExistence;
    // Pool ID Tracker Mapper
    mapping(IERC20 => uint256) public poolIdForLpAddress;

    // ROI per year.
    uint256 public ROIPerYear;
    uint256 public blockPerYear;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event ROIUpdated(address indexed caller, uint256 previousAmount, uint256 newAmount);
    event PoolAdded(address indexed caller, address lpToken, uint256 multiplier, uint256 lockupBlock);
    event PoolUpdated(address indexed caller, uint256 pid, uint256 multiplier, uint256 lockupBlock);
    event PoolDeactivated(address indexed caller, uint256 pid);
    event PoolActivated(address indexed caller, uint256 pid);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        USC _USCToken,
        uint256 _roiPerYear,
        uint256 _blockPerYear
    ) initializer public {
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        USCToken = _USCToken;
        ROIPerYear = _roiPerYear;
        blockPerYear = _blockPerYear;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}

    function setROIPerYear(uint256 _newRoiPerYear) public onlyOwner whenNotPaused {
        uint256 _previousAmount = ROIPerYear;
        ROIPerYear = _newRoiPerYear;

        emit ROIUpdated(owner(), _previousAmount, _newRoiPerYear);
    }

    // Get number of pools added.
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function getPoolIdForLpToken(IERC20 _lpToken) external view returns (uint256) {
        require(poolExistence[_lpToken] != false, "getPoolIdForLpToken: do not exist");
        return poolIdForLpAddress[_lpToken];
    }

    // Modifier to check Duplicate pools
    modifier nonDuplicated(IERC20 _lpToken) {
        require(poolExistence[_lpToken] == false, "nonDuplicated: duplicated");
        _;
    }

    modifier onlyActivePool(uint256 _pid) {
        PoolInfo storage pool = poolInfo[_pid];

        require (pool.isActive, "pool guard: pool is inactive");
        _;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    function add(
        IERC20 _lpToken,
        uint256 _multiplier,
        uint256 _lockupBlock
    ) public onlyOwner whenNotPaused nonDuplicated(_lpToken) {
        poolExistence[_lpToken] = true;

        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                multiplier: _multiplier,
                rewardLockupBlock: _lockupBlock,
                isActive: true
            })
        );

        poolIdForLpAddress[_lpToken] = poolInfo.length - 1;

        emit PoolAdded(owner(), address(_lpToken), _multiplier, _lockupBlock);
    }

    // Update the given pool's data. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _multiplier,
        uint256 _lockupBlock
    ) public onlyOwner whenNotPaused onlyActivePool(_pid) {
        poolInfo[_pid].rewardLockupBlock = _lockupBlock;
        poolInfo[_pid].multiplier = _multiplier;

        emit PoolUpdated(owner(), _pid, _multiplier, _lockupBlock);
    }

    function deactivatePool(uint256 _pid) public onlyOwner {
        poolInfo[_pid].isActive = false;

        emit PoolDeactivated(owner(), _pid);
    }

    function activatePool(uint256 _pid) public onlyOwner {
        poolInfo[_pid].isActive = true;

        emit PoolActivated(owner(), _pid);
    }

    function viewUserInfo(uint256 _pid, address _user) external view returns (UserInfo memory) {
        return userInfo[_pid][_user];
    }

    // View function to see pending USCs on frontend.
    function pendingUSC(uint256 _pid, address _user) public view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];

        uint256 blockDiff = block.number - user.lastRewardBlock;
        uint256 reward = user.amount * pool.multiplier * ROIPerYear * blockDiff / (blockPerYear * 10000);

        return reward;
    }

    function canClaimRewards(uint256 _pid, address _user) public view whenNotPaused onlyActivePool(_pid) returns (bool) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];

        require(user.entranceBlock > 0, "canClaimRewards: user has not entered pool");

        return block.number >= user.entranceBlock + pool.rewardLockupBlock;
    }

    // Deposit LP tokens to MasterChef for USC allocation with referral.
    function deposit(uint256 _pid, uint256 _amount) public nonReentrant whenNotPaused onlyActivePool(_pid) {
        require (_amount > 0, "deposit: amount must be larger than 0");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        pool.lpToken.transferFrom(msg.sender, address(this), _amount);

        // User's first time staking
        if (user.entranceBlock == 0) {
            user.entranceBlock = block.number;
            user.lastRewardBlock = block.number;
        }

        user.amount += _amount;

        emit Deposit(msg.sender, _pid, _amount);
    }

    // Pay USC as reward
    function tryPayUSC(uint256 _pid) internal {
        UserInfo storage user = userInfo[_pid][msg.sender];

        if (!canClaimRewards(_pid, msg.sender)) {
            return;
        }

        uint256 rewardAmount = pendingUSC(_pid, msg.sender);

        if (rewardAmount == 0) {
            return;
        }

        user.lastRewardBlock = block.number;

        // Mint USC tokens to pay for reward
        USCToken.mint(address(this), rewardAmount);

        // send rewards
        safeUSCTransfer(msg.sender, rewardAmount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant onlyActivePool(_pid) whenNotPaused {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, "withdraw: amount exceeds balance");

        tryPayUSC(_pid);

        if (_amount > 0) {
            user.amount -= _amount;
            pool.lpToken.transfer(msg.sender, _amount);
        }

        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Safe USC transfer function, just in case if rounding error causes pool to not have enough USC.
    function safeUSCTransfer(address _to, uint256 _amount) internal {
        uint256 uscBalance = USCToken.balanceOf(address(this));
        bool transferSuccess = false;

        if (_amount > uscBalance) {
            transferSuccess = USCToken.transfer(_to, uscBalance);
        } else {
            transferSuccess = USCToken.transfer(_to, _amount);
        }

        require(transferSuccess, "safeUSCTransfer: transfer failed.");
    }
}
