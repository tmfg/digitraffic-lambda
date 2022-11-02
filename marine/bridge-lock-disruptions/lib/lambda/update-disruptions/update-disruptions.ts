import {
    fetchRemoteDisruptions,
    saveDisruptions,
} from "../../service/disruptions";
import { ProxyHolder } from "@digitraffic/common/dist/aws/runtime/secrets/proxy-holder";
import { SecretHolder } from "@digitraffic/common/dist/aws/runtime/secrets/secret-holder";

const proxyHolder = ProxyHolder.create();
const secretHolder = SecretHolder.create<DisturbancesSecret>(
    "waterwaydisturbances"
);

interface DisturbancesSecret {
    url: string;
}

export const handler = (): Promise<void> => {
    return proxyHolder
        .setCredentials()
        .then(() => secretHolder.get())
        .then((secret) => fetchRemoteDisruptions(secret.url))
        .then((disruptions) => saveDisruptions(disruptions));
};
