import {SECRET_ID_KEY} from "digitraffic-common/stack/lambda-configs";
import {withDbSecret} from "digitraffic-common/secrets/dbsecret";
import * as CountingSitesService from "../../service/counting-sites";

const secretId = process.env[SECRET_ID_KEY] as string;

export const handler = async (): Promise<any> => {
    return await withDbSecret(secretId, async (): Promise<any> => {
        const start = Date.now();

        try {
            return CountingSitesService.getMetadata();
        } finally {
            console.info("method=CountingSites.GetMetadata tookMs=%d", (Date.now() - start))
        }
    });
};

