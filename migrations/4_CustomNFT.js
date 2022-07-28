// migrations/2_deploy.js
const CustomNFT = artifacts.require('CustomNFT');

module.exports = async function (deployer) {
    await deployer.deploy(CustomNFT, "Default Name", "Default symbol");
};