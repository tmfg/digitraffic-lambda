import {MaintenanceTrackingMunicipalitySecret} from "../../model/maintenance-tracking-municipality-secret";
import {SecretFunction, withDbSecret} from "digitraffic-common/aws/runtime/secrets/dbsecret";
import {MaintenanceTrackingMunicipalityEnvKeys} from "../../keys";
import {AutoriUpdate, TrackingSaveResult} from "../../service/autori-update";
import {AutoriApi} from "../../api/autori";

const secretId = process.env.SECRET_ID as string;
const domainName = process.env[MaintenanceTrackingMunicipalityEnvKeys.DOMAIN_NAME] as string;
const domainPrefix = process.env[MaintenanceTrackingMunicipalityEnvKeys.DOMAIN_PREFIX] as string;

let autoriUpdateService : AutoriUpdate;

export function handlerFn(doWithSecret: SecretFunction<MaintenanceTrackingMunicipalitySecret>) {
    return async () : Promise<TrackingSaveResult> => {
        const start = Date.now();

        if (!autoriUpdateService) {
            await doWithSecret(secretId, (secret: MaintenanceTrackingMunicipalitySecret) => {
                const autoriApi = new AutoriApi(secret.username, secret.password, secret.url);
                autoriUpdateService = new AutoriUpdate(autoriApi);
            }, {
                prefix: domainPrefix,
            });
        }

        try {
            await autoriUpdateService.updateContracts(domainName);
            await autoriUpdateService.updateTasks(domainName);
            return autoriUpdateService.updateTrackings(domainName)
                .then(savedResult => {
                    console.info(`method=autoriUpdateData count=${savedResult.saved} and errors=${savedResult.errors} tookMs=${(Date.now() - start)}`);
                    return savedResult;
                });
        } catch (error) {
            console.error(`method=autoriUpdateData upsertWorkMachine failed after ${(Date.now() - start)} ms`, error);
            throw error;
        }
    };
}

export const handler = handlerFn(withDbSecret);