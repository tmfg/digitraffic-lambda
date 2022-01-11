import {withDbSecret} from "digitraffic-common/secrets/dbsecret";
import * as CountingSitesService from "../../service/counting-sites";
import {LambdaResponse} from "digitraffic-common/lambda/lambda-response";
import {SECRET_ID} from "digitraffic-common/model/lambda-environment";

const secretId = process.env[SECRET_ID] as string;

export const handler = (event: Record<string, number>) => {
    return withDbSecret(secretId, () => {
        const start = Date.now();
        const year = event.year;
        const month = event.month;

        return CountingSitesService.getCsvData(year, month).then(data => {
            if (data.length === 0) {
                return LambdaResponse.notFound();
            }
            return LambdaResponse.ok(data);
        }).catch(error => {
            console.info("error " + error);

            return LambdaResponse.internalError();
        }).finally(() => {
            console.info("method=CountingSites.GetCSVData tookMs=%d", (Date.now() - start));
        });
    });
};

