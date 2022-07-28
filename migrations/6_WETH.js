// migrations/2_deploy.js
const Weth9 = artifacts.require('Weth9');

module.exports = async function (deployer) {
    await deployer.deploy(Weth9);
};