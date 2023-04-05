const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber } = require("ethers");

const {} = require("./helpers");
const {
  lpAutoProviderFixture,
  SAFE_TRANSFER_MSG,
  PAUSED_MSG,
  ACCESS_CONTROL_MSG,
  ZERO_ADDRESS,
} = require("./fixtures");

describe("LpAutoProvider", function () {
  describe("initialization", function () {
    describe("happy path", function () {
      it("should have correct initialization variables", async function () {
        const { lpAutoProvider, feeTier, tokenId } = await loadFixture(
          lpAutoProviderFixture
        );
        const deployedFee = await lpAutoProvider.feeTier();

        expect(deployedFee === feeTier).to.be.equal(
          true,
          "fee tier should be " + feeTier
        );

        const deployedTokenId = await lpAutoProvider.companyTokenId();

        expect(deployedTokenId == tokenId).to.be.equal(
          true,
          "token id should be " + tokenId
        );
      });
    });

    describe("error cases", function () {});
  });

  describe("swap and add usdt", function () {
    describe("happy path", function () {
      it("can swap and add usdt successfully", async function () {
        const {
          lpAutoProvider,
          deployerAccount,
          USDTToken,
          userAccount,
          NftManager,
          SwapRouter,
          USCToken,
        } = await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USDTToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await USDTToken.connect(userAccount).approve(
          lpAutoProvider.address,
          swapAmount
        );

        await SwapRouter.mock.exactInputSingle.returns(500);
        await NftManager.mock.increaseLiquidity.returns(1000, 500, 500);
        await NftManager.mock.positions.returns(
          0,
          ZERO_ADDRESS,
          USDTToken.address,
          USCToken.address,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSDT(swapAmount)
        ).to.eventually.fulfilled;
      });
    });

    describe("error cases", function () {
      it("throws if insufficient token amount", async function () {
        const { lpAutoProvider, deployerAccount, USDTToken, userAccount } =
          await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USDTToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await USDTToken.connect(userAccount).approve(
          lpAutoProvider.address,
          swapAmount
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSDT(2000)
        ).to.eventually.rejectedWith(SAFE_TRANSFER_MSG);
      });

      it("throws if user hasn't approved token usage", async function () {
        const { lpAutoProvider, deployerAccount, USDTToken, userAccount } =
          await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USDTToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSDT(swapAmount)
        ).to.eventually.rejectedWith(SAFE_TRANSFER_MSG);
      });

      it("throws if slippage check fails", async function () {
        const {
          lpAutoProvider,
          deployerAccount,
          USDTToken,
          userAccount,
          SwapRouter,
        } = await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USDTToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await USDTToken.connect(userAccount).approve(
          lpAutoProvider.address,
          swapAmount
        );

        // Swap amount is too low!
        await SwapRouter.mock.exactInputSingle.revertsWithReason(
          "slippage check"
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSDT(swapAmount)
        ).to.eventually.rejectedWith("slippage check");
      });

      it("throws if contract is paused", async function () {
        const {
          lpAutoProvider,
          deployerAccount,
          ownerAccount,
          USDTToken,
          userAccount,
          NftManager,
          SwapRouter,
          USCToken,
        } = await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USDTToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await USDTToken.connect(userAccount).approve(
          lpAutoProvider.address,
          swapAmount
        );

        await lpAutoProvider.connect(ownerAccount).pause();

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSDT(1000)
        ).to.eventually.rejectedWith(PAUSED_MSG);

        await lpAutoProvider.connect(ownerAccount).unpause();

        await SwapRouter.mock.exactInputSingle.returns(500);
        await NftManager.mock.increaseLiquidity.returns(1000, 500, 500);
        await NftManager.mock.positions.returns(
          0,
          ZERO_ADDRESS,
          USDTToken.address,
          USCToken.address,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSDT(swapAmount)
        ).to.eventually.fulfilled;
      });
    });
  });

  describe("swap and add usc", function () {
    describe("happy path", function () {
      it("can swap and add usc successfully", async function () {
        const {
          lpAutoProvider,
          deployerAccount,
          USCToken,
          userAccount,
          NftManager,
          SwapRouter,
          USDTToken,
        } = await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USCToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await USCToken.connect(userAccount).approve(
          lpAutoProvider.address,
          swapAmount
        );

        await SwapRouter.mock.exactInputSingle.returns(500);
        await NftManager.mock.increaseLiquidity.returns(1000, 500, 500);
        await NftManager.mock.positions.returns(
          0,
          ZERO_ADDRESS,
          USDTToken.address,
          USCToken.address,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSC(swapAmount)
        ).to.eventually.fulfilled;
      });
    });

    describe("error cases", function () {
      it("throws if insufficient token amount", async function () {
        const { lpAutoProvider, deployerAccount, USCToken, userAccount } =
          await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USCToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await USCToken.connect(userAccount).approve(
          lpAutoProvider.address,
          swapAmount
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSC(2000)
        ).to.eventually.rejectedWith(SAFE_TRANSFER_MSG);
      });

      it("throws if user hasn't approved token usage", async function () {
        const { lpAutoProvider, deployerAccount, USCToken, userAccount } =
          await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USCToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSC(swapAmount)
        ).to.eventually.rejectedWith(SAFE_TRANSFER_MSG);
      });

      it("throws if slippage check fails", async function () {
        const {
          lpAutoProvider,
          deployerAccount,
          USCToken,
          userAccount,
          SwapRouter,
        } = await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USCToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await USCToken.connect(userAccount).approve(
          lpAutoProvider.address,
          swapAmount
        );

        // Swap amount is too low!
        await SwapRouter.mock.exactInputSingle.revertsWithReason(
          "slippage check"
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSC(swapAmount)
        ).to.eventually.rejectedWith("slippage check");
      });

      it("throws if contract is paused", async function () {
        const {
          lpAutoProvider,
          deployerAccount,
          ownerAccount,
          USCToken,
          userAccount,
          NftManager,
          SwapRouter,
          USDTToken,
        } = await loadFixture(lpAutoProviderFixture);

        const swapAmount = BigNumber.from(1000);

        await USCToken.connect(deployerAccount).mint(
          userAccount.address,
          swapAmount
        );

        await USCToken.connect(userAccount).approve(
          lpAutoProvider.address,
          swapAmount
        );

        await lpAutoProvider.connect(ownerAccount).pause();

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSC(1000)
        ).to.eventually.rejectedWith(PAUSED_MSG);

        await lpAutoProvider.connect(ownerAccount).unpause();

        await SwapRouter.mock.exactInputSingle.returns(500);
        await NftManager.mock.increaseLiquidity.returns(1000, 500, 500);
        await NftManager.mock.positions.returns(
          0,
          ZERO_ADDRESS,
          USDTToken.address,
          USCToken.address,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        );

        await expect(
          lpAutoProvider.connect(userAccount).swapAndAddUSC(swapAmount)
        ).to.eventually.fulfilled;
      });
    });
  });

  describe("collect fee", function () {
    describe("happy path", function () {
      it("should collect fee successfully", async function () {
        const {
          lpAutoProvider,
          deployerAccount,
          USCToken,
          ownerAccount,
          USDTToken,
          NftManager,
        } = await loadFixture(lpAutoProviderFixture);

        const usdtReward = BigNumber.from(1000);
        const uscReward = BigNumber.from(1100);

        await USCToken.connect(deployerAccount).mint(
          lpAutoProvider.address,
          uscReward
        );

        await USDTToken.connect(deployerAccount).mint(
          lpAutoProvider.address,
          usdtReward
        );

        await NftManager.mock.collect.returns(uscReward, usdtReward);

        await expect(lpAutoProvider.connect(ownerAccount).collectFee()).to
          .eventually.fulfilled;

        const ownerUSCBalance = await USCToken.balanceOf(ownerAccount.address);
        const ownerUSDTBalance = await USDTToken.balanceOf(
          ownerAccount.address
        );

        expect(ownerUSCBalance.eq(uscReward)).to.be.eq(
          true,
          "owner should receive usc fee correctly"
        );
        expect(ownerUSDTBalance.eq(usdtReward)).to.be.eq(
          true,
          "owner should receive usdt fee correctly"
        );
      });
    });

    describe("error cases", function () {
      it("throws if user is not operator", async function () {
        const { lpAutoProvider, userAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        await expect(
          lpAutoProvider.connect(userAccount).collectFee()
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });
    });
  });

  describe("set slippage tolerance", function () {
    describe("happy path", function () {
      it("can set slippage tolerance lower than original value", async function () {
        const { lpAutoProvider, ownerAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        const newSlippage = 25; // 0.25%
        await expect(
          lpAutoProvider.connect(ownerAccount).setSlippageTolerance(newSlippage)
        ).to.eventually.fulfilled;

        const appliedNewSlippage = await lpAutoProvider.slippageTolerance();

        expect(appliedNewSlippage === newSlippage).to.be.eq(
          true,
          "new slippage should be applied correctly"
        );
      });

      it("can set slippage tolerance more than original value", async function () {
        const { lpAutoProvider, ownerAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        const newSlippage = 500; // 5%
        await expect(
          lpAutoProvider.connect(ownerAccount).setSlippageTolerance(newSlippage)
        ).to.eventually.fulfilled;

        const appliedNewSlippage = await lpAutoProvider.slippageTolerance();

        expect(appliedNewSlippage === newSlippage).to.be.eq(
          true,
          "new slippage should be applied correctly"
        );
      });
    });

    describe("error cases", function () {
      it("throws if contract is paused", async function () {
        const { lpAutoProvider, userAccount, ownerAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        await lpAutoProvider.connect(ownerAccount).pause();

        const newSlippage = 400; // 4%
        await expect(
          lpAutoProvider.connect(userAccount).setSlippageTolerance(newSlippage)
        ).to.eventually.rejectedWith(PAUSED_MSG);
      });

      it("throws if user tries to set new slippage", async function () {
        const { lpAutoProvider, userAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        const newSlippage = 400; // 4%
        await expect(
          lpAutoProvider.connect(userAccount).setSlippageTolerance(newSlippage)
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });

      it("throws if new slippage is more than 5%", async function () {
        const { lpAutoProvider, ownerAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        const newSlippage = 700; // 7%
        await expect(
          lpAutoProvider.connect(ownerAccount).setSlippageTolerance(newSlippage)
        ).to.eventually.rejectedWith(
          "slippageTolerance: must be between 0% and 5%"
        );
      });
    });
  });

  describe("set company token", function () {
    describe("happy path", async function () {
      it("can set new company token with same feetier successfully", async function () {
        const { lpAutoProvider, ownerAccount, feeTier } = await loadFixture(
          lpAutoProviderFixture
        );

        const newTokenId = 2342;

        await expect(
          lpAutoProvider
            .connect(ownerAccount)
            .setCompanyToken(newTokenId, feeTier)
        ).to.eventually.fulfilled;

        const appliedTokenId = await lpAutoProvider.companyTokenId();
        expect(appliedTokenId.eq(BigNumber.from(newTokenId))).to.eq(
          true,
          "new token id should be applied correctly"
        );

        const appliedFee = await lpAutoProvider.feeTier();
        expect(appliedFee === feeTier).to.eq(
          true,
          "fee tier should be the same"
        );
      });

      it("can set new company token with different feetier successfully", async function () {
        const { lpAutoProvider, ownerAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        const newTokenId = 2342;
        const newFeeTier = 200; // 0.02%

        await expect(
          lpAutoProvider
            .connect(ownerAccount)
            .setCompanyToken(newTokenId, newFeeTier)
        ).to.eventually.fulfilled;

        const appliedTokenId = await lpAutoProvider.companyTokenId();
        expect(appliedTokenId.eq(BigNumber.from(newTokenId))).to.eq(
          true,
          "new token id should be applied correctly"
        );

        const appliedFee = await lpAutoProvider.feeTier();
        expect(appliedFee === newFeeTier).to.eq(
          true,
          "new fee tier should be applied correctly"
        );
      });
    });

    describe("error cases", function () {
      it("throws if contract is paused", async function () {
        const { lpAutoProvider, ownerAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        await lpAutoProvider.connect(ownerAccount).pause();

        await expect(
          lpAutoProvider.connect(ownerAccount).setCompanyToken(2342, 477)
        ).to.eventually.rejectedWith(PAUSED_MSG);
      });

      it("throws if normal user tries to call", async function () {
        const { lpAutoProvider, userAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        await expect(
          lpAutoProvider.connect(userAccount).setCompanyToken(2342, 477)
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });
    });
  });

  describe("withdraw liquidity", function () {
    describe("happy path", function () {
      it("should withdraw liquidity successfully", async function () {
        const {
          lpAutoProvider,
          deployerAccount,
          USCToken,
          ownerAccount,
          USDTToken,
          NftManager,
          timelockAccount,
        } = await loadFixture(lpAutoProviderFixture);

        const usdtLiquidity = BigNumber.from(1000);
        const uscLiquidity = BigNumber.from(1050);

        await USCToken.connect(deployerAccount).mint(
          lpAutoProvider.address,
          uscLiquidity
        );

        await USDTToken.connect(deployerAccount).mint(
          lpAutoProvider.address,
          usdtLiquidity
        );

        await NftManager.mock.decreaseLiquidity.returns(
          uscLiquidity,
          usdtLiquidity
        );

        await expect(
          lpAutoProvider.connect(timelockAccount).withdrawLiquidity(1000000)
        ).to.eventually.fulfilled;

        const ownerUSCBalance = await USCToken.balanceOf(ownerAccount.address);
        const ownerUSDTBalance = await USDTToken.balanceOf(
          ownerAccount.address
        );

        expect(ownerUSCBalance.eq(uscLiquidity)).to.be.eq(
          true,
          "owner should receive usc amount correctly"
        );
        expect(ownerUSDTBalance.eq(usdtLiquidity)).to.be.eq(
          true,
          "owner should receive usdt amount correctly"
        );
      });
    });

    describe("error cases", function () {
      it("throws if owner tries to withdraw liquidity", async function () {
        const { lpAutoProvider, ownerAccount } = await loadFixture(
          lpAutoProviderFixture
        );

        await expect(
          lpAutoProvider.connect(ownerAccount).withdrawLiquidity(1000000)
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });
    });
  });
});
