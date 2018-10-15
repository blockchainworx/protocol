import Environment from '~/utils/environment/Environment';

import { default as deployContract } from '~/utils/solidity/deploy';

const deployPolicyManagerFactory = async (environment?: Environment) => {
  const address = await deployContract(
    'fund/policies/PolicyManagerFactory.sol',
    null,
    environment,
  );

  return address;
};

export default deployPolicyManagerFactory;