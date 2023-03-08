import dotenv from "dotenv";

dotenv.config();

import "tsconfig-paths/register";

import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import { HardhatUserConfig } from "hardhat/types";

export default <HardhatUserConfig>{
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  gasReporter: {
    enabled: true,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
};
