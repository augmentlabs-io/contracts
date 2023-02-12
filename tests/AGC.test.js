const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber } = require("ethers");

const {
  PAUSER_ROLE,
  OPERATOR_ROLE,
  ADMIN_ROLE,
  phase1Fixture,
  ZERO_ADDRESS,
  PAUSED_MSG,
  ACCESS_CONTROL_MSG,
} = require("./fixtures");
const { mintSomeAGCToAccount, defaultMintAmount } = require("./helpers");

describe("Upgradable AGC token", function () {
  describe("public functions", function () {
    describe("setup", function () {
      it("Should have correct name and symbol", async function () {
        const { AGCToken } = await loadFixture(phase1Fixture);

        const tokenName = await AGCToken.name();
        const tokenSymbol = await AGCToken.symbol();

        expect(tokenName).to.equal("AGC", "token name should be AGC");
        expect(tokenSymbol).to.equal("AGC", "token symbol should be AGC");
      });
    });

    describe("initialization", function () {
      describe("happy path", function () {
        it("should give company address correct initial supply", async function () {
          const {
            AGCToken,
            initialCompanyAGCAmount,
            multisig: companyAccount,
          } = await loadFixture(phase1Fixture);

          const totalSupply = await AGCToken.totalSupply();

          expect(totalSupply.eq(initialCompanyAGCAmount)).to.be.equal(
            true,
            "total supply should be equal to company account"
          );

          const companyAccountBalance = await AGCToken.balanceOf(
            companyAccount.address
          );
          expect(companyAccountBalance.eq(totalSupply)).to.be.equal(
            true,
            "company account should have balance equal to initial agc amount"
          );
        });

        it("should init correct permissions", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            multisig: companyAccount,
          } = await loadFixture(phase1Fixture);

          expect(
            await AGCToken.hasRole(OPERATOR_ROLE, apiBackend.address)
          ).to.be.eq(true, "api backend should have operator role");

          expect(
            await AGCToken.hasRole(OPERATOR_ROLE, companyAccount.address)
          ).to.be.eq(true, "companyAccount should have operator role");
        });
      });
    });

    describe("view balance", function () {
      describe("error cases", function () {
        it("throws if view balance of zero address", async function () {
          const { AGCToken } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.balanceOf(ZERO_ADDRESS)
          ).to.eventually.rejectedWith("AGC: can not view zero address");
        });
      });
    });

    describe("rebasement", function () {
      describe("happy case", function () {
        it("should increases all user balances if ratio > 1", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
            account1,
            account2,
            initialCompanyAGCAmount,
          } = await loadFixture(phase1Fixture);

          const account1Balance = BigNumber.from(500);
          const account2Balance = BigNumber.from(400);

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account1,
            mintAmount: account1Balance,
          });

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account2,
            mintAmount: account2Balance,
          });

          const countUsers = await AGCToken.countAllUsers();
          expect(countUsers.eq(BigNumber.from(3))).to.be.true;

          const dividend = 3;
          const divisor = 2;

          // Ratio is 0.5
          await AGCToken.connect(companyAccount).performRebasement(
            dividend,
            divisor,
            0,
            countUsers
          );

          const totalSupply = await AGCToken.totalSupply();
          const account1Rebased = await AGCToken.balanceOf(account1.address);
          const account2Rebased = await AGCToken.balanceOf(account2.address);
          const companyBalanceRebased = await AGCToken.balanceOf(
            companyAccount.address
          );

          expect(
            account1Rebased.eq(account1Balance.mul(dividend).div(divisor))
          ).to.be.eq(true, "account 1 should have balance updated correctly");

          expect(
            account2Rebased.eq(account2Balance.mul(dividend).div(divisor))
          ).to.be.eq(true, "account 2 should have balance updated correctly");

          expect(
            companyBalanceRebased.eq(
              initialCompanyAGCAmount.mul(dividend).div(divisor)
            )
          ).to.be.eq(true, "account 1 should have balance updated correctly");

          const totalBeforeRebasement = initialCompanyAGCAmount
            .add(account1Balance)
            .add(account2Balance);

          expect(
            totalSupply.eq(totalBeforeRebasement.mul(dividend).div(divisor))
          ).to.be.eq(true, "total supply should be updated correctly");
        });

        it("should increases all user balances if ratio < 1", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
            account1,
            account2,
            initialCompanyAGCAmount,
          } = await loadFixture(phase1Fixture);

          const account1Balance = BigNumber.from(500);
          const account2Balance = BigNumber.from(400);

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account1,
            mintAmount: account1Balance,
          });

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account2,
            mintAmount: account2Balance,
          });

          const countUsers = await AGCToken.countAllUsers();
          expect(countUsers.eq(BigNumber.from(3))).to.be.true;

          const dividend = 1;
          const divisor = 2;

          // Ratio is 0.5
          await AGCToken.connect(companyAccount).performRebasement(
            dividend,
            divisor,
            0,
            countUsers
          );

          const totalSupply = await AGCToken.totalSupply();
          const account1Rebased = await AGCToken.balanceOf(account1.address);
          const account2Rebased = await AGCToken.balanceOf(account2.address);
          const companyBalanceRebased = await AGCToken.balanceOf(
            companyAccount.address
          );

          expect(
            account1Rebased.eq(account1Balance.mul(dividend).div(divisor))
          ).to.be.eq(true, "account 1 should have balance updated correctly");

          expect(
            account2Rebased.eq(account2Balance.mul(dividend).div(divisor))
          ).to.be.eq(true, "account 2 should have balance updated correctly");

          expect(
            companyBalanceRebased.eq(
              initialCompanyAGCAmount.mul(dividend).div(divisor)
            )
          ).to.be.eq(true, "account 1 should have balance updated correctly");

          const totalBeforeRebasement = initialCompanyAGCAmount
            .add(account1Balance)
            .add(account2Balance);

          expect(
            totalSupply.eq(totalBeforeRebasement.mul(dividend).div(divisor))
          ).to.be.eq(true, "total supply should be updated correctly");
        });

        it("should rebase correctly if toIndex is larger than count all users", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
            account1,
            account2,
            initialCompanyAGCAmount,
          } = await loadFixture(phase1Fixture);

          const account1Balance = BigNumber.from(500);
          const account2Balance = BigNumber.from(400);

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account1,
            mintAmount: account1Balance,
          });

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account2,
            mintAmount: account2Balance,
          });

          const dividend = 1;
          const divisor = 2;

          // Ratio is 0.5
          await AGCToken.connect(companyAccount).performRebasement(
            dividend,
            divisor,
            0,
            10 // 10 is larger than current users count
          );

          const totalSupply = await AGCToken.totalSupply();
          const account1Rebased = await AGCToken.balanceOf(account1.address);
          const account2Rebased = await AGCToken.balanceOf(account2.address);
          const companyBalanceRebased = await AGCToken.balanceOf(
            companyAccount.address
          );

          expect(
            account1Rebased.eq(account1Balance.mul(dividend).div(divisor))
          ).to.be.eq(true, "account 1 should have balance updated correctly");

          expect(
            account2Rebased.eq(account2Balance.mul(dividend).div(divisor))
          ).to.be.eq(true, "account 2 should have balance updated correctly");

          expect(
            companyBalanceRebased.eq(
              initialCompanyAGCAmount.mul(dividend).div(divisor)
            )
          ).to.be.eq(true, "account 1 should have balance updated correctly");

          const totalBeforeRebasement = initialCompanyAGCAmount
            .add(account1Balance)
            .add(account2Balance);

          expect(
            totalSupply.eq(totalBeforeRebasement.mul(dividend).div(divisor))
          ).to.be.eq(true, "total supply should be updated correctly");
        });

        it("should rebase with pagination correctly", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
            account1,
            account2,
            initialCompanyAGCAmount,
          } = await loadFixture(phase1Fixture);

          const account1Balance = BigNumber.from(500);
          const account2Balance = BigNumber.from(400);

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account1,
            mintAmount: account1Balance,
          });

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account2,
            mintAmount: account2Balance,
          });

          const dividend = 3;
          const divisor = 2;

          // Ratio is 1.5
          // Rebase only 2 users
          await AGCToken.connect(companyAccount).performRebasement(
            dividend,
            divisor,
            0,
            2
          );

          // Rebase last user
          await AGCToken.connect(companyAccount).performRebasement(
            dividend,
            divisor,
            2,
            3
          );

          const totalSupply = await AGCToken.totalSupply();
          const account1Rebased = await AGCToken.balanceOf(account1.address);
          const account2Rebased = await AGCToken.balanceOf(account2.address);
          const companyBalanceRebased = await AGCToken.balanceOf(
            companyAccount.address
          );

          expect(
            account1Rebased.eq(account1Balance.mul(dividend).div(divisor))
          ).to.be.eq(true, "account 1 should have balance updated correctly");

          expect(
            account2Rebased.eq(account2Balance.mul(dividend).div(divisor))
          ).to.be.eq(true, "account 2 should have balance updated correctly");

          expect(
            companyBalanceRebased.eq(
              initialCompanyAGCAmount.mul(dividend).div(divisor)
            )
          ).to.be.eq(true, "account 1 should have balance updated correctly");

          const totalBeforeRebasement = initialCompanyAGCAmount
            .add(account1Balance)
            .add(account2Balance);

          expect(
            totalSupply.eq(totalBeforeRebasement.mul(dividend).div(divisor))
          ).to.be.eq(true, "total supply should be updated correctly");
        });
      });

      describe("error cases", function () {
        it("throws if contract is paused", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
          } = await loadFixture(phase1Fixture);

          await AGCToken.connect(companyAccount).pause();

          await expect(
            AGCToken.connect(apiBackend).performRebasement(1, 2, 1, 10)
          ).to.eventually.rejectedWith(PAUSED_MSG);
        });

        it("throws if ratio = 1", async function () {
          const { AGCToken, multisig: companyAccount } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(companyAccount).performRebasement(1, 1, 1, 10)
          ).to.eventually.rejectedWith(
            "rebasement: divident must be different from divisor"
          );
        });

        it("throws if start index is larger than end index", async function () {
          const { AGCToken, multisig: companyAccount } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(companyAccount).performRebasement(1, 2, 10, 1)
          ).to.eventually.rejectedWith(
            "rebasement: start index must be less than end index"
          );
        });

        it("throws if dividend or divisor is zero", async function () {
          const { AGCToken, multisig: companyAccount } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(companyAccount).performRebasement(0, 1, 10, 20)
          ).to.eventually.rejectedWith("rebasement: dividend must not be zero");

          await expect(
            AGCToken.connect(companyAccount).performRebasement(1, 0, 10, 20)
          ).to.eventually.rejectedWith("rebasement: divisor must not be zero");
        });
      });
    });

    describe("minting", async function () {
      describe("happy path", function () {
        it("should mint to user accounts successfully", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
            account1,
            account2,
          } = await loadFixture(phase1Fixture);

          const account1BalanceBeforeMint = await AGCToken.balanceOf(
            account1.address
          );
          const account2BalanceBeforeMint = await AGCToken.balanceOf(
            account2.address
          );

          expect(account1BalanceBeforeMint.eq(BigNumber.from(0))).to.be.equal(
            true,
            "account 1 should not have balance before mint"
          );

          expect(account2BalanceBeforeMint.eq(BigNumber.from(0))).to.be.equal(
            true,
            "account 2 should not have balance before mint"
          );

          // mint using company account
          await mintSomeAGCToAccount(AGCToken, {
            minter: companyAccount,
            account: account1,
          });

          // mint using api backend
          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account2,
          });

          const account1BalanceAfterMint = await AGCToken.balanceOf(
            account1.address
          );
          const account2BalanceAfterMint = await AGCToken.balanceOf(
            account2.address
          );

          expect(account1BalanceAfterMint.eq(defaultMintAmount)).to.be.equal(
            true,
            "account 1 should receive mint amount correctly"
          );

          expect(account2BalanceAfterMint.eq(defaultMintAmount)).to.be.equal(
            true,
            "account 2 should receive mint amount correctly"
          );
        });

        it("should mint to company address successfully", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
            initialCompanyAGCAmount,
          } = await loadFixture(phase1Fixture);

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: companyAccount,
          });

          const totalSupply = await AGCToken.totalSupply();
          const companyBalance = await AGCToken.balanceOf(
            companyAccount.address
          );

          expect(
            initialCompanyAGCAmount.add(defaultMintAmount).eq(totalSupply)
          ).to.be.eq(true, "mint amount should be added to total supply");

          expect(companyBalance.eq(totalSupply)).to.be.eq(
            true,
            "company balance should increase correctly after mint"
          );
        });
      });

      describe("error cases", function () {
        it("throws if paused", async function () {
          const {
            AGCToken,
            account1,
            multisig: companyAccount,
            owner: apiBackend,
          } = await loadFixture(phase1Fixture);

          await AGCToken.connect(companyAccount).pause();

          await expect(
            AGCToken.connect(apiBackend).mint(account1.address, 1000)
          ).to.eventually.rejectedWith(PAUSED_MSG);
        });

        it("throws if user tries to mint", async function () {
          const { AGCToken, account1, account2 } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(account1).mint(account2.address, 1000)
          ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
        });

        it("throws if mint to zero address", async function () {
          const { AGCToken, multisig: companyAccount } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(companyAccount).mint(ZERO_ADDRESS, 0)
          ).to.eventually.rejectedWith(
            "updateUserAddress: cannot update zero address"
          );
        });

        it("throws if try to mint 0", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            account1,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(companyAccount).mint(account1.address, 0)
          ).to.eventually.rejectedWith("AGC: cannot mint zero token");
        });
      });
    });

    describe("burnFrom", function () {
      describe("happy path", function () {
        it("should allow companyAddress and apiBackend to burn user tokens", async function () {
          const {
            AGCToken,
            account1,
            account2,
            multisig: companyAddress,
            initialCompanyAGCAmount,
            owner: apiBackend,
          } = await loadFixture(phase1Fixture);

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account1,
          });

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account2,
          });

          const burnAmount = BigNumber.from(400);

          await AGCToken.connect(companyAddress).burnFrom(
            account1.address,
            burnAmount
          );

          await AGCToken.connect(apiBackend).burnFrom(
            account2.address,
            burnAmount
          );

          const account1Balance = await AGCToken.balanceOf(account1.address);
          const account2Balance = await AGCToken.balanceOf(account2.address);

          expect(
            account1Balance.eq(defaultMintAmount.sub(burnAmount))
          ).to.equal(true, "account 1 should be burnt correctly");

          expect(
            account2Balance.eq(defaultMintAmount.sub(burnAmount))
          ).to.equal(true, "account 2 should be burnt correctly");

          const totalSupply = await AGCToken.totalSupply();

          expect(
            initialCompanyAGCAmount
              .add(defaultMintAmount)
              .add(defaultMintAmount)
              .sub(burnAmount)
              .sub(burnAmount)
              .eq(totalSupply)
          ).to.be.equal(true, "total supply should be correct");
        });
      });

      describe("error cases", function () {
        it("throws if contract paused", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            multisig: companyAccount,
            account1,
          } = await loadFixture(phase1Fixture);

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account1,
          });

          await AGCToken.connect(companyAccount).pause();

          await expect(
            AGCToken.connect(companyAccount).burnFrom(account1.address, 1000)
          ).to.eventually.rejectedWith(PAUSED_MSG);

          await AGCToken.connect(companyAccount).unpause();

          await expect(
            AGCToken.connect(companyAccount).burnFrom(account1.address, 1000)
          ).to.eventually.fulfilled;
        });

        it("throws if user tries to call burnFrom", async function () {
          const { AGCToken, account1, account2 } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(account1).burnFrom(
              account2.address,
              BigNumber.from(1000)
            )
          ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
        });

        it("throws if burnFrom zero address", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(companyAccount).burnFrom(ZERO_ADDRESS, 1000)
          ).to.eventually.rejectedWith("ERC20: burn from zero address");

          await expect(
            AGCToken.connect(apiBackend).burnFrom(ZERO_ADDRESS, 1000)
          ).to.eventually.rejectedWith("ERC20: burn from zero address");
        });

        it("throws if burnFrom with zero amount", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
            account1,
          } = await loadFixture(phase1Fixture);

          // make sure we have some AGC for minting
          await mintSomeAGCToAccount(AGCToken, {
            minter: companyAccount,
            account: account1,
          });

          await expect(
            AGCToken.connect(companyAccount).burnFrom(account1.address, 0)
          ).to.eventually.rejectedWith("burnFrom: cannot burn zero token");

          await expect(
            AGCToken.connect(apiBackend).burnFrom(account1.address, 0)
          ).to.eventually.rejectedWith("burnFrom: cannot burn zero token");
        });

        it("throws burnFrom exceeds balance", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            account1,
          } = await loadFixture(phase1Fixture);

          // make sure we have some AGC for minting
          await mintSomeAGCToAccount(AGCToken, {
            minter: companyAccount,
            account: account1,
          });

          await expect(
            AGCToken.connect(companyAccount).burnFrom(
              account1.address,
              defaultMintAmount.add(BigNumber.from(2000))
            )
          ).to.eventually.rejectedWith("AGC: insufficient AGC to burn");
        });

        it("throws if try to burnFrom companyAddress", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            owner: apiBackend,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(apiBackend).burnFrom(
              companyAccount.address,
              defaultMintAmount
            )
          ).to.eventually.rejectedWith(
            "burnFrom: user address must not be company address"
          );
        });
      });
    });

    describe("burn", function () {
      describe("happy path", function () {
        it("should reduce company balance correctly", async function () {
          const {
            AGCToken,
            initialCompanyAGCAmount,
            multisig: companyAccount,
          } = await loadFixture(phase1Fixture);

          const burnAmount = BigNumber.from(2000);
          await AGCToken.connect(companyAccount).burn(burnAmount);

          const totalSupply = await AGCToken.totalSupply();
          const companyBalance = await AGCToken.balanceOf(
            companyAccount.address
          );

          expect(
            companyBalance.eq(initialCompanyAGCAmount.sub(burnAmount))
          ).to.be.eq(true, "company balance should be reduced");

          expect(totalSupply.eq(companyBalance)).to.be.eq(
            true,
            "total supply should be reduced after burn"
          );
        });
      });

      describe("error cases", function () {
        it("throws if contract is paused", async function () {
          const { AGCToken, multisig: companyAccount } = await loadFixture(
            phase1Fixture
          );

          await AGCToken.connect(companyAccount).pause();

          await expect(
            AGCToken.connect(companyAccount).burn(20000)
          ).to.eventually.rejectedWith(PAUSED_MSG);

          await AGCToken.connect(companyAccount).unpause();

          await expect(AGCToken.connect(companyAccount).burn(2000)).to
            .eventually.fulfilled;
        });

        it("throws if burn 0 amount", async function () {
          const { AGCToken, multisig: companyAccount } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(companyAccount).burn(0)
          ).to.eventually.rejectedWith("burn: cannot burn zero amount");
        });

        it("throws if company has insufficient balance", async function () {
          const {
            AGCToken,
            multisig: companyAccount,
            initialCompanyAGCAmount,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(companyAccount).burn(
              initialCompanyAGCAmount.add(BigNumber.from(1000))
            )
          ).to.eventually.rejectedWith("burn: insufficient company balance");
        });
      });
    });

    describe("transfer", function () {
      describe("happy path", function () {
        it("should allow company and apiBackend to transfer from company account to user successfully", async function () {
          const {
            AGCToken,
            initialCompanyAGCAmount,
            multisig: companyAccount,
            owner: apiBackend,
            account1,
          } = await loadFixture(phase1Fixture);

          const transferAmount = BigNumber.from(1000);

          await AGCToken.connect(companyAccount).transfer(
            account1.address,
            transferAmount
          );

          await AGCToken.connect(apiBackend).transfer(
            account1.address,
            transferAmount
          );

          const totalSupply = await AGCToken.totalSupply();
          expect(totalSupply.eq(initialCompanyAGCAmount)).to.be.eq(
            true,
            "total supply should be unchanged"
          );

          const account1Balance = await AGCToken.balanceOf(account1.address);
          expect(account1Balance.eq(transferAmount.mul(2))).to.be.eq(
            true,
            "account 1 should receive transfered amount correctly"
          );

          const companyBalance = await AGCToken.balanceOf(
            companyAccount.address
          );
          expect(
            companyBalance.eq(
              initialCompanyAGCAmount.sub(transferAmount.mul(2))
            )
          ).to.be.eq(
            true,
            "company balance should be deducted correctly after transfer"
          );
        });
      });

      describe("error cases", function () {
        it("throws if paused", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            account1,
            multisig: companyAccount,
          } = await loadFixture(phase1Fixture);

          await AGCToken.connect(companyAccount).pause();

          await expect(
            AGCToken.connect(apiBackend).transfer(account1.address, 1000)
          ).to.eventually.rejectedWith(PAUSED_MSG);

          await AGCToken.connect(companyAccount).unpause();

          await expect(
            AGCToken.connect(apiBackend).transfer(account1.address, 1000)
          ).to.eventually.fulfilled;
        });

        it("throws if transfer to zero address", async function () {
          const { AGCToken, owner: apiBackend } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(apiBackend).transfer(
              ZERO_ADDRESS,
              BigNumber.from(1000)
            )
          ).to.eventually.rejectedWith(
            "updateUserAddress: cannot update zero address"
          );
        });

        it("throws if transfer to zero token", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            account1,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(apiBackend).transfer(account1.address, 0)
          ).to.eventually.rejectedWith("transfer: cannot transfer zero token");
        });

        it("throws if transfer to company address", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            multisig: companyAccount,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(apiBackend).transfer(companyAccount.address, 0)
          ).to.eventually.rejectedWith(
            "transfer: cannot transfer to companyAddress"
          );
        });

        it("throws if company address has insufficient amount", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            account1,
            initialCompanyAGCAmount,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(apiBackend).transfer(
              account1.address,
              initialCompanyAGCAmount.add(BigNumber.from(1000))
            )
          ).to.eventually.rejectedWith(
            "transfer: insufficient company balance"
          );
        });

        it("throws if user tries to transfer", async function () {
          const {
            AGCToken,
            account1,
            account2,
            owner: apiBackend,
          } = await loadFixture(phase1Fixture);

          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account1,
          });

          await expect(
            AGCToken.connect(account1).transfer(
              account2.address,
              BigNumber.from(500)
            )
          ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
        });
      });
    });

    describe("deductFrom", function () {
      describe("happy path", function () {
        it("should decrease user balance and increase company balance", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            multisig: companyAccount,
            account1,
            initialCompanyAGCAmount,
          } = await loadFixture(phase1Fixture);

          const deductAmount = BigNumber.from(200);

          // make sure account 1 has AGC tokens to deduct
          await mintSomeAGCToAccount(AGCToken, {
            minter: apiBackend,
            account: account1,
          });

          await AGCToken.connect(apiBackend).deductFrom(
            account1.address,
            deductAmount
          );

          const account1Balance = await AGCToken.balanceOf(account1.address);
          expect(
            account1Balance.eq(defaultMintAmount.sub(deductAmount))
          ).to.be.eq(true, "user should have AGC balance deducted");

          const companyAccountBalance = await AGCToken.balanceOf(
            companyAccount.address
          );

          expect(
            companyAccountBalance.eq(initialCompanyAGCAmount.add(deductAmount))
          ).to.be.equal(true, "company should receive deducted amount");
        });
      });

      describe("error cases", function () {
        it("throws if contract is paused", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            account1,
            multisig: companyAccount,
          } = await loadFixture(phase1Fixture);

          await AGCToken.connect(companyAccount).pause();

          await expect(
            AGCToken.connect(apiBackend).mint(account1.address, 1000)
          ).to.eventually.rejectedWith(PAUSED_MSG);
        });

        it("throws if deduct zero address", async function () {
          const { AGCToken, owner: apiBackend } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(apiBackend).deductFrom(ZERO_ADDRESS, 1000)
          ).to.eventually.rejectedWith(
            "deductFrom: source address can not be zero"
          );
        });

        it("throws if user has insufficient balance", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            account1,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(apiBackend).deductFrom(account1.address, 10000)
          ).to.eventually.rejectedWith("deductFrom: insufficient user balance");
        });

        it("throws if deduct zero amount", async function () {
          const {
            AGCToken,
            owner: apiBackend,
            account1,
          } = await loadFixture(phase1Fixture);

          await expect(
            AGCToken.connect(apiBackend).deductFrom(account1.address, 0)
          ).to.eventually.rejectedWith(
            "deductFrom: cannot transfer zero token"
          );
        });

        it("throws if user tries to call deductFrom", async function () {
          const { AGCToken, account1, account2 } = await loadFixture(
            phase1Fixture
          );

          await expect(
            AGCToken.connect(account1).deductFrom(account2.address, 1000)
          ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
        });
      });
    });

    describe("transferFrom", function () {
      it("should revert in all cases", async function () {
        const {
          AGCToken,
          account1,
          account2,
          multisig: companyAccount,
          owner: apiBackend,
        } = await loadFixture(phase1Fixture);

        await expect(
          AGCToken.connect(account1).transferFrom(
            account1.address,
            account2.address,
            1000
          )
        ).to.eventually.rejectedWith("transferFrom is not allowed");

        await expect(
          AGCToken.connect(companyAccount).transferFrom(
            account1.address,
            account2.address,
            1000
          )
        ).to.eventually.rejectedWith("transferFrom is not allowed");

        await expect(
          AGCToken.connect(apiBackend).transferFrom(
            account1.address,
            account2.address,
            1000
          )
        ).to.eventually.rejectedWith("transferFrom is not allowed");
      });
    });

    describe("users management", function () {
      it("should count the users correctly", async function () {
        const {
          AGCToken,
          account1,
          account2,
          multisig: companyAccount,
        } = await loadFixture(phase1Fixture);

        await AGCToken.connect(companyAccount).transfer(account1.address, 1000);
        await AGCToken.connect(companyAccount).transfer(account2.address, 1000);
        await AGCToken.connect(companyAccount).mint(account1.address, 1000);
        await AGCToken.connect(companyAccount).mint(account2.address, 1000);

        const countAllUsers = await AGCToken.countAllUsers();

        expect(countAllUsers.eq(BigNumber.from(3))).to.be.equal(
          true,
          "should have 3 users in the array"
        );
      });
    });
  });

  describe("Security checks", function () {
    it("should forbid previous owner if revoked from pausing", async function () {
      const {
        AGCToken,
        account1,
        owner: apiBackend,
      } = await loadFixture(phase1Fixture);

      await AGCToken.connect(apiBackend).renounceRole(
        PAUSER_ROLE,
        apiBackend.address
      );

      await expect(
        AGCToken.connect(account1).pause()
      ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
    });

    it("should forbid unauthorized pausing", async function () {
      const { AGCToken, account1 } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(account1).pause()
      ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
    });

    it("company address should have operator role", async function () {
      const { AGCToken, multisig: companyAccount } = await loadFixture(
        phase1Fixture
      );

      const isCompanyOperatorRole = await AGCToken.hasRole(
        OPERATOR_ROLE,
        companyAccount.address
      );

      expect(isCompanyOperatorRole).to.be.equal(
        true,
        "company account should be operator"
      );
    });

    it("company address should not have admin role, upgrader role, pauser role", async function () {
      const {
        AGCToken,
        multisig: companyAccount,
        owner: apiBackend,
      } = await loadFixture(phase1Fixture);

      const isApiBackendAdminRole = await AGCToken.hasRole(
        ADMIN_ROLE,
        apiBackend.address
      );

      expect(isApiBackendAdminRole).to.be.equal(
        false,
        "api backend should not be admin"
      );

      const isCompanyAdminRole = await AGCToken.hasRole(
        ADMIN_ROLE,
        companyAccount.address
      );

      expect(isCompanyAdminRole).to.be.equal(
        true,
        "company account should be admin"
      );

      const isCompanyPauserRole = await AGCToken.hasRole(
        PAUSER_ROLE,
        companyAccount.address
      );

      expect(isCompanyPauserRole).to.be.equal(
        true,
        "company account should be be pauser"
      );
    });

    it("should not allow holder to burn", async function () {
      const {
        AGCToken,
        account1,
        owner: apiBackend,
      } = await loadFixture(phase1Fixture);

      // makes sure account 1 has balance for burning
      await AGCToken.connect(apiBackend).mint(
        account1.address,
        BigNumber.from(1000)
      );

      await expect(
        AGCToken.connect(account1).burn(BigNumber.from(500))
      ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
    });

    it("succeeds if companyAccount tries to mint", async function () {
      const {
        AGCToken,
        multisig: companyAccount,
        account1,
      } = await loadFixture(phase1Fixture);

      const mintAmount = BigNumber.from(1000);

      await expect(
        AGCToken.connect(companyAccount).mint(account1.address, mintAmount)
      ).to.eventually.fulfilled;

      const account1Balance = await AGCToken.balanceOf(account1.address);
      expect(account1Balance.eq(mintAmount)).to.be.equal(
        true,
        "mintee should have correct balance"
      );
    });

    it("fails if apiBackend try to mint after renounce", async function () {
      const {
        AGCToken,
        owner: apiBackend,
        account2,
      } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(apiBackend).renounceRole(
          OPERATOR_ROLE,
          apiBackend.address
        )
      ).to.eventually.fulfilled;

      await expect(
        AGCToken.connect(apiBackend).mint(account2.address, 1000)
      ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
    });

    it("fails if non-owner try to mint", async function () {
      const { AGCToken, account1, account2 } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(account1).mint(account2.address, 1000)
      ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
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

    it("fails if api backend tries to transferFrom owner's balance", async function () {
      const {
        AGCToken,
        owner: apiBackend,
        multisig: owner,
      } = await loadFixture(phase1Fixture);

      await expect(
        AGCToken.connect(apiBackend).transferFrom(
          owner.address,
          apiBackend.address,
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
});
