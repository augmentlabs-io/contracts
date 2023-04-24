const { BigNumber } = require("ethers");
const { deployMockContract } = require("@ethereum-waffle/mock-contract");
const { ethers, upgrades } = require("hardhat");

const MINTER_ROLE = ethers.utils.keccak256(Buffer.from("MINTER_ROLE"));
const UPGRADER_ROLE = ethers.utils.keccak256(Buffer.from("UPGRADER_ROLE"));
const WITHDRAWER_ROLE = ethers.utils.keccak256(Buffer.from("WITHDRAWER_ROLE"));
const PAUSER_ROLE = ethers.utils.keccak256(Buffer.from("PAUSER_ROLE"));
const REDEEMER_ROLE = ethers.utils.keccak256(Buffer.from("REDEEMER_ROLE"));
const OPERATOR_ROLE = ethers.utils.keccak256(Buffer.from("OPERATOR_ROLE"));
const MAX_UINT_256 = ethers.constants.MaxUint256;
const ZERO_ADDRESS = ethers.constants.AddressZero;
const SECONDS_A_YEAR = 365 * 24 * 60 * 60;

const PAUSED_MSG = "Pausable: paused";
const SAFE_TRANSFER_MSG = "STF";
const OWNABLE_MSG = "Ownable: caller is not the owner";
const ACCESS_CONTROL_MSG = "AccessControl:";
const SLIPPAGE_MSG = "provideLiquidity: slippage protection";

const ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const OneEtherZeros = "000000000000000000";

