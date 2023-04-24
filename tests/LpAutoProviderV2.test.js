const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber } = require("ethers");

const {} = require("./helpers");
const {
  PAUSED_MSG,
  ACCESS_CONTROL_MSG,
  v2LpAutoProviderFixture,
  ZERO_ADDRESS,
  WITHDRAWER_ROLE,
  SLIPPAGE_MSG,
} = require("./fixtures");

describe("LpAutoProviderV2", function () {
  describe("initialization", function () {
    describe("happy path", function () {
      it("should have correct initialization variables", async function () {
        const {
          LpAutoProviderV2,
          ownerAccount,
          timelockAccount,
          augmentPair,
          augmentRouter,
        } = await loadFixture(v2LpAutoProviderFixture);

        expect((await LpAutoProviderV2.ownerAddress()) === ownerAccount.address)
          .to.be.true;

        expect(
          (await LpAutoProviderV2.timelockAddress()) === timelockAccount.address
        ).to.be.true;

        expect((await LpAutoProviderV2.augmentPair()) === augmentPair.address)
          .to.be.true;

        expect(
          (await LpAutoProviderV2.augmentRouter()) === augmentRouter.address
        ).to.be.true;
      });
    });
  });

  describe("set slippage tolerance", function () {
    describe("happy path", function () {
      it("can set slippage tolerance lower than original value", async function () {
        const { LpAutoProviderV2, ownerAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        const newSlippage = 25; // 0.25%
        await expect(
          LpAutoProviderV2.connect(ownerAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.fulfilled;

        const appliedNewSlippage = await LpAutoProviderV2.slippageTolerance();

        expect(appliedNewSlippage === newSlippage).to.be.eq(
          true,
          "new slippage should be applied correctly"
        );
      });

      it("can set slippage tolerance more than original value", async function () {
        const { LpAutoProviderV2, ownerAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        const newSlippage = 500; // 5%
        await expect(
          LpAutoProviderV2.connect(ownerAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.fulfilled;

        const appliedNewSlippage = await LpAutoProviderV2.slippageTolerance();

        expect(appliedNewSlippage === newSlippage).to.be.eq(
          true,
          "new slippage should be applied correctly"
        );
      });
    });

    describe("error cases", function () {
      it("throws if contract is paused", async function () {
        const { LpAutoProviderV2, userAccount, ownerAccount } =
          await loadFixture(v2LpAutoProviderFixture);

        await LpAutoProviderV2.connect(ownerAccount).pause();

        const newSlippage = 400; // 4%
        await expect(
          LpAutoProviderV2.connect(userAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.rejectedWith(PAUSED_MSG);

        await LpAutoProviderV2.connect(ownerAccount).unpause();
        await expect(
          LpAutoProviderV2.connect(ownerAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.fulfilled;
      });

      it("throws if user tries to set new slippage", async function () {
        const { LpAutoProviderV2, userAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        const newSlippage = 400; // 4%
        await expect(
          LpAutoProviderV2.connect(userAccount).setSlippageTolerance(
            newSlippage
          )
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });

      it("throws if new slippage is more than 5%", async function () {
        const { LpAutoProviderV2, ownerAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        const newSlippage = 700; // 7%
        await expect(
          LpAutoProviderV2.connect(ownerAccount).setSlippageTolerance(
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
          LpAutoProviderV2,
          deployerAccount,
          augmentPair,
          augmentRouter,
          USCToken,
          USDTToken,
          userAccount,
        } = await loadFixture(v2LpAutoProviderFixture);

        const provideLiquidityAmount = 100000;

        await USCToken.connect(deployerAccount).mint(
          userAccount.address,
          provideLiquidityAmount
        );

        await USCToken.connect(userAccount).approve(
          LpAutoProviderV2.address,
          provideLiquidityAmount
        );

        await augmentPair.mock.getReserves.returns(100000000, 100000000, 0); // 1:1
        await augmentPair.mock.token0.returns(USCToken.address);
        await augmentPair.mock.token1.returns(USDTToken.address);
        await augmentRouter.mock.getAmountOut.returns(49875); // with fee 0.25%
        await augmentPair.mock.transferFrom.returns(true);

        await augmentRouter.mock.swapExactTokensForTokens.returns([
          50000, 49870,
        ]); // Swap succeeds as 0.5% of slippage is 49625

        await augmentRouter.mock.addLiquidity.returns(0, 0, 0);

        await LpAutoProviderV2.connect(userAccount).provideLiquidity(
          USCToken.address,
          provideLiquidityAmount
        );
        // await expect(
        // ).to.eventually.fulfilled;
      });

      it("provide liquidity with usdt successfully", async function () {
        const {
          LpAutoProviderV2,
          deployerAccount,
          augmentPair,
          augmentRouter,
          USDTToken,
          USCToken,
          userAccount,
        } = await loadFixture(v2LpAutoProviderFixture);

        const provideLiquidityAmount = 100000;

        await USDTToken.connect(deployerAccount).mint(
          userAccount.address,
          provideLiquidityAmount
        );

        await USDTToken.connect(userAccount).approve(
          LpAutoProviderV2.address,
          provideLiquidityAmount
        );

        await augmentPair.mock.getReserves.returns(100000000, 100000000, 0); // 1:1
        await augmentPair.mock.token0.returns(USCToken.address);
        await augmentPair.mock.token1.returns(USDTToken.address);
        await augmentRouter.mock.getAmountOut.returns(49875); // with fee 0.25%
        await augmentPair.mock.transferFrom.returns(true);

        await augmentRouter.mock.swapExactTokensForTokens.returns([
          50000, 49870,
        ]); // Swap succeeds as 0.5% of slippage is 49625

        await augmentRouter.mock.addLiquidity.returns(0, 0, 0);

        await expect(
          LpAutoProviderV2.connect(userAccount).provideLiquidity(
            USDTToken.address,
            provideLiquidityAmount
          )
        ).to.eventually.fulfilled;
      });
    });

    describe("error cases", function () {
      it("throw if slippage protection is triggered", async function () {
        const {
          LpAutoProviderV2,
          deployerAccount,
          augmentPair,
          augmentRouter,
          USDTToken,
          USCToken,
          userAccount,
        } = await loadFixture(v2LpAutoProviderFixture);

        const provideLiquidityAmount = 100000;

        await USDTToken.connect(deployerAccount).mint(
          userAccount.address,
          provideLiquidityAmount
        );

        await USDTToken.connect(userAccount).approve(
          LpAutoProviderV2.address,
          provideLiquidityAmount
        );

        await augmentPair.mock.getReserves.returns(100000000, 100000000, 0); // 1:1
        await augmentPair.mock.token0.returns(USCToken.address);
        await augmentPair.mock.token1.returns(USDTToken.address);
        await augmentRouter.mock.getAmountOut.returns(49875); // with fee 0.25%
        await augmentPair.mock.transferFrom.returns(true);

        await augmentRouter.mock.swapExactTokensForTokens.returns([
          50000, 49620,
        ]); // Swap fails as 0.5% of slippage is 49625

        await expect(
          LpAutoProviderV2.connect(userAccount).provideLiquidity(
            USDTToken.address,
            provideLiquidityAmount
          )
        ).to.eventually.rejectedWith(SLIPPAGE_MSG);
      });

      it("throws if contract is paused", async function () {
        const { LpAutoProviderV2, ownerAccount, USDTToken } = await loadFixture(
          v2LpAutoProviderFixture
        );

        await LpAutoProviderV2.connect(ownerAccount).pause();
        await expect(
          LpAutoProviderV2.provideLiquidity(USDTToken.address, 1000)
        ).to.eventually.rejectedWith(PAUSED_MSG);
      });

      it("throws if token address is zero", async function () {
        const { LpAutoProviderV2, augmentPair, USCToken, USDTToken } =
          await loadFixture(v2LpAutoProviderFixture);

        await augmentPair.mock.token0.returns(USCToken.address);
        await augmentPair.mock.token1.returns(USDTToken.address);

        await expect(
          LpAutoProviderV2.provideLiquidity(ZERO_ADDRESS, 1000)
        ).to.eventually.rejectedWith("provideLiquidity: invalid token address");
      });

      it("throws if amount is zero", async function () {
        const { LpAutoProviderV2, augmentPair, USCToken, USDTToken } =
          await loadFixture(v2LpAutoProviderFixture);

        await augmentPair.mock.token0.returns(USCToken.address);
        await augmentPair.mock.token1.returns(USDTToken.address);

        await expect(
          LpAutoProviderV2.provideLiquidity(USDTToken.address, 0)
        ).to.eventually.rejectedWith("provideLiquidity: bad amount");
      });
    });
  });

  describe("withdraw lp tokens", function () {
    describe("happy path", function () {
      it("should allow withdrawer to withdraw tokens", async function () {
        const { LpAutoProviderV2, augmentPair, timelockAccount } =
          await loadFixture(v2LpAutoProviderFixture);

        const lpAmount = BigNumber.from(1000);

        await augmentPair.mock.balanceOf.returns(lpAmount);
        await augmentPair.mock.transfer.returns(true);

        await expect(
          LpAutoProviderV2.connect(timelockAccount).withdrawLpTokens()
        ).to.eventually.fulfilled;
      });

      it("throws if user tries to withdraw", async function () {
        const { LpAutoProviderV2, userAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        await expect(
          LpAutoProviderV2.connect(userAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });

      it("throws if owner account tries to withdraw", async function () {
        const { LpAutoProviderV2, ownerAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        await expect(
          LpAutoProviderV2.connect(ownerAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });
    });

    describe("error cases", function () {
      it("throws if owner tries to withdraw", async function () {
        const { LpAutoProviderV2, ownerAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        await expect(
          LpAutoProviderV2.connect(ownerAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });

      it("throws if user tries to withdraw", async function () {
        const { LpAutoProviderV2, userAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        await expect(
          LpAutoProviderV2.connect(userAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });

      it("throws if there is no lp token to withdraw", async function () {
        const { LpAutoProviderV2, timelockAccount, augmentPair } =
          await loadFixture(v2LpAutoProviderFixture);

        await augmentPair.mock.balanceOf.returns(0);

        await expect(
          LpAutoProviderV2.connect(timelockAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith("withdrawLpTokens: withdraw zero amount");
      });
    });
  });

  describe("grant role", function () {
    describe("happy path", function () {
      it("should allow owner to grant role", async function () {
        const { LpAutoProviderV2, ownerAccount, userAccount, augmentPair } =
          await loadFixture(v2LpAutoProviderFixture);

        await expect(
          LpAutoProviderV2.connect(ownerAccount).grantRole(
            WITHDRAWER_ROLE,
            userAccount.address
          )
        ).to.eventually.fulfilled;

        await augmentPair.mock.balanceOf.returns(0);

        await expect(
          LpAutoProviderV2.connect(userAccount).withdrawLpTokens()
        ).to.eventually.rejectedWith("withdrawLpTokens: withdraw zero amount");
      });
    });

    describe("error cases", function () {
      it("throws if user tries to grant role", async function () {
        const { LpAutoProviderV2, userAccount } = await loadFixture(
          v2LpAutoProviderFixture
        );

        await expect(
          LpAutoProviderV2.connect(userAccount).grantRole(
            WITHDRAWER_ROLE,
            userAccount.address
          )
        ).to.eventually.rejectedWith(ACCESS_CONTROL_MSG);
      });
    });
  });
});
