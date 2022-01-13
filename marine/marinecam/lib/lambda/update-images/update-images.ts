import {SecretFunction, withDbSecret} from "digitraffic-common/aws/runtime/secrets/dbsecret";
import * as ImageFetcher from "../../service/image-fetcher";
import {MarinecamEnvKeys, MarinecamSecretKeys} from "../../keys";
import {GenericSecret} from "digitraffic-common/aws/runtime/secrets/secret";

const secretId = process.env.SECRET_ID as string;
const bucketName = process.env[MarinecamEnvKeys.BUCKET_NAME] as string;

let imageServerUrl: string;
let imageServerUsername: string;
let imageServerPassword: string;
let imageServerCertificate: string;

export function handlerFn(doWithSecret: SecretFunction<GenericSecret>) {
    return async () => {
        if (!imageServerUrl) {
            await doWithSecret(secretId, (secret: GenericSecret) => {
                imageServerUrl = secret[MarinecamSecretKeys.IMAGE_SERVER_URL];
                imageServerUsername = secret[MarinecamSecretKeys.IMAGE_SERVER_USERNAME];
                imageServerPassword = secret[MarinecamSecretKeys.IMAGE_SERVER_PASSWORD];
                imageServerCertificate = secret[MarinecamSecretKeys.IMAGE_SERVER_CERTIFICATE];
            });
        }

        console.info("updating images from " + imageServerUrl);

        return ImageFetcher.updateAllCameras(
            imageServerUrl, imageServerUsername, imageServerPassword, bucketName, imageServerCertificate,
        );
    };
}

export const handler = handlerFn(withDbSecret);
