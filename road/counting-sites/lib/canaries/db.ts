import {DatabaseChecker} from "digitraffic-common/canaries/database-checker";
import {SECRET_ID} from "digitraffic-common/model/lambda-environment";

const secretId = process.env[SECRET_ID] as string;

export const handler = async () => {
    const checker = new DatabaseChecker(secretId);

    return checker.expect([{
        name: 'domains not empty',
        sql: 'select count(*) from counting_site_domain'
    }, {
        name: 'counters data updated in last 24 hours',
        sql: 'select count(*) from counting_site_counter csc where last_data_timestamp > now() - interval \'24 hours\''
    }, {
        name: 'data updated in last 24 hours',
        sql: 'select count(*) from counting_site_data csc where data_timestamp > now() - interval \'24 hours\''
    }, {
        name: 'data has values in last 24 hours',
        sql: `
            with data as (
                select counter_id, sum(count) from counting_site_data csd  where data_timestamp > now() - interval '24 hours'
                group by counter_id
            ) 
            select count(*) from data
            where sum > 0`
    }]);
};
