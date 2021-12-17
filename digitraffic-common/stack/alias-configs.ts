import {ViewerCertificate} from "aws-cdk-lib/aws-cloudfront/lib/web-distribution";
import {SecurityPolicyProtocol} from "aws-cdk-lib/aws-cloudfront";

export function createViewerCertificate(acmCertificateArn: string, aliases: string[]): ViewerCertificate {
    return {
        props: {
            acmCertificateArn,
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
        },
        aliases,
    };
}
