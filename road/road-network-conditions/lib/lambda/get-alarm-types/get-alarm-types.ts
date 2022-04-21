import {ProxyLambdaRequest, ProxyLambdaResponse} from "digitraffic-common/aws/types/proxytypes";
import {MediaType} from "digitraffic-common/aws/types/mediatypes";
import {SecretHolder} from "digitraffic-common/aws/runtime/secrets/secret-holder";
import * as rcs from "../../service/road-network-conditions-service";
import {DOMAIN_PREFIX, RoadNetworkConditionsSecret} from "../../model/road-network-conditions-secret";
import {AlarmTypes} from "../../model/alarm-types";

const holder = SecretHolder.create<RoadNetworkConditionsSecret>(DOMAIN_PREFIX);

export async function handler(event: ProxyLambdaRequest): Promise<ProxyLambdaResponse> {
    const secret = await holder.get();

    const result: AlarmTypes = await rcs.getAlarmTypes(secret.apiKey, secret.url);

    return {
        statusCode: 200,
        body: JSON.stringify(result),
        headers: {
            "content-type": MediaType.APPLICATION_JSON,
        },
    };
}
