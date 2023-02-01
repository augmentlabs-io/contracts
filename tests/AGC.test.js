const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber, ethers } = require("ethers");

const { MINTER_ROLE, PAUSER_ROLE } = require("./fixtures_2");
const { phase1Fixture } = require("./fixtures_2");

describe("Upgradable AGC token", function () {
  describe("Happy path", function () {
    it("Should have correct name and symbol", async function () {
      const { AGCToken } = await loadFixture(phase1Fixture);

      const tokenName = await AGCToken.name();
      const tokenSymbol = await AGCToken.symbol();

      expect(tokenName).to.equal("AGC", "token name should be AGC");
      expect(tokenSymbol).to.equal("AGC", "token symbol should be AGC");
    });

    it("should allow multisig to mint", async function () {
      const { AGCToken, account1, multisig, initialAGCAmount, account2 } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(1000);

      await AGCToken.connect(multisig).mint(account1.address, mintAmount);

      const account1Balance = await AGCToken.balanceOf(account1.address);

      expect(mintAmount.add(initialAGCAmount).eq(account1Balance)).to.equal(
        true,
        "account 1 should receive minted balance"
      );

      await AGCToken.connect(multisig).mint(account2.address, mintAmount);

      const account2Balance = await AGCToken.balanceOf(account2.address);

      expect(account2Balance.eq(mintAmount)).to.equal(
        true,
        "account 2 should receive minted balance"
      );

      const multisigBalance = await AGCToken.balanceOf(multisig.address);
      const totalSupply = await AGCToken.totalSupply();

      expect(
        totalSupply.eq(mintAmount.add(mintAmount).add(initialAGCAmount))
      ).to.be.equal(true, "total supply should be correct");

      expect(multisigBalance.eq(totalSupply)).to.equal(
        true,
        "multisig should have balance equal to total supply"
      );
    });

    it("should allow minter role to mint", async function () {
      const {
        AGCToken,
        account1,
        owner,
        multisig,
        initialAGCAmount,
        account2,
      } = await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(1000);

      await AGCToken.connect(owner).mint(account1.address, mintAmount);

      const account1Balance = await AGCToken.balanceOf(account1.address);

      expect(mintAmount.add(initialAGCAmount).eq(account1Balance)).to.equal(
        true,
        "account 1 should receive minted balance"
      );

      await AGCToken.connect(owner).mint(account2.address, mintAmount);

      const account2Balance = await AGCToken.balanceOf(account2.address);

      expect(account2Balance.eq(mintAmount)).to.equal(
        true,
        "account 2 should receive minted balance"
      );

      const multisigBalance = await AGCToken.balanceOf(multisig.address);
      const totalSupply = await AGCToken.totalSupply();

      expect(
        totalSupply.eq(mintAmount.add(mintAmount).add(initialAGCAmount))
      ).to.be.equal(true, "total supply should be correct");

      expect(multisigBalance.eq(totalSupply)).to.equal(
        true,
        "multisig should have balance equal to total supply"
      );
    });

    it("should allow multisig to burn", async function () {
      const { AGCToken, account1, multisig, initialAGCAmount } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(1000);

      await AGCToken.connect(multisig).mint(account1.address, mintAmount);

      const account1Balance = await AGCToken.balanceOf(account1.address);

      expect(mintAmount.add(initialAGCAmount).eq(account1Balance)).to.equal(
        true,
        "account 1 should receive minted balance"
      );

      const burnAmount = BigNumber.from(400);

      await AGCToken.connect(multisig).burnFrom(account1.address, burnAmount);

      const account1BalanceAfterBurn = await AGCToken.balanceOf(
        account1.address
      );
      expect(
        account1BalanceAfterBurn.eq(
          mintAmount.add(initialAGCAmount).sub(burnAmount)
        )
      ).to.equal(true, "account 1 should be burnt correctly");

      const totalSupply = await AGCToken.totalSupply();
      expect(
        totalSupply.eq(mintAmount.add(initialAGCAmount).sub(burnAmount))
      ).to.be.equal(true, "total supply should be correct");
    });

    it("should allow minter role to burn", async function () {
      const { AGCToken, account1, multisig, initialAGCAmount, owner } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(1000);

      await AGCToken.connect(owner).mint(account1.address, mintAmount);

      const account1Balance = await AGCToken.balanceOf(account1.address);

      expect(mintAmount.add(initialAGCAmount).eq(account1Balance)).to.equal(
        true,
        "account 1 should receive minted balance"
      );

      const burnAmount = BigNumber.from(400);

      await AGCToken.connect(owner).burnFrom(account1.address, burnAmount);

      const account1BalanceAfterBurn = await AGCToken.balanceOf(
        account1.address
      );

      expect(
        account1BalanceAfterBurn.eq(
          mintAmount.add(initialAGCAmount).sub(burnAmount)
        )
      ).to.equal(true, "account 1 should be burnt correctly");

      const multisigBalance = await AGCToken.balanceOf(multisig.address);
      const totalSupply = await AGCToken.totalSupply();

      expect(
        totalSupply.eq(mintAmount.sub(burnAmount).add(initialAGCAmount))
      ).to.be.equal(true, "total supply should be correct");

      expect(multisigBalance.eq(totalSupply)).to.equal(
        true,
        "multisig should have balance equal to total supply"
      );
    });
  });

  describe("urgent cases", function () {
    it("should allow multisig to pause and un-pause", async function () {
      const { AGCToken, account1, multisig } = await loadFixture(phase1Fixture);

      await expect(AGCToken.connect(multisig).pause()).to.eventually.fulfilled;

      await expect(
        AGCToken.connect(multisig).mint(account1.address, BigNumber.from(1000))
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(
        AGCToken.connect(multisig).burnFrom(
          account1.address,
          BigNumber.from(1000)
        )
      ).to.eventually.rejectedWith("Pausable: paused");

      await expect(AGCToken.connect(multisig).unpause()).to.eventually
        .fulfilled;

      await expect(
        AGCToken.connect(multisig).mint(account1.address, BigNumber.from(1000))
      ).to.eventually.fulfilled;
    });

    it("should forbid unauthorized pausing", async function () {
      const { AGCToken, account1 } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(account1).pause()
      ).to.eventually.rejectedWith("AccessControl:");
    });

    it("should forbid previous owner if revoked from pausing", async function () {
      const {
        AGCToken,
        account1,
        owner: previousOwner,
      } = await loadFixture(phase1Fixture);

      await AGCToken.connect(previousOwner).renounceRole(
        PAUSER_ROLE,
        previousOwner.address
      );

      await expect(
        AGCToken.connect(account1).pause()
      ).to.eventually.rejectedWith("AccessControl:");
    });
  });

  describe("Security checks", function () {
    it("throws if mints to company address", async function () {
      const { AGCToken, multisig, owner } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(owner).mint(multisig.address, BigNumber.from(1000))
      ).to.eventually.rejectedWith(
        "AGC: company cannot update its own balance"
      );
    });

    it("should not allow holder to burn", async function () {
      const { AGCToken, account1, initialAGCAmount } = await loadFixture(
        phase1Fixture
      );

      const account1Balance = await AGCToken.balanceOf(account1.address);

      expect(account1Balance.eq(initialAGCAmount)).to.be.equal(
        true,
        "account 1 should have balance"
      );

      await expect(
        AGCToken.connect(account1).burn(BigNumber.from(500))
      ).to.eventually.rejectedWith("burn is not allowed");
    });

    it("should not allow holder to transfer", async function () {
      const { AGCToken, account1, initialAGCAmount, account2 } =
        await loadFixture(phase1Fixture);

      const account1Balance = await AGCToken.balanceOf(account1.address);

      expect(account1Balance.eq(initialAGCAmount)).to.be.equal(
        true,
        "account 1 should have balance"
      );

      await expect(
        AGCToken.connect(account1).transfer(
          account2.address,
          BigNumber.from(500)
        )
      ).to.eventually.rejectedWith("transfer is not allowed");
    });

    it("succeeds if multisig tries to mint", async function () {
      const { AGCToken, multisig, account1, initialAGCAmount } =
        await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(1000);

      await expect(
        AGCToken.connect(multisig).mint(account1.address, mintAmount)
      ).to.eventually.fulfilled;

      const account1Balance = await AGCToken.balanceOf(account1.address);
      expect(account1Balance.eq(mintAmount.add(initialAGCAmount))).to.be.equal(
        true,
        "mintee should have correct balance"
      );
    });

    it("fails if previous owner try to mint after renounce", async function () {
      const { AGCToken, owner, account2 } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(owner).renounceRole(MINTER_ROLE, owner.address)
      ).to.eventually.fulfilled;

      await expect(AGCToken.connect(owner).mint(account2.address, 1000)).to
        .eventually.rejected;
    });

    it("fails if non-owner try to mint", async function () {
      const { AGCToken, account1, account2, owner } = await loadFixture(
        phase1Fixture
      );

      await expect(AGCToken.connect(account1).mint(account2.address, 1000)).to
        .eventually.rejected;
    });

    it("fails if the owner tries to burn", async function () {
      const { AGCToken, multisig } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(multisig).burn(BigNumber.from(1000))
      ).to.eventually.rejectedWith("burn is not allowed");
    });

    it("fails if the deployer tries to burn", async function () {
      const { AGCToken, owner: deployer } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(deployer).burn(BigNumber.from(1000))
      ).to.eventually.rejectedWith("burn is not allowed");
    });

    it("fails if owner tries to transfer", async function () {
      const { AGCToken, multisig, account1 } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(multisig).transfer(
          account1.address,
          BigNumber.from(1000)
        )
      ).to.eventually.rejectedWith("transfer is not allowed");
    });

    it("fails if deployer tries to transfer", async function () {
      const {
        AGCToken,
        owner: deployer,
        account1,
      } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(deployer).transfer(
          account1.address,
          BigNumber.from(1000)
        )
      ).to.eventually.rejectedWith("transfer is not allowed");
    });

    it("fails if owner tries to transferFrom other user's balance", async function () {
      const { AGCToken, multisig, account1 } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(multisig).transferFrom(
          account1.address,
          multisig.address,
          BigNumber.from(1000)
        )
      ).to.eventually.rejectedWith("transferFrom is not allowed");
    });

    it("fails if deployer tries to transferFrom owner's balance", async function () {
      const {
        AGCToken,
        owner: deployer,
        multisig: owner,
      } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(deployer).transferFrom(
          owner.address,
          deployer.address,
          BigNumber.from(1000)
        )
      ).to.eventually.rejectedWith("transferFrom is not allowed");
    });

    it("fails if a user tries to transferFrom owner's balance", async function () {
      const {
        AGCToken,
        account1,
        multisig: owner,
      } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(account1).transferFrom(
          owner.address,
          account1.address,
          BigNumber.from(1000)
        )
      ).to.eventually.rejectedWith("transferFrom is not allowed");
    });
  });

  describe("errors", function () {
    it("throws if view balance of zero address", async function () {
      const { AGCToken, account1, multisig } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.balanceOf(ethers.constants.AddressZero)
      ).to.eventually.rejectedWith("AGC: can not view zero address");
    });

    it("throws if mint incorrectly", async function () {
      const { AGCToken, account1, multisig } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(multisig).mint(account1.address, 0)
      ).to.eventually.rejectedWith("AGC: cannot mint zero token");

      await expect(
        AGCToken.connect(multisig).mint(multisig.address, 1000)
      ).to.eventually.rejectedWith(
        "AGC: company cannot update its own balance"
      );
    });

    it("throws if burn incorrectly", async function () {
      const { AGCToken, account1, multisig } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(multisig).burnFrom(ethers.constants.AddressZero, 1000)
      ).to.eventually.rejectedWith("ERC20: burn from zero address");

      await expect(
        AGCToken.connect(multisig).burnFrom(account1.address, 10000)
      ).to.eventually.rejectedWith("AGC: insufficient AGC to burn");

      await expect(
        AGCToken.connect(multisig).burnFrom(ethers.constants.AddressZero, 0)
      ).to.eventually.rejectedWith("ERC20: burn from zero address");
    });
  });
});
