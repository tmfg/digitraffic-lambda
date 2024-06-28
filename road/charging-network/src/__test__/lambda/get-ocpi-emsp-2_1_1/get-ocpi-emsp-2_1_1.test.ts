import {
    dbTestBase,
    decodeBodyToObject,
    getLambdaInputAuthorizerEvent,
    prettyJson,
    setTestEnv
} from "../../db-testutil.js";
import { getEnvVariable } from "@digitraffic/common/dist/utils/utils";
import type { VersionDetailsResponse } from "../../../api/ocpi/ocpi-api-responses.js";
import { ChargingNetworkKeys } from "../../../keys.js";
import { handler } from "../../../lambda/get-ocpi-emsp-2_1_1/get-ocpi-emsp-2_1_1.js";
import { DT_CPO_ID } from "../../test-constants.js";

setTestEnv();

const TEST_VERSIONS = `{
    "type": "Success",
    "status_code": 1000,
    "status_message": "Success",
    "timestamp": "${new Date().toISOString()}",
    "data": {
        "version": "2.1.1",
        "endpoints": [{
            "identifier": "credentials",
            "url": "${getEnvVariable(ChargingNetworkKeys.OCPI_DOMAIN_URL)}/ocpi/emsp/2.1.1/credentials/"
        }]
    }
}`;

describe(
    "lambda-get-ocpi-emsp-2_1_1",
    dbTestBase((db) => {
        test("get-ocpi-emsp-2_1_1", () => {
            // console.log(JSON.stringify(process.env));
            const response = handler(getLambdaInputAuthorizerEvent(DT_CPO_ID));
            const body = decodeBodyToObject(response) as VersionDetailsResponse;
            console.log(prettyJson(body));
            expect(prettyJson(body, ["timestamp"])).toEqual(prettyJson(TEST_VERSIONS, ["timestamp"]));
        });
    })
);
