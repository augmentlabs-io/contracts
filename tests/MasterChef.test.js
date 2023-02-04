const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const {
  loadFixture,
  mine,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber, constants } = require("ethers");
const Dayjs = require("dayjs");

const { calculateRewards } = require("./helpers");
const {
  phase1Fixture,
  MINTER_ROLE,
  SECONDS_A_YEAR,
  MAX_UINT_256,
} = require("./fixtures_2");

describe("MasterChef", function () {
  describe("general info test", function () {
    it("should have correct initializer numbers", async function () {
      const { MasterChef, ROIPerYear } = await loadFixture(phase1Fixture);

      expect(
        (await MasterChef.ROIPerYear()).eq(BigNumber.from(ROIPerYear))
      ).to.be.equal(true, "roi per year should be saved correctly");
    });
  });

  describe("Staking tests", function () {
    it("should throw if user has not approved yet", async function () {
      const { MasterChef, account1 } = await loadFixture(phase1Fixture);

      const depositAmount = BigNumber.from(1000);

      await expect(
        MasterChef.connect(account1).deposit(depositAmount)
      ).to.eventually.rejectedWith("ERC20: insufficient allowance");
    });

    it("should record lp token correctly", async function () {
      const { MasterChef, USDTToken, account1, initialUSTAmount } =
        await loadFixture(phase1Fixture);

      await expect(
        USDTToken.connect(account1).approve(
          MasterChef.address,
          constants.MaxUint256
        )
      ).to.eventually.fulfilled;

      const depositAmount = BigNumber.from(500);

      await expect(MasterChef.connect(account1).deposit(depositAmount)).to
        .eventually.fulfilled;

      const account1Info = await MasterChef.userInfo(account1.address);

      expect(account1Info.amount.eq(depositAmount)).to.be.equal(
        true,
        "account 1 should have lp token recorded correctly"
      );

      const userUSDTAfterDeposit = await USDTToken.balanceOf(account1.address);

      expect(
        userUSDTAfterDeposit.eq(initialUSTAmount.sub(depositAmount))
      ).to.be.equal(true, "user should have balance subtracted correctly");
    });

    it("should yield ROI in a short period correctly", async function () {
      const { MasterChef, owner, account2, USDTToken, ROIPerYear, USCToken } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256
      );

      // note: hardhat automatically uses current timestamp as block.timestamp
      // unless we want to set a higher timestamp, don't set to now.toDate() which will throw an error

      await expect(MasterChef.connect(account2).deposit(depositAmount)).to
        .eventually.fulfilled;

      const currentTx = await time.latest();
      const now = new Dayjs(currentTx * 1000);

      // 1/5 year has passed by from deposit date...
      await time.setNextBlockTimestamp(now.add(73, "days").toDate());

      await mine(1);

      const pendingUSC = await MasterChef.earnedUSC(account2.address);

      const correctRewards = calculateRewards(
        ROIPerYear,
        0,
        depositAmount,
        SECONDS_A_YEAR / 5
      );

      expect(pendingUSC.eq(correctRewards)).to.be.equal(
        true,
        "user should have correct USC rewards"
      );

      // another 1/5 year has passed by from deposit date...
      await time.setNextBlockTimestamp(now.add(73 * 2, "day").toDate());

      await mine(1);

      const pendingUSC2 = await MasterChef.earnedUSC(account2.address);
      const correctRewards2 = calculateRewards(
        ROIPerYear,
        pendingUSC,
        depositAmount,
        SECONDS_A_YEAR / 5
      );

      expect(pendingUSC2.eq(correctRewards2)).to.be.equal(
        true,
        "user should have correct USC rewards"
      );

      await expect(MasterChef.connect(account2).withdraw(depositAmount)).to
        .eventually.fulfilled;

      const pendingUSC3 = await MasterChef.earnedUSC(account2.address);

      await expect(MasterChef.connect(account2).getReward()).to.eventually
        .fulfilled;

      const userUSCBalance = await USCToken.balanceOf(account2.address);

      expect(userUSCBalance.gte(pendingUSC3)).to.be.equal(
        true,
        "user should have been rewarded USC correctly"
      );

      const userUSDTBalance = await USDTToken.balanceOf(account2.address);

      expect(userUSDTBalance.eq(mintAmount)).to.be.equal(
        true,
        "user should have been refunded correctly"
      );
    });

    it("should yield ROI with multiple stakes correctly", async function () {
      const { MasterChef, owner, account2, USDTToken, ROIPerYear } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256
      );

      // deposit 2000 out of 3000 minted
      await expect(MasterChef.connect(account2).deposit(depositAmount)).to
        .eventually.fulfilled;

      const currentTz = await time.latest();
      const now = new Dayjs(currentTz * 1000);

      // 3/5 year has passed by from deposit date...
      await time.setNextBlockTimestamp(now.add(73 * 3, "day").toDate());

      await mine(1);

      // deposit the rest of the money: 1000
      await expect(
        MasterChef.connect(account2).deposit(mintAmount.sub(depositAmount))
      ).to.eventually.fulfilled;

      // 2/5 year has passed by from deposit date...
      await time.setNextBlockTimestamp(
        now.add(365, "day").add(1, "minute").toDate()
      );

      await mine(1);

      const pendingUSC = await MasterChef.earnedUSC(account2.address);
      const correctRewards = calculateRewards(
        ROIPerYear,
        240,
        mintAmount,
        (SECONDS_A_YEAR * 2) / 5
      );

      expect(pendingUSC.eq(correctRewards)).to.be.equal(
        true,
        "user should have correct USC rewards"
      );
    });

    it("should yield ROI if user withdraws partially correctly", async function () {
      const { MasterChef, owner, account2, USDTToken, ROIPerYear } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256
      );

      // deposit 2000
      await expect(MasterChef.connect(account2).deposit(depositAmount)).to
        .eventually.fulfilled;

      const currentTz = await time.latest();
      const now = new Dayjs(currentTz * 1000);

      // 3/5 year has passed by from deposit date...
      await time.setNextBlockTimestamp(now.add(73 * 3, "day").toDate());

      await mine(1);

      // withdraw half of the money: 1000
      await expect(MasterChef.connect(account2).withdraw(BigNumber.from(1000)))
        .to.eventually.fulfilled;

      const userUSDTBalance = await USDTToken.balanceOf(account2.address);
      expect(userUSDTBalance.eq(BigNumber.from(2000))).to.be.equal(
        true,
        "user should withdraw successfully"
      );

      // 2/5 year has passed by from deposit date...
      await time.setNextBlockTimestamp(
        now.add(365, "day").add(1, "minute").toDate()
      );

      await mine(1);

      const pendingUSC = await MasterChef.earnedUSC(account2.address);
      const correctRewards = calculateRewards(
        ROIPerYear,
        240,
        BigNumber.from(1000),
        (SECONDS_A_YEAR * 2) / 5
      );

      expect(pendingUSC.eq(correctRewards)).to.be.equal(
        true,
        "user should have correct USC rewards"
      );
    });

    it("should give 0 rewards if user has not staked yet", async function () {
      const { MasterChef, account2, USDTToken, USCToken } = await loadFixture(
        phase1Fixture
      );

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        MAX_UINT_256
      );

      const now = new Dayjs();

      // 1/5 year has passed by ...
      await time.setNextBlockTimestamp(now.add(73, "days").toDate());

      await mine(1);

      await expect(MasterChef.connect(account2).getReward()).to.eventually
        .fulfilled;

      const userUSCBalance = await USCToken.balanceOf(account2.address);

      expect(userUSCBalance.eq(BigNumber.from(0))).to.be.equal(
        true,
        "user should not have any rewards"
      );
    });

    it("should give rewards intact if user withdraw all tokens", async function () {
      const { MasterChef, owner, account2, USDTToken, ROIPerYear } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256
      );

      // deposit 2000
      await expect(MasterChef.connect(account2).deposit(depositAmount)).to
        .eventually.fulfilled;

      const currentTz = await time.latest();
      const now = new Dayjs(currentTz * 1000);

      // 3/5 year has passed by from deposit date...
      await time.setNextBlockTimestamp(now.add(73 * 3, "day").toDate());

      await mine(1);

      // withdraw all money
      await expect(MasterChef.connect(account2).withdraw(depositAmount)).to
        .eventually.fulfilled;

      const userUSDTBalance = await USDTToken.balanceOf(account2.address);
      expect(userUSDTBalance.eq(mintAmount)).to.be.equal(
        true,
        "user should withdraw successfully"
      );

      // 2/5 year has passed by from deposit date...
      await time.setNextBlockTimestamp(
        now.add(365, "day").add(1, "minute").toDate()
      );

      await mine(1);

      const pendingUSC = await MasterChef.earnedUSC(account2.address);
      const correctRewards = calculateRewards(
        ROIPerYear,
        240,
        0,
        (SECONDS_A_YEAR * 2) / 5
      );

      expect(correctRewards.eq(BigNumber.from(240))).to.be.true;

      expect(pendingUSC.eq(correctRewards)).to.be.equal(
        true,
        "user should have correct USC rewards"
      );
    });
  });

  describe("rewards calculation", function () {
    it("should calculate rewards correctly if deposit 1 year", async function () {
      const { ROIPerYear } = await loadFixture(phase1Fixture);

      // ROI is 20%
      const rewards = calculateRewards(ROIPerYear, 0, 2000, SECONDS_A_YEAR);

      expect(rewards.eq(BigNumber.from(400))).to.be.equal(
        true,
        "roi should be calculated correctly"
      );
    });

    it("should calculate rewards correctly if deposit less than a year 1", async function () {
      const { ROIPerYear } = await loadFixture(phase1Fixture);

      const threeMonthDeposit = BigNumber.from(SECONDS_A_YEAR).div(
        BigNumber.from(4)
      );

      // ROI is 20%
      const rewards = calculateRewards(
        ROIPerYear,
        1000,
        10000,
        threeMonthDeposit
      );

      expect(
        rewards.eq(BigNumber.from(1000).add(BigNumber.from(500)))
      ).to.be.equal(true, "roi should be calculated correctly");
    });

    it("should calculate rewards correctly if deposit less than a year 2", async function () {
      const { ROIPerYear } = await loadFixture(phase1Fixture);

      const fourMonthDeposit = BigNumber.from(SECONDS_A_YEAR).div(
        BigNumber.from(3)
      );

      // ROI is 20%
      const rewards = calculateRewards(
        ROIPerYear,
        1000,
        10000,
        fourMonthDeposit
      );

      expect(
        rewards.eq(BigNumber.from(1000).add(BigNumber.from(666)))
      ).to.be.equal(true, "roi should be calculated correctly");
    });
  });

  describe("security", function () {
    it("should be able to pause and unpauses by owner", async function () {
      const { MasterChef, multisig, account1, USDTToken } = await loadFixture(
        phase1Fixture
      );

      await expect(MasterChef.connect(multisig).pause()).to.eventually
        .fulfilled;

      await expect(
        MasterChef.connect(multisig).deposit(1000)
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(
        MasterChef.connect(account1).getReward()
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(
        MasterChef.connect(account1).unpause()
      ).to.eventually.rejectedWith("Ownable: caller is not the owner");

      await expect(MasterChef.connect(multisig).unpause()).to.eventually
        .fulfilled;

      await USDTToken.connect(account1).approve(
        MasterChef.address,
        MAX_UINT_256
      );

      await expect(MasterChef.connect(account1).deposit(1000)).to.eventually
        .fulfilled;
    });

    it("should throw if non-owner tries to pause", async function () {
      const { MasterChef, account1 } = await loadFixture(phase1Fixture);

      await expect(
        MasterChef.connect(account1).pause()
      ).to.eventually.rejectedWith("Ownable: caller is not the owner");
    });

    it("should be able to mint USC", async function () {
      const { MasterChef, USCToken } = await loadFixture(phase1Fixture);

      const masterChefHasMinterRole = await USCToken.hasRole(
        MINTER_ROLE,
        MasterChef.address
      );

      expect(masterChefHasMinterRole).to.be.equal(
        true,
        "masterchef should have minter role"
      );
    });
  });

  describe("errors", function () {
    it("should throw if deposit 0", async function () {
      const { MasterChef, account2 } = await loadFixture(phase1Fixture);

      await expect(
        MasterChef.connect(account2).deposit(0)
      ).to.eventually.rejectedWith("deposit: amount must be larger than 0");
    });

    it("should throw if withdraw 0", async function () {
      const { MasterChef, account2 } = await loadFixture(phase1Fixture);

      await expect(
        MasterChef.connect(account2).withdraw(0)
      ).to.eventually.rejectedWith("withdraw: cannot withdraw 0");
    });

    it("should throw if user has insufficient balance", async function () {
      const { MasterChef, owner, account2, USDTToken } = await loadFixture(
        phase1Fixture
      );

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        MAX_UINT_256
      );

      await expect(
        MasterChef.connect(account2).deposit(10000)
      ).to.eventually.rejectedWith("ERC20: transfer amount exceeds balance");
    });

    it("should throw if user withdraw more than staked", async function () {
      const { MasterChef, account2 } = await loadFixture(phase1Fixture);

      await expect(
        MasterChef.connect(account2).withdraw(10000)
      ).to.eventually.rejectedWith("withdraw: amount exceeds balance");
    });

    it("should throw error if user has not approved yet", async function () {
      const { MasterChef, owner, account2, USDTToken } = await loadFixture(
        phase1Fixture
      );

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await expect(
        MasterChef.connect(account2).deposit(depositAmount)
      ).to.eventually.rejectedWith("ERC20: insufficient allowance");
    });

    it("should throw if user withdraw more than balance", async function () {
      const { MasterChef, owner, account2, USDTToken } = await loadFixture(
        phase1Fixture
      );

      const mintAmount = BigNumber.from(3000);
      const depositAmount = BigNumber.from(2000);
      const withdrawAmount = BigNumber.from(5000);

      await USDTToken.connect(owner).mint(account2.address, mintAmount);

      await USDTToken.connect(account2).approve(
        MasterChef.address,
        constants.MaxUint256
      );

      await expect(MasterChef.connect(account2).deposit(depositAmount)).to
        .eventually.fulfilled;

      // This is a long period
      await mine(1000);

      await expect(
        MasterChef.connect(account2).withdraw(withdrawAmount)
      ).to.eventually.rejectedWith("withdraw: amount exceeds balance");
    });
  });
});
