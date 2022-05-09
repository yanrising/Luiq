import { expect } from "chai";
import { ethers } from "hardhat";

describe("Flashswap", function () {
  it("Should be deployable", async function () {
    const Flashswap = await ethers.getContractFactory("Flashswap");
    const flashswap = await Flashswap.deploy("Hello, world!");
    await flashswap.deployed();

    expect(await flashswap.greet()).to.equal("Hola, mundo!");
  });
});
