const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { phase1Fixture, REDEEMER_ROLE, MAX_UINT_256 } = require("./fixtures_2");
const { ethers } = require("hardhat");

describe("Token Controller", function () {
  describe("Happy path", function () {
    it("should redeem AGC using owner account correctly", async function () {
      const {
        tokenController,
        owner,
        account1,
        AGCToken,
        USCToken,
        initialAGCAmount,
        initialUSCAmount,
      } = await loadFixture(phase1Fixture);

      const redeemAmount = BigNumber.from(300);
      const mintAmount = BigNumber.from(600);

      // Perform the redeem
      await tokenController
        .connect(owner)
        .redeemAGC(account1.address, redeemAmount, mintAmount);

      const account1USC = await USCToken.balanceOf(account1.address);
      expect(account1USC.eq(mintAmount.add(initialUSCAmount))).to.be.equal(
        true,
        "account1 USC balance should be correct after redeem"
      );

      const account1AGCAfterRedeem = await AGCToken.balanceOf(account1.address);

      expect(
        account1AGCAfterRedeem.eq(initialAGCAmount.sub(redeemAmount))
      ).to.be.equal(
        true,
        "account1 AGC balance should be correct after redeem"
      );
    });

    it("should redeem AGC using multisig account correctly", async function () {
      const {
        tokenController,
        account1,
        multisig,
        AGCToken,
        USCToken,
        initialAGCAmount,
        initialUSCAmount,
      } = await loadFixture(phase1Fixture);

      const redeemAmount = BigNumber.from(300);
      const mintAmount = BigNumber.from(600);

      // Perform the redeem
      await tokenController
        .connect(multisig)
        .redeemAGC(account1.address, redeemAmount, mintAmount);

      const account1USC = await USCToken.balanceOf(account1.address);
      expect(account1USC.eq(mintAmount.add(initialUSCAmount))).to.be.equal(
        true,
        "account1 USC balance should be correct after redeem"
      );

      const account1AGCAfterRedeem = await AGCToken.balanceOf(account1.address);

      expect(
        account1AGCAfterRedeem.eq(initialAGCAmount.sub(redeemAmount))
      ).to.be.equal(
        true,
        "account1 AGC balance should be correct after redeem"
      );
    });

    it("should redeem USC using API correctly", async function () {
      const {
        tokenController,
        account1,
        AGCToken,
        USCToken,
        initialAGCAmount,
        initialUSCAmount,
      } = await loadFixture(phase1Fixture);

      const redeemAmount = BigNumber.from(300);
      const mintAmount = BigNumber.from(150);

      await USCToken.connect(account1).approve(
        tokenController.address,
        MAX_UINT_256
      );

      // Perform the redeem
      await tokenController.redeemUSC(
        account1.address,
        redeemAmount,
        mintAmount
      );

      const account1AGC = await AGCToken.balanceOf(account1.address);

      expect(account1AGC.eq(initialAGCAmount.add(mintAmount))).to.be.equal(
        true,
        "account1 AGC balance after redeem should be correct"
      );

      const account1USCAfterRedeem = await USCToken.balanceOf(account1.address);

      expect(
        account1USCAfterRedeem.eq(initialUSCAmount.sub(redeemAmount))
      ).to.be.equal(
        true,
        "account 1 USC balance after redeem should be correct"
      );
    });
  });

  describe("Error cases", function () {
    it("should throw error if controller does not have enough usc allowance", async function () {
      // account1 is having 1000 USC
      const { tokenController, account1, USCToken, owner } = await loadFixture(
        phase1Fixture
      );

      // redeem 1000 USC
      await expect(
        tokenController.redeemUSC(
          account1.address,
          BigNumber.from(1000),
          BigNumber.from(2000)
        )
      ).to.eventually.rejectedWith(
        "TokenController: insufficient USC allowance for burning"
      );
    });

    it("should throw error if user didnt have enough AGC balance", async function () {
      // account1 is having 1000 AGC
      const { tokenController, account1, multisig } = await loadFixture(
        phase1Fixture
      );

      await expect(
        tokenController
          .connect(multisig)
          .redeemAGC(
            account1.address,
            BigNumber.from(2000),
            BigNumber.from(4000)
          )
      ).to.eventually.rejectedWith("TokenController: insufficient AGC balance");
    });

    it("should throw error if user didnt have enough USC balance", async function () {
      // account1 is having 1000 AGC
      const { tokenController, account1, multisig, USCToken } =
        await loadFixture(phase1Fixture);

      await USCToken.connect(account1).approve(
        tokenController.address,
        MAX_UINT_256
      );

      await expect(
        tokenController
          .connect(multisig)
          .redeemUSC(
            account1.address,
            BigNumber.from(2000),
            BigNumber.from(4000)
          )
      ).to.eventually.rejectedWith("TokenController: insufficient USC balance");
    });
  });

  describe("Security checks", function () {
    it("should be able to pause and unpauses by owner", async function () {
      const { tokenController, multisig, account2, owner } = await loadFixture(
        phase1Fixture
      );

      await expect(tokenController.connect(multisig).pause()).to.eventually
        .fulfilled;

      await expect(
        tokenController
          .connect(multisig)
          .redeemAGC(account2.address, 1000, 1000)
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(
        tokenController
          .connect(multisig)
          .redeemUSC(account2.address, 1000, 1000)
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(
        tokenController.connect(owner).redeemAGC(account2.address, 1000, 1000)
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(
        tokenController.connect(owner).redeemUSC(account2.address, 1000, 1000)
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(tokenController.connect(multisig).unpause()).to.eventually
        .fulfilled;
    });

    it("should throw if non-owner tries to pause", async function () {
      const { tokenController, account1 } = await loadFixture(phase1Fixture);

      await expect(
        tokenController.connect(account1).pause()
      ).to.eventually.rejectedWith("AccessControl:");
    });

    it("should not allow anonymous user to redeem", async function () {
      const { tokenController, account1 } = await loadFixture(phase1Fixture);

      await expect(
        tokenController
          .connect(account1)
          .redeemAGC(
            account1.address,
            BigNumber.from(2000),
            BigNumber.from(4000)
          )
      ).to.eventually.rejected;

      await expect(
        tokenController
          .connect(account1)
          .redeemUSC(
            account1.address,
            BigNumber.from(2000),
            BigNumber.from(4000)
          )
      ).to.eventually.rejected;
    });

    it("should allow new minter to redeem", async function () {
      const { tokenController, account1, multisig, account2 } =
        await loadFixture(phase1Fixture);

      await tokenController
        .connect(multisig)
        .grantRole(REDEEMER_ROLE, account2.address);

      const redeemAmount = BigNumber.from(500);
      const mintAmount = redeemAmount;

      await expect(
        tokenController
          .connect(account2)
          .redeemAGC(account1.address, redeemAmount, mintAmount)
      ).to.eventually.fulfilled;
    });
  });

  describe("errors", function () {
    it("throws if redeemAGC with incorrect params", async function () {
      const { tokenController, account1, owner } = await loadFixture(
        phase1Fixture
      );

      const redeemAmount = 1000;
      const mintAmount = 2000;

      await expect(
        tokenController
          .connect(owner)
          .redeemAGC(ethers.constants.AddressZero, redeemAmount, mintAmount)
      ).to.eventually.rejectedWith(
        "TokenController: cannot redeem for zero address"
      );

      await expect(
        tokenController
          .connect(owner)
          .redeemAGC(account1.address, 0, mintAmount)
      ).to.eventually.rejectedWith(
        "TokenController: AGC amount must be larger than 0"
      );

      await expect(
        tokenController
          .connect(owner)
          .redeemAGC(account1.address, redeemAmount, 0)
      ).to.eventually.rejectedWith(
        "TokenController: USC amount must be larger than 0"
      );
    });

    it("throws if redeemUSC with incorrect params", async function () {
      const { tokenController, account1, owner } = await loadFixture(
        phase1Fixture
      );

      const redeemAmount = 1000;
      const mintAmount = 2000;

      await expect(
        tokenController
          .connect(owner)
          .redeemUSC(ethers.constants.AddressZero, redeemAmount, mintAmount)
      ).to.eventually.rejectedWith(
        "TokenController: cannot redeem for zero address"
      );

      await expect(
        tokenController
          .connect(owner)
          .redeemUSC(account1.address, 0, mintAmount)
      ).to.eventually.rejectedWith(
        "TokenController: USC amount must be larger than 0"
      );

      await expect(
        tokenController
          .connect(owner)
          .redeemUSC(account1.address, redeemAmount, 0)
      ).to.eventually.rejectedWith(
        "TokenController: AGC amount must be larger than 0"
      );
    });
  });
});
