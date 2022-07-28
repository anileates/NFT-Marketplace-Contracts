// migrations/2_deploy.js
const CollectionFactory = artifacts.require('CollectionFactory');

module.exports = async function (deployer) {
    await deployer.deploy(CollectionFactory);
};