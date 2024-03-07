import { type StackConfiguration } from "@digitraffic/common/dist/aws/infra/stack/stack";
export interface Props extends StackConfiguration {
    readonly appUrl?: string;
    readonly betaAppUrl?: string;
    readonly apiGwAppIds: string[];
    readonly logsDestinationArn: string;
    readonly bucketName: string;
    readonly s3VpcEndpointId?: string;
    readonly cloudFrontCanonicalUser?: string;
    readonly directory?: string;
    readonly host?: string;
    readonly title?: string;
    readonly description?: string;
    readonly removeSecurity?: boolean;
}
