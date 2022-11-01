import { UrlChecker } from "@digitraffic/common/dist/aws/infra/canaries/url-checker";
import { getSecret } from "@digitraffic/common/dist/aws/runtime/secrets/secret";
import { ShiplistSecret } from "../lambda/get-shiplist-public/get-shiplist-public";
import {
    ENV_SECRET,
    ENV_HOSTNAME,
} from "@digitraffic/common/dist/aws/infra/canaries/canary-keys";
import { envValue } from "@digitraffic/common/dist/aws/runtime/environment";

const hostname = envValue(ENV_HOSTNAME);
const secretId = envValue(ENV_SECRET);

export const handler = async (): Promise<string> => {
    const secret = await getSecret<ShiplistSecret>(secretId, "shiplist");
    const checker = new UrlChecker(hostname);

    await checker.expect200("/prod/shiplist?locode=FIHKO&auth=" + secret.auth);
    await checker.expect200("/prod/shiplist?locode=FIHEL&auth=" + secret.auth);
    await checker.expect200("/prod/api/v1/metadata");

    return checker.done();
};
