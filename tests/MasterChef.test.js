const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const {
  loadFixture,
  mine,
} = require('@nomicfoundation/hardhat-network-helpers');
const { expect } = require('chai');
const { BigNumber, constants } = require('ethers');

const { calculateRewards } = require('./helpers');
const { phase1Fixture, MINTER_ROLE } = require('./fixtures_2');
const { ethers } = require('hardhat');

describe('MasterChef', function () {
  describe('general info test', function () {
    it('should have correct initializer numbers', async function () {
      const { MasterChef, blockPerYear, ROIPerYear } = await loadFixture(
        phase1Fixture,
      );

      expect(
        (await MasterChef.ROIPerYear()).eq(BigNumber.from(ROIPerYear)),
      ).to.be.equal(true, 'roi per year should be saved correctly');

      expect(
        (await MasterChef.blockPerYear()).eq(BigNumber.from(blockPerYear)),
      ).to.be.equal(true, 'block per year should be saved correctly');
    });
  });

  describe('Pool tests', function () {
    it('should have UST pool', async function () {
      const { MasterChef, USDTToken } = await loadFixture(phase1Fixture);

      const isUstPoolExist = await MasterChef.poolExistence(USDTToken.address);

      expect(isUstPoolExist).to.be.equal(true, 'ust pool should be exist');

      const poolID = await MasterChef.poolIdForLpAddress(USDTToken.address);

      expect(poolID.eq(BigNumber.from(0))).to.be.equal(
        true,
        'ust should be first pool',
      );
    });

    it('should throw if user has not approved yet', async function () {
      const { MasterChef, account1 } = await loadFixture(phase1Fixture);

      const depositAmount = BigNumber.from(1000);

      await expect(
        MasterChef.connect(account1).deposit(0, depositAmount),
      ).to.eventually.rejectedWith();
    });

    it('should record lp token correctly', async function () {
      const { MasterChef, USDTToken, account1 } = await loadFixture(
        phase1Fixture,
      );

      await expect(
        USDTToken.connect(account1).approve(
          MasterChef.address,
          constants.MaxUint256,
        ),
      ).to.eventually.fulfilled;

      const depositAmount = BigNumber.from(500);

      await expect(MasterChef.connect(account1).deposit(0, depositAmount)).to
        .eventually.fulfilled;

      const account1Info = await MasterChef.viewUserInfo(0, account1.address);

      expect(account1Info.amount.eq(depositAmount)).to.be.equal(
        true,
        'account 1 should have lp token recorded correctly',
      );
    });

    it('should lockup rewards properly', async function () {
      const { MasterChef, account1, blockPerDay, USDTPoolIndex, USDTToken } =
        await loadFixture(phase1Fixture);

      const depositAmount = BigNumber.from(1000);

      await USDTToken.connect(account1).approve(
        MasterChef.address,
        constants.MaxUint256,
      );

      await MasterChef.connect(account1).deposit(USDTPoolIndex, depositAmount);

      await mine(blockPerDay - 200);

      const canClaimRewardsBefore = await MasterChef.canClaimRewards(
        USDTPoolIndex,
        account1.address,
      );

      expect(canClaimRewardsBefore).to.be.equal(
        false,
        'account 1 should not be able to claim reward before lockup block',
      );

      await mine(200);

      const canClaimRewardsAfter = await MasterChef.canClaimRewards(
        0,
        account1.address,
      );
      expect(canClaimRewardsAfter).to.be.equal(
        true,
        'account 1 should be able to claim rewards',
      );
    });

    it('should yield ROI in a short period correctly', async function () {
      const {
        MasterChef,
        owner,
        blockPerDay,
        account2,
        USDTToken,
        USCToken,
        USDTPoolIndex,
      } = await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256,
      );

      await expect(
        MasterChef.connect(account2).deposit(USDTPoolIndex, depositAmount),
      ).to.eventually.fulfilled;

      const userUSDTAfterDeposit = await USDTToken.balanceOf(account2.address);

      expect(
        userUSDTAfterDeposit.eq(mintAmount.sub(depositAmount)),
      ).to.be.equal(true, 'user should have balance subtracted correctly');

      const canClaimRewardsBefore = await MasterChef.canClaimRewards(
        USDTPoolIndex,
        account2.address,
      );

      expect(canClaimRewardsBefore).to.be.equal(
        false,
        'should not be able to claim rewards yet',
      );

      await mine(blockPerDay);

      const canClaimRewardsAfter = await MasterChef.canClaimRewards(
        USDTPoolIndex,
        account2.address,
      );

      expect(canClaimRewardsAfter).to.be.equal(
        true,
        'should be able to claim rewards',
      );

      const pendingUSC = await MasterChef.pendingUSC(
        USDTPoolIndex,
        account2.address,
      );

      expect(pendingUSC.gt(BigNumber.from(0))).to.be.equal(
        true,
        'user should have non zero rewards',
      );

      await expect(
        MasterChef.connect(account2).withdraw(USDTPoolIndex, depositAmount),
      ).to.eventually.fulfilled;

      const userUSCBalance = await USCToken.balanceOf(account2.address);

      expect(userUSCBalance.eq(pendingUSC)).to.be.equal(
        true,
        'user should have been rewarded USC',
      );

      const userUSDTBalance = await USDTToken.balanceOf(account2.address);

      expect(userUSDTBalance.eq(mintAmount)).to.be.equal(
        true,
        'user should have been refunded correctly',
      );
    });

    it('should yield ROI in a long period correctly', async function () {
      const {
        MasterChef,
        owner,
        account2,
        blockPerYear,
        USDTToken,
        USCToken,
        USDTPoolIndex,
      } = await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256,
      );

      await expect(
        MasterChef.connect(account2).deposit(USDTPoolIndex, depositAmount),
      ).to.eventually.fulfilled;

      // This is a long period
      await mine(BigNumber.from(blockPerYear).div(BigNumber.from(4)));

      await expect(
        MasterChef.connect(account2).withdraw(USDTPoolIndex, depositAmount),
      ).to.eventually.fulfilled;

      const userUSCBalance = await USCToken.balanceOf(account2.address);

      expect(userUSCBalance.eq(BigNumber.from(100))).to.be.equal(
        true,
        'user should have been rewarded USC correctly',
      );
    });

    it('should yield ROI in a long period correctly 2', async function () {
      const {
        MasterChef,
        owner,
        account2,
        blockPerYear,
        USDTToken,
        USCToken,
        USDTPoolIndex,
      } = await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256,
      );

      await expect(
        MasterChef.connect(account2).deposit(USDTPoolIndex, depositAmount),
      ).to.eventually.fulfilled;

      // This is a long period
      await mine(BigNumber.from(blockPerYear).div(BigNumber.from(2)));

      await expect(
        MasterChef.connect(account2).withdraw(USDTPoolIndex, depositAmount),
      ).to.eventually.fulfilled;

      const userUSCBalance = await USCToken.balanceOf(account2.address);

      expect(userUSCBalance.eq(BigNumber.from(200))).to.be.equal(
        true,
        'user should have been rewarded USC correctly',
      );
    });

    it('should yield ROI if user withdraws partially correctly', async function () {
      const {
        MasterChef,
        owner,
        account2,
        blockPerYear,
        USDTToken,
        USCToken,
        USDTPoolIndex,
      } = await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);
      const withdrawAmount = BigNumber.from(1000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256,
      );

      await expect(
        MasterChef.connect(account2).deposit(USDTPoolIndex, depositAmount),
      ).to.eventually.fulfilled;

      // This is a long period
      await mine(BigNumber.from(blockPerYear).div(BigNumber.from(3)));

      await expect(
        MasterChef.connect(account2).withdraw(USDTPoolIndex, withdrawAmount),
      ).to.eventually.fulfilled;

      const userUSCBalance = await USCToken.balanceOf(account2.address);

      expect(userUSCBalance.eq(BigNumber.from(133))).to.be.equal(
        true,
        'user should have been rewarded USC correctly',
      );

      const userPoolInfo = await MasterChef.viewUserInfo(
        USDTPoolIndex,
        account2.address,
      );

      expect(
        userPoolInfo.amount.eq(depositAmount.sub(withdrawAmount)),
      ).to.be.equal(true, 'user should still have balance');

      await mine(BigNumber.from(blockPerYear).div(4));

      const pendingUSC = await MasterChef.pendingUSC(
        USDTPoolIndex,
        account2.address,
      );

      expect(pendingUSC.eq(BigNumber.from(50))).to.be.equal(
        true,
        'user should still have rewards after deposit',
      );
    });
  });

  describe('rewards calculation', function () {
    it('should calculate rewards correctly if deposit 1 year', async function () {
      const { blockPerYear } = await loadFixture(phase1Fixture);

      // ROI is 20%
      const rewards = calculateRewards(2000, 2000, blockPerYear, blockPerYear);

      expect(rewards.eq(BigNumber.from(2400))).to.be.equal(
        true,
        'roi should be calculated correctly',
      );
    });

    it('should calculate rewards correctly if deposit less than a year 1', async function () {
      const { blockPerYear, ROIPerYear } = await loadFixture(phase1Fixture);

      const threeMonthDeposit = BigNumber.from(blockPerYear).div(
        BigNumber.from(4),
      );

      // ROI is 20%
      const rewards = calculateRewards(
        2000,
        ROIPerYear,
        threeMonthDeposit,
        blockPerYear,
      );

      expect(rewards.eq(BigNumber.from(2100))).to.be.equal(
        true,
        'roi should be calculated correctly',
      );
    });

    it('should calculate rewards correctly if deposit less than a year 2', async function () {
      const { ROIPerYear, blockPerYear } = await loadFixture(phase1Fixture);

      const fourMonthDeposit = BigNumber.from(blockPerYear).div(
        BigNumber.from(3),
      );

      // ROI is 20%
      const rewards = calculateRewards(
        2000,
        ROIPerYear,
        fourMonthDeposit,
        blockPerYear,
      );

      expect(rewards.eq(BigNumber.from(2133))).to.be.equal(
        true,
        'roi should be calculated correctly',
      );
    });
  });

  describe('security', function () {
    it('only owner can set new roi', async function () {
      const { MasterChef, account1, multisig } = await loadFixture(
        phase1Fixture,
      );

      // set new roi to 30%
      await expect(MasterChef.connect(multisig).setROIPerYear(3000)).to
        .eventually.to.fulfilled;

      await expect(
        MasterChef.connect(account1).setROIPerYear(4000),
      ).to.eventually.to.rejectedWith('Ownable: caller is not the owner');
    });

    it('should be able to mint USC', async function () {
      const { MasterChef, USCToken } = await loadFixture(phase1Fixture);

      const masterChefHasMinterRole = await USCToken.hasRole(
        MINTER_ROLE,
        MasterChef.address,
      );

      expect(masterChefHasMinterRole).to.be.equal(
        true,
        'masterchef should have minter role',
      );
    });

    it('does not allow non-owner to add new pool', async function () {
      const { MasterChef, USDTToken, account1 } = await loadFixture(
        phase1Fixture,
      );

      await expect(
        MasterChef.connect(account1).add(USDTToken.address, 1, 1000),
      ).to.eventually.rejectedWith('Ownable: caller is not the owner');
    });
  });

  describe('errors', function () {
    it('should throw error if user has not approved yet', async function () {
      const {
        MasterChef,
        owner,
        account2,
        blockPerYear,
        USDTToken,
        USCToken,
        USDTPoolIndex,
      } = await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await expect(
        MasterChef.connect(account2).deposit(USDTPoolIndex, depositAmount),
      ).to.eventually.rejectedWith('ERC20: insufficient allowance');
    });

    it('should throw if user withdraw more than balance', async function () {
      const {
        MasterChef,
        owner,
        account2,
        blockPerYear,
        USDTToken,
        USCToken,
        USDTPoolIndex,
      } = await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);
      const withdrawAmount = BigNumber.from(1000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256,
      );

      await expect(
        MasterChef.connect(account2).deposit(USDTPoolIndex, depositAmount),
      ).to.eventually.fulfilled;

      // This is a long period
      await mine(BigNumber.from(blockPerYear).div(BigNumber.from(3)));

      await expect(
        MasterChef.connect(account2).withdraw(
          USDTPoolIndex,
          BigNumber.from(5000),
        ),
      ).to.eventually.rejectedWith('withdraw: amount exceeds balance');
    });
  });
});
