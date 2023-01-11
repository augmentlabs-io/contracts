const { BigNumber } = require("ethers");
const { ethers, upgrades } = require("hardhat");

const MINTER_ROLE = ethers.utils.keccak256(Buffer.from("MINTER_ROLE"));
const UPGRADER_ROLE = ethers.utils.keccak256(Buffer.from("UPGRADER_ROLE"));
const PAUSER_ROLE = ethers.utils.keccak256(Buffer.from("PAUSER_ROLE"));

const ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

async function phase1Fixture() {
  const accounts = await ethers.getSigners();

  const ratio = BigNumber.from(10);
  const initialCOINXAmount = BigNumber.from(1000);
  const initialUSDXAmount = BigNumber.from(1000);

  const multisigAccount = accounts[3];
  const account1 = accounts[1];
  const ownerAccount = accounts[0];

  const _COINXToken = await ethers.getContractFactory("COINX");
  const _USDXToken = await ethers.getContractFactory("USDX");
  const _TokenController = await ethers.getContractFactory("TokenController");

  const COINXToken = await upgrades.deployProxy(_COINXToken, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await COINXToken.deployed();

  await COINXToken.grantRole(ADMIN_ROLE, multisigAccount.address);

  const USDXToken = await upgrades.deployProxy(_USDXToken, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await USDXToken.deployed();

  await USDXToken.grantRole(ADMIN_ROLE, multisigAccount.address);

  const TokenController = await upgrades.deployProxy(
    _TokenController,
    [COINXToken.address, USDXToken.address, ethers.BigNumber.from(10)],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await TokenController.deployed();

  // For testing only
  await COINXToken.mint(account1.address, initialCOINXAmount);
  await USDXToken.mint(account1.address, initialUSDXAmount);

  // Make sure to test that multisig can pause it.
  await TokenController.transferOwnership(multisigAccount.address);

  // Multisig as minter
  await COINXToken.grantRole(MINTER_ROLE, multisigAccount.address);
  await USDXToken.grantRole(MINTER_ROLE, multisigAccount.address);

  // Multisig as pauser
  await COINXToken.grantRole(PAUSER_ROLE, multisigAccount.address);
  await USDXToken.grantRole(PAUSER_ROLE, multisigAccount.address);

  // Multisig as upgrader
  await COINXToken.grantRole(UPGRADER_ROLE, multisigAccount.address);
  await USDXToken.grantRole(UPGRADER_ROLE, multisigAccount.address);

  // TokenController as minter
  await COINXToken.grantRole(MINTER_ROLE, TokenController.address);
  await USDXToken.grantRole(MINTER_ROLE, TokenController.address);

  return {
    tokenController: TokenController,
    coinxToken: COINXToken,
    usdxToken: USDXToken,
    owner: ownerAccount,
    account1,
    account2: accounts[2],
    multisig: multisigAccount,
    ratio,
    initialCOINXAmount,
    initialUSDXAmount,
  };
}

async function upgradeFixture() {
  const original = await phase1Fixture();
  const _TokenController = await ethers.getContractFactory("TokenController");
  const _TokenControllerV2 = await ethers.getContractFactory(
    "TokenControllerV2"
  );

  await upgrades.validateImplementation(_TokenControllerV2, { kind: "uups" });
  await upgrades.validateUpgrade(_TokenController, _TokenControllerV2, {
    kind: "uups",
  });

  const tokenControllerV2 = await _TokenControllerV2.deploy();
  await tokenControllerV2.deployed();

  // Upgrade v1 to v2
  await original.tokenController
    .connect(original.multisig)
    .upgradeTo(tokenControllerV2.address);

  await upgrades.forceImport(
    original.tokenController.address,
    _TokenControllerV2,
    { kind: "uups" }
  );

  await upgrades.validateImplementation(_TokenControllerV2, { kind: "uups" });
  await upgrades.validateUpgrade(_TokenController, _TokenControllerV2, {
    kind: "uups",
  });

  return {
    ...original,
  };
}

module.exports = {
  phase1Fixture,
  upgradeFixture,
  MINTER_ROLE,
  ADMIN_ROLE,
  PAUSER_ROLE,
  UPGRADER_ROLE,
};