async function phase1Fixture() {
  const accounts = await ethers.getSigners();

  const initialCompanyAGCAmount = BigNumber.from(`30000000${OneEtherZeros}`); // 30 million tokens

  const ROIPerYear = 2000; // 2000 = 20%

  const multisigAccount = accounts[3];
  const account1 = accounts[1];
  const ownerAccount = accounts[0];

  const _AGCToken = await ethers.getContractFactory("AGC");
  const _USCToken = await ethers.getContractFactory("USC");
  const _TokenController = await ethers.getContractFactory("TokenController");
  const _MasterChef = await ethers.getContractFactory("MasterChef");
  const _AGCGovernor = await ethers.getContractFactory("AGCGovernor");

  // Deploy AGC Token
  const AGCToken = await upgrades.deployProxy(
    _AGCToken,
    [multisigAccount.address, initialCompanyAGCAmount],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await AGCToken.deployed();

  // Multisig has all roles
  await AGCToken.grantRole(ADMIN_ROLE, multisigAccount.address);
  await AGCToken.grantRole(PAUSER_ROLE, multisigAccount.address);
  await AGCToken.grantRole(UPGRADER_ROLE, multisigAccount.address);
  await AGCToken.grantRole(OPERATOR_ROLE, multisigAccount.address);

  const USCToken = await upgrades.deployProxy(_USCToken, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await USCToken.deployed();

  // Multisig has all roles
  await USCToken.grantRole(ADMIN_ROLE, multisigAccount.address);
  await USCToken.grantRole(PAUSER_ROLE, multisigAccount.address);
  await USCToken.grantRole(UPGRADER_ROLE, multisigAccount.address);
  await USCToken.grantRole(MINTER_ROLE, multisigAccount.address);

  // Deploy token controller
  const TokenController = await upgrades.deployProxy(
    _TokenController,
    [AGCToken.address, USCToken.address],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await TokenController.deployed();

  // Multisig has all roles
  await TokenController.grantRole(ADMIN_ROLE, multisigAccount.address);
  await TokenController.grantRole(PAUSER_ROLE, multisigAccount.address);
  await TokenController.grantRole(UPGRADER_ROLE, multisigAccount.address);
  await TokenController.grantRole(REDEEMER_ROLE, multisigAccount.address);

  // TokenController has operator role of AGC
  await AGCToken.grantRole(OPERATOR_ROLE, TokenController.address);

  // TokenController has minter role of AGC
  await USCToken.grantRole(MINTER_ROLE, TokenController.address);

  // Deploy MasterChef
  const MasterChef = await upgrades.deployProxy(
    _MasterChef,
    [USCToken.address, ROIPerYear],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await MasterChef.deployed();

  // Grant MasterChef minter role of USC
  await USCToken.grantRole(MINTER_ROLE, MasterChef.address);

  // Backend renounces all important roles. Can only have redeemer role.
  await TokenController.renounceRole(ADMIN_ROLE, ownerAccount.address);
  await TokenController.renounceRole(PAUSER_ROLE, ownerAccount.address);
  await TokenController.renounceRole(UPGRADER_ROLE, ownerAccount.address);

  // Backend renounces all important roles. Can only have mint role.
  await USCToken.renounceRole(ADMIN_ROLE, ownerAccount.address);
  await USCToken.renounceRole(PAUSER_ROLE, ownerAccount.address);
  await USCToken.renounceRole(UPGRADER_ROLE, ownerAccount.address);

  // Backend renounces all important roles. Can only have mint role.
  await AGCToken.renounceRole(ADMIN_ROLE, ownerAccount.address);
  await AGCToken.renounceRole(PAUSER_ROLE, ownerAccount.address);
  await AGCToken.renounceRole(UPGRADER_ROLE, ownerAccount.address);

  // Multisig should be owner of masterchef
  await MasterChef.transferOwnership(multisigAccount.address);

  // For testing only

  return {
    tokenController: TokenController,
    AGCToken: AGCToken,
    USCToken: USCToken,
    owner: ownerAccount,
    account1,
    account2: accounts[2],
    multisig: multisigAccount,
    initialCompanyAGCAmount,
    MasterChef,
    ROIPerYear,
  };
}

async function v2LpAutoProviderFixture() {
  const accounts = await ethers.getSigners();
  const [deployerAccount, timelockAccount, ownerAccount, userAccount] =
    accounts;

  const _USCToken = await ethers.getContractFactory("USC");
  const _LpToken = await ethers.getContractFactory("USC");
  const _USDTToken = await ethers.getContractFactory("USC");
  const _BscLpAutoProvider = await ethers.getContractFactory(
    "LpAutoProviderV2"
  );

  const USCToken = await upgrades.deployProxy(_USCToken, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await USCToken.deployed();

  const USDTToken = await upgrades.deployProxy(_USDTToken, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await USDTToken.deployed();

  const IAugmentPair = require("../artifacts/contracts/interfaces/IAugmentPair.sol/IAugmentPair.json");
  const IAugmentRouter01 = require("../artifacts/contracts/interfaces/IAugmentRouter01.sol/IAugmentRouter01.json");

  const augmentPair = await deployMockContract(
    deployerAccount,
    IAugmentPair.abi
  );

  const augmentRouter = await deployMockContract(
    deployerAccount,
    IAugmentRouter01.abi
  );

  const LpAutoProviderV2 = await upgrades.deployProxy(
    _BscLpAutoProvider,
    [
      ownerAccount.address,
      timelockAccount.address,
      augmentPair.address,
      augmentRouter.address,
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  return {
    augmentPair,
    USCToken,
    USDTToken,
    augmentRouter,
    timelockAccount,
    deployerAccount,
    ownerAccount,
    userAccount,
    LpAutoProviderV2,
  };
}

async function lpAutoProviderFixture() {
  const accounts = await ethers.getSigners();
  const tokenId = 12345;
  const feeTier = 100; // 0.01%;
  const [deployerAccount, timelockAccount, ownerAccount, userAccount] =
    accounts;

  const nftPositionManagerAddress =
    "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

  const routerAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  const _USCToken = await ethers.getContractFactory("USC");
  const _USDTToken = await ethers.getContractFactory("USC");
  const _lpAutoProvider = await ethers.getContractFactory("LpAutoProviderV3");

  const _NFTManager = require("../artifacts/contracts/INonfungiblePositionManager.sol/INonfungiblePositionManager.json");
  const _UniswapRouter = require("../artifacts/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json");

  const mockNftManager = await deployMockContract(
    deployerAccount,
    _NFTManager.abi
  );

  const mockRouter = await deployMockContract(
    deployerAccount,
    _UniswapRouter.abi
  );

  const USCToken = await upgrades.deployProxy(_USCToken, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await USCToken.deployed();

  const USDTToken = await upgrades.deployProxy(_USDTToken, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await USDTToken.deployed();

  const lpAutoProvider = await upgrades.deployProxy(
    _lpAutoProvider,
    [
      ownerAccount.address,
      USDTToken.address,
      USCToken.address,
      feeTier,
      tokenId,
      timelockAccount.address,
      mockNftManager.address,
      mockRouter.address,
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  return {
    tokenId,
    ownerAccount,
    deployerAccount,
    userAccount,
    timelockAccount,
    lpAutoProvider,
    USCToken,
    USDTToken,
    feeTier,
    NftManager: mockNftManager,
    SwapRouter: mockRouter,
  };
}

module.exports = {
  phase1Fixture,
  lpAutoProviderFixture,
  v2LpAutoProviderFixture,
  MINTER_ROLE,
  ADMIN_ROLE,
  PAUSER_ROLE,
  UPGRADER_ROLE,
  REDEEMER_ROLE,
  WITHDRAWER_ROLE,
  OPERATOR_ROLE,
  MAX_UINT_256,
  SECONDS_A_YEAR,
  ZERO_ADDRESS,
  PAUSED_MSG,
  SAFE_TRANSFER_MSG,
  ACCESS_CONTROL_MSG,
  OWNABLE_MSG,
  SLIPPAGE_MSG,
};
