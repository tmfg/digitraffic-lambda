import {DatabaseChecker} from "digitraffic-common/aws/infra/canaries/database-checker";
import {SECRET_ID} from "digitraffic-common/aws/types/lambda-environment";
import {DataType} from "digitraffic-common/database/last-updated";

const secretId = process.env[SECRET_ID] as string;

export const handler = () => {
    const checker = new DatabaseChecker(secretId);

    checker.notEmpty('domains not empty',
        'select count(*) from counting_site_domain');

    checker.notEmpty('counters data updated in last 48 hours',
        'select count(*) from counting_site_counter where last_data_timestamp > now() - interval \'48 hours\'');

    checker.notEmpty('data updated in last 48 hours',
        'select count(*) from counting_site_data where data_timestamp > now() - interval \'48 hours\'');

    checker.notEmpty('data has values in last 48 hours',
        `with data as (
                select counter_id, sum(count) from counting_site_data csd  where data_timestamp > now() - interval '48 hours'
                group by counter_id
            ) 
            select count(*) from data
            where sum > 0`);

    checker.notEmpty('metadata updated in last 2 hours',
        `select count(*) from data_updated where data_type = '${DataType.COUNTING_SITES_METADATA_CHECK}' and updated > now() - interval '2 hours'`);

    checker.notEmpty('data updated in last 2 hours',
        `select count(*) from data_updated where data_type = '${DataType.COUNTING_SITES_DATA}' and updated > now() - interval '2 hours'`);

    return checker.expect();
};
