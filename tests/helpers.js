const { BigNumber } = require("ethers");
const { SECONDS_A_YEAR } = require("./fixtures_2");

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

module.exports = {
  calculateRewards,
  convertDateToSeconds,
};
