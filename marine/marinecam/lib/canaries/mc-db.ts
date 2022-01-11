import {DatabaseChecker} from "digitraffic-common/aws/infra/canaries/database-checker";
import {SECRET_ID} from "digitraffic-common/aws/types/lambda-environment";

const secretId = process.env[SECRET_ID] as string;

export const handler = () => {
    const checker = new DatabaseChecker(secretId);

    checker.notEmpty('cameras not empty',
        'select count(*) from camera');

    checker.notEmpty('cameras updated in last hour',
        'select count(*) from camera where last_updated > now() - interval \'1 hour\'');

    return checker.expect();
};
