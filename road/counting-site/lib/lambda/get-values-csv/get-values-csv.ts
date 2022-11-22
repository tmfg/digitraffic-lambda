import * as CountingSitesService from "../../service/counting-sites";
import { LambdaResponse } from "@digitraffic/common/dist/aws/types/lambda-response";
import { validate, ValuesQueryParameters } from "../../model/parameters";
import { ProxyHolder } from "@digitraffic/common/dist/aws/runtime/secrets/proxy-holder";

const proxyHolder = ProxyHolder.create();

export const handler = (event: ValuesQueryParameters) => {
    const start = Date.now();

    const validationError = validate(event);
    if (validationError) {
        return LambdaResponse.badRequest(validationError);
    }

    const year = event.year ?? new Date().getUTCFullYear();
    const month = event.month ?? new Date().getUTCMonth() + 1;

    const filename = `${year}-${month}.csv`;

    return proxyHolder
        .setCredentials()
        .then(() =>
            CountingSitesService.getValuesForMonth(
                year,
                month,
                event.domain_name,
                event.counter_id
            )
        )
        .then((data) => {
            return LambdaResponse.ok(data, filename);
        })
        .catch((error: Error) => {
            console.info("error " + error.toString());

            return LambdaResponse.internalError();
        })
        .finally(() => {
            console.info(
                "method=CountingSites.GetCSVData tookMs=%d",
                Date.now() - start
            );
        });
};
