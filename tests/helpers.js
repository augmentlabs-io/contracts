const { BigNumber } = require("ethers");
const { SECONDS_A_YEAR } = require("./fixtures");

const defaultMintAmount = BigNumber.from(1000);

function calculateRewards(_roiPerYear, _accumulated, _totalStaked, _timeDiff) {
  const roiPerYear = BigNumber.from(_roiPerYear);
  const accmumulated = BigNumber.from(_accumulated);
  const totalStaked = BigNumber.from(_totalStaked);
  const timeDiff = BigNumber.from(_timeDiff);

  return accmumulated.add(
    totalStaked.mul(timeDiff).mul(roiPerYear).div(1e4).div(SECONDS_A_YEAR)
  );
}

function convertDateToSeconds(date) {
  return Math.round(date.valueOf() / 1000);
}

async function mintSomeUSCToAccount(
  USCToken,
  { minter, account, mintAmount = defaultMintAmount }
) {
  return USCToken.connect(minter).mint(account.address, mintAmount);
}

async function mintSomeAGCToAccount(
  AGCToken,
  { minter, account, mintAmount = defaultMintAmount }
) {
  return AGCToken.connect(minter).mint(account.address, mintAmount);
}

module.exports = {
  calculateRewards,
  convertDateToSeconds,
  mintSomeUSCToAccount,
  mintSomeAGCToAccount,
  defaultMintAmount,
};
