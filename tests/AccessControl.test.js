const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { phase1Fixture, ADMIN_ROLE } = require("./fixtures_2");
const { MINTER_ROLE } = require("./fixtures_2");

describe("Access Control", function () {
  describe("Role check", function () {
    it("should take multisig as admin of coinx, usdx and owner of token controller", async function () {
      const { USCToken, AGCToken, tokenController, multisig } =
        await loadFixture(phase1Fixture);

      expect(await USCToken.hasRole(ADMIN_ROLE, multisig.address)).to.be.equal(
        true,
        "multisig should be admin of usdx"
      );

      expect(await AGCToken.hasRole(ADMIN_ROLE, multisig.address)).to.be.equal(
        true,
        "multisig should be admin of coinx"
      );

      expect(
        await tokenController.hasRole(ADMIN_ROLE, multisig.address)
      ).to.be.equal(true, "multisig should be admin of controller");
    });
  });

  describe("role transfer", function () {
    it("should be able to grant admin role", async function () {
      const { USCToken, multisig, account1 } = await loadFixture(phase1Fixture);

      await USCToken.connect(multisig).grantRole(ADMIN_ROLE, account1.address);

      const isAccount1Admin = await USCToken.hasRole(
        ADMIN_ROLE,
        account1.address
      );

      expect(isAccount1Admin).to.be.equal(
        true,
        "should be able to grant admin role"
      );
    });
  });

  describe("role revoke", function () {
    it("should allow multisig to revoke owner", async function () {
      const { USCToken, multisig, owner, account1 } = await loadFixture(
        phase1Fixture
      );

      await USCToken.connect(multisig).revokeRole(ADMIN_ROLE, owner.address);

      const isOwnerStillAdmin = await USCToken.hasRole(
        ADMIN_ROLE,
        owner.address
      );

      expect(isOwnerStillAdmin).to.be.equal(
        false,
        "owner should no longer be admin"
      );

      await USCToken.connect(multisig).revokeRole(MINTER_ROLE, owner.address);

      await expect(
        USCToken.connect(owner).mint(account1.address, BigNumber.from(1000))
      ).to.eventually.rejectedWith("AccessControl:");
    });
  });

  describe("role renounce", function () {
    it("should forbid renounced minter from minting", async function () {
      const { USCToken, AGCToken, tokenController, multisig, account1 } =
        await loadFixture(phase1Fixture);

      await AGCToken.connect(multisig).renounceRole(
        MINTER_ROLE,
        multisig.address
      );

      await expect(
        AGCToken.connect(multisig).mint(account1.address, BigNumber.from(1000))
      ).to.eventually.rejectedWith("AccessControl:");

      const isMultisigAdmin = await AGCToken.hasRole(
        ADMIN_ROLE,
        multisig.address
      );

      expect(isMultisigAdmin).to.be.equal(
        true,
        "multisig should still be admin"
      );
    });
  });
});
