import {withDbSecret} from "digitraffic-common/aws/runtime/secrets/dbsecret";
import * as CountingSitesService from "../../service/counting-sites";
import {LambdaResponse} from "digitraffic-common/aws/types/lambda-response";

const secretId = process.env.SECRET_ID as string;

export const handler = (event: Record<string, number | string>) => {
    return withDbSecret(secretId, () => {
        const start = Date.now();

        const counterId = event.counterId as number;
        const domainName = event.domainName as string;

        return CountingSitesService.findData(counterId, domainName).then(data => {
            return LambdaResponse.ok(data);
        }).catch(error => {
            console.info("error " + error);

            return LambdaResponse.internalError();
        }).finally(() => {
            console.info("method=CountingSites.GetData tookMs=%d", (Date.now() - start));
        });
    });
};

