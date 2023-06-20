import { PortactivityEnvKeys, PortactivitySecretKeys } from "../../keys";
import { SNSEvent } from "aws-lambda";
import { sendMessage } from "../../service/queue-service";
import { AwakeAiPortApi } from "../../api/awake_ai_port";
import { SecretHolder } from "@digitraffic/common/dist/aws/runtime/secrets/secret-holder";
import { AwakeAiETAPortService } from "../../service/awake_ai_eta_port";
import { GenericSecret } from "@digitraffic/common/dist/aws/runtime/secrets/secret";
import { RdsHolder } from "@digitraffic/common/dist/aws/runtime/secrets/rds-holder";
import { logger } from "@digitraffic/common/dist/aws/runtime/dt-logger-default";
import { getEnvVariable } from "@digitraffic/common/dist/utils/utils";

const queueUrl = getEnvVariable(PortactivityEnvKeys.PORTACTIVITY_QUEUE_URL);

const expectedKeys = [PortactivitySecretKeys.AWAKE_URL, PortactivitySecretKeys.AWAKE_AUTH];

const rdsHolder = RdsHolder.create();
const secretHolder = SecretHolder.create<GenericSecret>("", expectedKeys);

let service: AwakeAiETAPortService | undefined;

export function handler(event: SNSEvent): Promise<void> {
    return rdsHolder
        .setCredentials()
        .then(() => secretHolder.get())
        .then(async (secret) => {
            // always a single event, guaranteed by SNS
            const locode = event.Records[0].Sns.Message;

            if (!service) {
                service = new AwakeAiETAPortService(
                    new AwakeAiPortApi(secret["awake.voyagesurl"], secret["awake.voyagesauth"])
                );
            }
            const timestamps = await service.getAwakeAiTimestamps(locode);

            const start = Date.now();
            logger.info({
                method: "UpdateAwakeAiETAPortTimestamps.handler",
                customTimestampsReceivedCount: timestamps.length
            });
            await Promise.allSettled(timestamps.map((ts) => sendMessage(ts, queueUrl)));
            logger.info({
                method: "UpdateAwakeAiETAPortTimestamps.handler",
                tookMs: Date.now() - start
            });
        });
}
