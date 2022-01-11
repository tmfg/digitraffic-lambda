import {DatabaseChecker} from "digitraffic-common/aws/infra/canaries/database-checker";

const secretId = process.env.SECRET_ID as string;

export const handler = () => {
    const checker = new DatabaseChecker(secretId);

    checker.notEmpty('states are not empty',
        'select count(*) from aton_fault_state');

    checker.notEmpty('fault types are not empty',
        'select count(*) from aton_fault_type');

    checker.notEmpty('types are not empty',
        'select count(*) from aton_type');

    checker.notEmpty('aton_fault timestamps updated in last 24 hours',
        'select count(*) from aton_fault where entry_timestamp > now() - interval \'24 hours\'');

    return checker.expect();
};
