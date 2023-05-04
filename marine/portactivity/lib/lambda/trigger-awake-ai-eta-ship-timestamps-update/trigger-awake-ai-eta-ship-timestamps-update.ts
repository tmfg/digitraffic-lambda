import * as MessagingUtil from "@digitraffic/common/dist/aws/runtime/messaging";
import { RdsHolder } from "@digitraffic/common/dist/aws/runtime/secrets/rds-holder";
import { getEnvVariable } from "@digitraffic/common/dist/utils/utils";
import { SNS } from "aws-sdk";
import * as R from "ramda";
import { PortactivityEnvKeys } from "../../keys";
import { ports } from "../../service/portareas";
import * as TimestampService from "../../service/timestamps";

const publishTopic = getEnvVariable(PortactivityEnvKeys.PUBLISH_TOPIC_ARN);
const CHUNK_SIZE = 10;

const rdsHolder = RdsHolder.create();

export function handlerFn(sns: SNS): () => Promise<void> {
    return () => {
        return rdsHolder.setCredentials().then(async () => {
            const ships = await TimestampService.findETAShipsByLocode(ports);
            console.info(
                "method=triggerAwakeAiETAShipTimestampsUpdate.handler Triggering ETA ship update for count=%d ships",
                ships.length
            );

            for (const ship of ships) {
                console.info(
                    "method=triggerAwakeAiETATimestampsUpdate.handler Triggering ETA update for ship with IMO: %d, LOCODE: %s, portcallid: %d",
                    ship.imo,
                    ship.locode,
                    ship.portcall_id
                );
            }

            for (const chunk of R.splitEvery(CHUNK_SIZE, ships)) {
                await MessagingUtil.snsPublish(JSON.stringify(chunk), publishTopic, sns);
            }
        });
    };
}

export const handler = handlerFn(new SNS());
