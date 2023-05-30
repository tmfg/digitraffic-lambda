import { sendMessage } from "../../service/queue-service";
import * as PilotwebService from "../../service/pilotweb";
import { PortactivityEnvKeys } from "../../keys";
import { SecretHolder } from "@digitraffic/common/dist/aws/runtime/secrets/secret-holder";
import { RdsHolder } from "@digitraffic/common/dist/aws/runtime/secrets/rds-holder";
import { GenericSecret } from "@digitraffic/common/dist/aws/runtime/secrets/secret";
import { getEnvVariable } from "@digitraffic/common/dist/utils/utils";
import { logger } from "@digitraffic/common/dist/aws/runtime/dt-logger-default";

const sqsQueueUrl = getEnvVariable(PortactivityEnvKeys.PORTACTIVITY_QUEUE_URL);

interface PilotWebSecret extends GenericSecret {
    readonly url: string;
    readonly auth: string;
}

const rdsHolder = RdsHolder.create();
const secretHolder = SecretHolder.create<PilotWebSecret>("pilotweb");

export const handler = function (): Promise<void> {
    return rdsHolder
        .setCredentials()
        .then(() => secretHolder.get())
        .then(async (secret) => {
            const timestamps = await PilotwebService.getMessagesFromPilotweb(secret.url, secret.auth);
            logger.info({
                method: "UpdatePilotwebTimestamps.handler",
                message: `received ${timestamps.length} pilotages`
            });

            await Promise.allSettled(timestamps.map((ts) => sendMessage(ts, sqsQueueUrl)));
        })
        .catch((error) => {
            logger.error({
                method: "UpdatePilotwebTimestamps.handler",
                error: error
            });
        });
};
