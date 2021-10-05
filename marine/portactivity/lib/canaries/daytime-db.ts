import {DatabaseChecker} from "digitraffic-common/canaries/database-checker";
import {EventSource} from "../model/eventsource";
import {SECRET_ID} from "digitraffic-common/model/lambda-environment";

const secretId = process.env[SECRET_ID] as string;

export const handler = async () => {
    const checker = new DatabaseChecker(secretId);

    return checker.expect([
        {
            name: 'port call timestamps in last hour',
            sql: "select count(*) from port_call_timestamp where record_time > (current_timestamp - interval '1 hour')"
        },
        {
            name: 'Awake.AI ETA timestamps in last hour',
            sql: `
                select count(*) from port_call_timestamp
                where record_time > (current_timestamp - interval '1 hour') AND
                      event_source = '${EventSource.AWAKE_AI}'`
        }
    ]);
};
