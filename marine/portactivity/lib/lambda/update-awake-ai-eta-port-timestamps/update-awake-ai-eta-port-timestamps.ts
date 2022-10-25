import {PortactivityEnvKeys, PortactivitySecretKeys} from "../../keys";
import {SNSEvent} from "aws-lambda";
import {sendMessage} from "../../service/queue-service";
import {AwakeAiETAPortApi} from "../../api/awake_ai_port";
import {SecretHolder} from "@digitraffic/common/aws/runtime/secrets/secret-holder";
import {AwakeAiETAPortService} from "../../service/awake_ai_eta_port";
import {GenericSecret} from "@digitraffic/common/aws/runtime/secrets/secret";
import {envValue} from "@digitraffic/common/aws/runtime/environment";
import {RdsHolder} from "@digitraffic/common/aws/runtime/secrets/rds-holder";

const queueUrl = envValue(PortactivityEnvKeys.PORTACTIVITY_QUEUE_URL);

const expectedKeys = [
    PortactivitySecretKeys.AWAKE_URL,
    PortactivitySecretKeys.AWAKE_AUTH,
];

const rdsHolder = RdsHolder.create();
const secretHolder = SecretHolder.create<GenericSecret>("", expectedKeys);

let service: AwakeAiETAPortService

export function handler(event: SNSEvent): Promise<void> {
    return rdsHolder.setCredentials()
        .then(() => secretHolder.get())
        .then(async secret => {
            // always a single event, guaranteed by SNS
            const locode = event.Records[0].Sns.Message;

            if (!service) {
                service = new AwakeAiETAPortService(new AwakeAiETAPortApi(secret["awake.voyagesurl"], secret["awake.voyagesauth"]));
            }
            const timestamps = await service.getAwakeAiTimestamps(locode);

            const start = Date.now();
            console.info(`method=updateAwakeAiETAPortTimestampsHandler Sending ${timestamps.length} timestamps to queue..`);
            await Promise.allSettled(timestamps.map(ts => sendMessage(ts, queueUrl)));
            console.info('method=updateAwakeAiETAPortTimestampsHandler ..done in tookMs=%d', Date.now() - start);
        });
}
