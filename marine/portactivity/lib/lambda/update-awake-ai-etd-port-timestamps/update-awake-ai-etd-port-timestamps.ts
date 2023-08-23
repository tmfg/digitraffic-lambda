import { PortactivityEnvKeys, PortactivitySecretKeys } from "../../keys";
import { SecretHolder } from "@digitraffic/common/dist/aws/runtime/secrets/secret-holder";
import { GenericSecret } from "@digitraffic/common/dist/aws/runtime/secrets/secret";
import { RdsHolder } from "@digitraffic/common/dist/aws/runtime/secrets/rds-holder";
import { AwakeAiETDPortService } from "../../service/awake-ai-etd-port";
import { AwakeAiPortApi } from "../../api/awake-ai-port";
import { SNSEvent } from "aws-lambda";
import { getEnvVariable } from "@digitraffic/common/dist/utils/utils";
import { sendMessage } from "../../service/queue-service";
import { logger } from "@digitraffic/common/dist/aws/runtime/dt-logger-default";

const queueUrl = getEnvVariable(PortactivityEnvKeys.PORTACTIVITY_QUEUE_URL);

const expectedKeys = [PortactivitySecretKeys.AWAKE_URL, PortactivitySecretKeys.AWAKE_AUTH];

const rdsHolder = RdsHolder.create();
const secretHolder = SecretHolder.create<GenericSecret>("", expectedKeys);

let service: AwakeAiETDPortService | undefined;

export function handler(event: SNSEvent): Promise<void> {
    return rdsHolder
        .setCredentials()
        .then(() => secretHolder.get())
        .then(async (secret) => {
            // always a single event, guaranteed by SNS
            const locode = event.Records[0].Sns.Message;

            if (!service) {
                service = new AwakeAiETDPortService(
                    new AwakeAiPortApi(secret["awake.voyagesurl"], secret["awake.voyagesauth"])
                );
            }
            const timestamps = await service.getAwakeAiTimestamps(locode);

            const start = Date.now();
            logger.info({
                method: "UpdateAwakeAiETDPortTimestamps.handler",
                customTimestampsReceivedCount: timestamps.length
            });
            await Promise.allSettled(timestamps.map((ts) => sendMessage(ts, queueUrl)));
            logger.info({
                method: "UpdateAwakeAiETDPortTimestamps.handler",
                tookMs: Date.now() - start
            });
        });
}
