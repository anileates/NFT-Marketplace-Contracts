// migrations/2_deploy.js
const MyNFT = artifacts.require('MyNFT');

module.exports = async function (deployer) {
    await deployer.deploy(MyNFT);
};