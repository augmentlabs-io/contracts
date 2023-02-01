const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { phase1Fixture } = require("./fixtures_2");
const { MINTER_ROLE, PAUSER_ROLE } = require("./fixtures_2");

describe("Upgradable USC token", function () {
  describe("Happy path", function () {
    it("Should have correct name and symbol", async function () {
      const { USCToken } = await loadFixture(phase1Fixture);

      const tokenName = await USCToken.name();
      const tokenSymbol = await USCToken.symbol();

      expect(tokenName).to.equal("USC", "token name should be USC");
      expect(tokenSymbol).to.equal("USC", "token symbol should be USC");
    });

    it("Should be able to mint", async function () {
      const { USCToken, account1, multisig, initialUSCAmount } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(1000);

      await USCToken.connect(multisig).mint(account1.address, mintAmount);

      const account1Balance = await USCToken.balanceOf(account1.address);

      expect(mintAmount.add(initialUSCAmount).eq(account1Balance)).to.equal(
        true,
        "account 1 should receive minted balance"
      );
    });
  });

  describe("urgent cases", function () {
    it("should allow multisig to pause and un-pause", async function () {
      const { USCToken, account1, multisig } = await loadFixture(phase1Fixture);

      await expect(USCToken.connect(multisig).pause()).to.eventually.fulfilled;

      await expect(
        USCToken.connect(multisig).mint(account1.address, BigNumber.from(1000))
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(USCToken.connect(multisig).unpause()).to.eventually
        .fulfilled;

      await expect(
        USCToken.connect(multisig).mint(account1.address, BigNumber.from(1000))
      ).to.eventually.fulfilled;
    });

    it("should forbid unauthorized pausing", async function () {
      const { USCToken, account1 } = await loadFixture(phase1Fixture);

      await expect(
        USCToken.connect(account1).pause()
      ).to.eventually.rejectedWith("AccessControl:");
    });

    it("should forbid previous owner if revoked from pausing", async function () {
      const {
        USCToken,
        account1,
        owner: previousOwner,
      } = await loadFixture(phase1Fixture);

      await USCToken.connect(previousOwner).renounceRole(
        PAUSER_ROLE,
        previousOwner.address
      );

      await expect(
        USCToken.connect(account1).pause()
      ).to.eventually.rejectedWith("AccessControl:");
    });
  });

  describe("Security checks", function () {
    it("should be able to pause and unpauses by owner", async function () {
      const { USCToken, multisig, account1, owner, account2 } =
        await loadFixture(phase1Fixture);

      await expect(USCToken.connect(multisig).pause()).to.eventually.fulfilled;

      await expect(
        USCToken.connect(multisig).mint(account2.address, 1000)
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(
        USCToken.connect(account2).mint(account2.address, 1000)
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(
        USCToken.connect(account2).unpause()
      ).to.eventually.rejectedWith("AccessControl:");

      await expect(USCToken.connect(multisig).unpause()).to.eventually
        .fulfilled;

      await expect(USCToken.connect(multisig).mint(account2.address, 1000)).to
        .eventually.fulfilled;
    });

    it("should throw if non-owner tries to pause", async function () {
      const { USCToken, account1 } = await loadFixture(phase1Fixture);

      await expect(
        USCToken.connect(account1).pause()
      ).to.eventually.rejectedWith("AccessControl:");
    });

    it("succeeds if multisig tries to mint", async function () {
      const { USCToken, multisig, account1, initialUSCAmount } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(1000);

      await expect(
        USCToken.connect(multisig).mint(account1.address, mintAmount)
      ).to.eventually.fulfilled;

      const account1Balance = await USCToken.balanceOf(account1.address);
      expect(account1Balance.eq(mintAmount.add(initialUSCAmount))).to.be.equal(
        true,
        "mintee should have correct balance"
      );
    });

    it("fails if previous owner try to mint after revoke", async function () {
      const { USCToken, owner, account2, multisig } = await loadFixture(
        phase1Fixture
      );

      await expect(
        USCToken.connect(multisig).revokeRole(MINTER_ROLE, owner.address)
      ).to.eventually.fulfilled;

      await expect(USCToken.connect(owner).mint(account2.address, 1000)).to
        .eventually.rejected;
    });

    it("fails if non-owner try to mint", async function () {
      const { USCToken, account1, account2 } = await loadFixture(phase1Fixture);

      await expect(
        USCToken.connect(account1).mint(account2.address, 1000)
      ).to.eventually.rejectedWith("AccessControl:");
    });
  });
});
