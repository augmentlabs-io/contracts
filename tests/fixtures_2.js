const { BigNumber, constants } = require('ethers');
const { ethers, upgrades } = require('hardhat');

const MINTER_ROLE = ethers.utils.keccak256(Buffer.from('MINTER_ROLE'));
const UPGRADER_ROLE = ethers.utils.keccak256(Buffer.from('UPGRADER_ROLE'));
const PAUSER_ROLE = ethers.utils.keccak256(Buffer.from('PAUSER_ROLE'));
const REDEEMER_ROLE = ethers.utils.keccak256(Buffer.from('REDEEMER_ROLE'));

const ADMIN_ROLE =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

async function phase1Fixture() {
  const accounts = await ethers.getSigners();

  const initialAGCAmount = BigNumber.from(1000);
  const initialUSCAmount = BigNumber.from(1000);
  const initialUSTAmount = BigNumber.from(1000);

  const ROIPerYear = 2000; // 2000 = 20%
  const blockPerYear = 2628000;
  const blockPerDay = 7200;

  const USDTPoolIndex = 0;

  const multisigAccount = accounts[3];
  const account1 = accounts[1];
  const ownerAccount = accounts[0];

  const _AGCToken = await ethers.getContractFactory('AGC');
  const _USCToken = await ethers.getContractFactory('USC');
  const _USDTToken = await ethers.getContractFactory('USDT');
  const _TokenController = await ethers.getContractFactory('TokenController');
  const _MasterChef = await ethers.getContractFactory('MasterChef');

  // For testing only. Deploy UST
  const USDTToken = await upgrades.deployProxy(_USDTToken, [], {
    initializer: 'initialize',
    kind: 'uups',
  });

  await USDTToken.deployed();

  // Deploy AGC Token
  const AGCToken = await upgrades.deployProxy(
    _AGCToken,
    [multisigAccount.address],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await AGCToken.deployed();

  // Multisig has all roles
  await AGCToken.grantRole(ADMIN_ROLE, multisigAccount.address);
  await AGCToken.grantRole(PAUSER_ROLE, multisigAccount.address);
  await AGCToken.grantRole(UPGRADER_ROLE, multisigAccount.address);
  await AGCToken.grantRole(MINTER_ROLE, multisigAccount.address);

  const USCToken = await upgrades.deployProxy(_USCToken, [], {
    initializer: 'initialize',
    kind: 'uups',
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
    [AGCToken.address, USCToken.address, multisigAccount.address],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await TokenController.deployed();

  // USC allowance grant from Multisig to TokenController.
  await USCToken.connect(multisigAccount).approve(
    TokenController.address,
    constants.MaxUint256,
  );

  // Multisig has all roles
  await TokenController.grantRole(ADMIN_ROLE, multisigAccount.address);
  await TokenController.grantRole(PAUSER_ROLE, multisigAccount.address);
  await TokenController.grantRole(UPGRADER_ROLE, multisigAccount.address);
  await TokenController.grantRole(REDEEMER_ROLE, multisigAccount.address);

  // TokenController as minter
  await AGCToken.grantRole(MINTER_ROLE, TokenController.address);
  await USCToken.grantRole(MINTER_ROLE, TokenController.address);

  // Deploy MasterChef
  const MasterChef = await upgrades.deployProxy(
    _MasterChef,
    [USCToken.address, ROIPerYear, blockPerYear],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await MasterChef.deployed();

  // Grant MasterChef minter role of USC
  await USCToken.grantRole(MINTER_ROLE, MasterChef.address);

  // Add UST pool
  await MasterChef.add(USDTToken.address, 1, blockPerDay);

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
  await AGCToken.mint(account1.address, initialAGCAmount);
  await USCToken.mint(account1.address, initialUSCAmount);
  await USDTToken.mint(account1.address, initialUSTAmount);

  return {
    tokenController: TokenController,
    AGCToken: AGCToken,
    USCToken: USCToken,
    owner: ownerAccount,
    account1,
    account2: accounts[2],
    multisig: multisigAccount,
    initialAGCAmount,
    initialUSCAmount,
    initialUSTAmount,
    USDTToken,
    MasterChef,
    ROIPerYear,
    blockPerYear,
    blockPerDay,
    USDTPoolIndex,
  };
}

module.exports = {
  phase1Fixture,
  MINTER_ROLE,
  ADMIN_ROLE,
  PAUSER_ROLE,
  UPGRADER_ROLE,
  REDEEMER_ROLE,
};
