const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber } = require("ethers");

const {} = require("./helpers");
const {
  SAFE_TRANSFER_MSG,
  PAUSED_MSG,
  ACCESS_CONTROL_MSG,
  bscLpAutoProviderFixture,
  ZERO_ADDRESS,
} = require("./fixtures");

describe("BscLpAutoProvider", function () {
  describe("initialization", function () {
    describe("happy path", function () {
      it("should have correct initialization variables", async function () {
        const {
          BscLpAutoProvider,
          ownerAccount,
          timelockAccount,
          LpToken,
          PcsZap,
        } = await loadFixture(bscLpAutoProviderFixture);

        expect(
          (await BscLpAutoProvider.ownerAddress()) === ownerAccount.address
        ).to.be.true;

        expect(
          (await BscLpAutoProvider.timelockAddress()) ===
            timelockAccount.address
        ).to.be.true;

        expect((await BscLpAutoProvider.pairAddress()) === LpToken.address).to
          .be.true;

        expect((await BscLpAutoProvider.pancakeswapZap()) === PcsZap.address).to
          .be.true;
      });
    });
  });

  describe("set slippage tolerance", function () {
    describe("happy path", function () {
      it("can set slippage tolerance lower than original value", async function () {
        const { BscLpAutoProvider, ownerAccount } = await loadFixture(
          bscLpAutoProviderFixture
        );

        const newSlippage = 25; // 0.25%
        await expect(
          BscLpAutoProvider.connect(ownerAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.fulfilled;

        const appliedNewSlippage = await BscLpAutoProvider.slippageTolerance();

        expect(appliedNewSlippage === newSlippage).to.be.eq(
          true,
          "new slippage should be applied correctly"
        );
      });

      it("can set slippage tolerance more than original value", async function () {
        const { BscLpAutoProvider, ownerAccount } = await loadFixture(
          bscLpAutoProviderFixture
        );

        const newSlippage = 500; // 5%
        await expect(
          BscLpAutoProvider.connect(ownerAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.fulfilled;

        const appliedNewSlippage = await BscLpAutoProvider.slippageTolerance();

        expect(appliedNewSlippage === newSlippage).to.be.eq(
          true,
          "new slippage should be applied correctly"
        );
      });
    });

    describe("error cases", function () {
      it("throws if contract is paused", async function () {
        const { BscLpAutoProvider, userAccount, ownerAccount } =
          await loadFixture(bscLpAutoProviderFixture);

        await BscLpAutoProvider.connect(ownerAccount).pause();

        const newSlippage = 400; // 4%
        await expect(
          BscLpAutoProvider.connect(userAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.rejectedWith(PAUSED_MSG);

        await BscLpAutoProvider.connect(ownerAccount).unpause();
        await expect(
          BscLpAutoProvider.connect(ownerAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.fulfilled;
      });

      it("throws if user tries to set new slippage", async function () {
        const { BscLpAutoProvider, userAccount } = await loadFixture(
          bscLpAutoProviderFixture
        );

        const newSlippage = 400; // 4%
        await expect(
          BscLpAutoProvider.connect(userAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });

      it("throws if new slippage is more than 5%", async function () {
        const { BscLpAutoProvider, ownerAccount } = await loadFixture(
          bscLpAutoProviderFixture
        );

        const newSlippage = 700; // 7%
        await expect(
          BscLpAutoProvider.connect(ownerAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.rejectedWith(
          "slippageTolerance: must be between 0% and 5%"
        );
      });
    });
  });

  describe("provide liquidity", function () {
    describe("happy path", function () {
      it("provide liquidity with usc successfully", async function () {
        const {
          BscLpAutoProvider,
          deployerAccount,
          PcsZap,
          USCToken,
          userAccount,
        } = await loadFixture(bscLpAutoProviderFixture);

        const provideLiquidityAmount = 1000;

        await USCToken.connect(deployerAccount).mint(
          userAccount.address,
          provideLiquidityAmount
        );

        await USCToken.connect(userAccount).approve(
          BscLpAutoProvider.address,
          provideLiquidityAmount
        );

        await PcsZap.mock.zapInToken.returns(); // Zap succeeds

        await expect(
          BscLpAutoProvider.connect(userAccount).provideLiquidity(
            USCToken.address,
            provideLiquidityAmount
          )
        ).to.eventually.fulfilled;
      });

      it("provide liquidity with usdt successfully", async function () {
        const {
          BscLpAutoProvider,
          deployerAccount,
          PcsZap,
          USDTToken,
          userAccount,
        } = await loadFixture(bscLpAutoProviderFixture);

        const provideLiquidityAmount = 1000;

        await USDTToken.connect(deployerAccount).mint(
          userAccount.address,
          provideLiquidityAmount
        );

        await USDTToken.connect(userAccount).approve(
          BscLpAutoProvider.address,
          provideLiquidityAmount
        );

        await PcsZap.mock.zapInToken.returns(); // Zap succeeds

        await expect(
          BscLpAutoProvider.connect(userAccount).provideLiquidity(
            USDTToken.address,
            provideLiquidityAmount
          )
        ).to.eventually.fulfilled;
      });
    });

    describe("error cases", function () {
      it("throws if contract is paused", async function () {
        const { BscLpAutoProvider, ownerAccount, USDTToken } =
          await loadFixture(bscLpAutoProviderFixture);

        await BscLpAutoProvider.connect(ownerAccount).pause();
        await expect(
          BscLpAutoProvider.provideLiquidity(USDTToken.address, 1000)
        ).to.eventually.rejectedWith(PAUSED_MSG);
      });

      it("throws if token address is zero", async function () {
        const { BscLpAutoProvider, ownerAccount } = await loadFixture(
          bscLpAutoProviderFixture
        );

        await expect(
          BscLpAutoProvider.provideLiquidity(ZERO_ADDRESS, 1000)
        ).to.eventually.rejectedWith("provideLiquidity: zero token address");
      });

      it("throws if amount is zero", async function () {
        const { BscLpAutoProvider, ownerAccount, USDTToken } =
          await loadFixture(bscLpAutoProviderFixture);

        await expect(
          BscLpAutoProvider.provideLiquidity(USDTToken.address, 0)
        ).to.eventually.rejectedWith("provideLiquidity: bad amount");
      });
    });
  });

  describe("withdraw lp tokens", function () {
    describe("happy path", function () {
      it("should allow withdrawer to withdraw tokens", async function () {
        const {
          BscLpAutoProvider,
          deployerAccount,
          LpToken,
          ownerAccount,
          timelockAccount,
        } = await loadFixture(bscLpAutoProviderFixture);

        const lpAmount = BigNumber.from(1000);

        await LpToken.connect(deployerAccount).mint(
          BscLpAutoProvider.address,
          lpAmount
        );

        await expect(
          BscLpAutoProvider.connect(timelockAccount).withdrawLpTokens()
        ).to.eventually.fulfilled;

        const ownerLpTokens = await LpToken.balanceOf(ownerAccount.address);

        expect(ownerLpTokens.eq(lpAmount)).to.be.true;
      });
    });

    describe("error cases", function () {
      it("throws if owner tries to withdraw", async function () {
        const { BscLpAutoProvider, ownerAccount } = await loadFixture(
          bscLpAutoProviderFixture
        );

        await expect(
          BscLpAutoProvider.connect(ownerAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });

      it("throws if user tries to withdraw", async function () {
        const { BscLpAutoProvider, userAccount } = await loadFixture(
          bscLpAutoProviderFixture
        );

        await expect(
          BscLpAutoProvider.connect(userAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });

      it("throws if there is no lp token to withdraw", async function () {
        const { BscLpAutoProvider, timelockAccount } = await loadFixture(
          bscLpAutoProviderFixture
        );

        await expect(
          BscLpAutoProvider.connect(timelockAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith("withdrawLpTokens: withdraw zero amount");
      });
    });
  });
});
