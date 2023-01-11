import dotenv from "dotenv";

dotenv.config();

import "tsconfig-paths/register";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import { HardhatUserConfig } from "hardhat/types";

export default <HardhatUserConfig>{
  solidity: "0.8.9",
  settings: {
    optimizer: {
      enabled: true,
      runs: 300,
    },
  },
};
