// migrations/2_deploy.js
const Market = artifacts.require('Market');

module.exports = async function (deployer) {
    await deployer.deploy(Market);
};