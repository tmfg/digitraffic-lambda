import * as UpdateService from "../../service/update";
import { CountingSitesEnvKeys } from "../../keys";
import { SecretHolder } from "@digitraffic/common/dist/aws/runtime/secrets/secret-holder";
import { CountingSitesSecret } from "../../model/counting-sites-secret";
import { ProxyHolder } from "@digitraffic/common/dist/aws/runtime/secrets/proxy-holder";
import { envValue } from "@digitraffic/common/dist/aws/runtime/environment";

const domainName = envValue(CountingSitesEnvKeys.DOMAIN_NAME);
const domainPrefix = envValue(CountingSitesEnvKeys.DOMAIN_PREFIX);

const proxyHolder = ProxyHolder.create();
const secretHolder = SecretHolder.create<CountingSitesSecret>(domainPrefix);

export const handler = () => {
    const start = Date.now();

    proxyHolder
        .setCredentials()
        .then(() => secretHolder.get())
        .then((secret) =>
            UpdateService.updateDataForDomain(
                domainName,
                secret.apiKey,
                secret.url
            )
        )
        .finally(() => {
            console.info(
                "method=updateData.%s tookMs=%d",
                domainName,
                Date.now() - start
            );
        });
};
