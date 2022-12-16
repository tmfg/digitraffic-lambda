import { uploadToS3 } from "@digitraffic/common/dist/aws/runtime/s3";
import { PortactivityEnvKeys } from "../../keys";
import { envValue } from "@digitraffic/common/dist/aws/runtime/environment";

const bucketName = envValue(PortactivityEnvKeys.BUCKET_NAME);

interface DlqEvent {
    readonly Records: {
        readonly body: string;
    }[];
}

export const handler = async (event: DlqEvent): Promise<void> => {
    const millis = new Date().getTime();
    console.info(
        `method=portactivityTimestampsProcessDLQ.handler portCallDLQRecordsReceived=${event.Records.length}`
    );
    const uploads = event.Records.map((e, idx: number) =>
        uploadToS3(bucketName, e.body, `timestamp-${millis}-${idx}.json`)
    );
    await Promise.all(uploads);
};
