const { BigNumber } = require('ethers');

function calculateRewards(_amount, _roiPerYear, _blockDiff, _blocksPerYear) {
  const blockDiff = BigNumber.from(_blockDiff);
  const amount = BigNumber.from(_amount);
  const roiPerYear = BigNumber.from(_roiPerYear);
  const blocksPerYear = BigNumber.from(_blocksPerYear);

  return amount.add(
    amount
      .mul(roiPerYear)
      .mul(blockDiff)
      .div(blocksPerYear)
      .div(BigNumber.from(10000)),
  );
}

module.exports = {
  calculateRewards,
};
