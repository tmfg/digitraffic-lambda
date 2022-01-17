import {CfnDistribution, OriginAccessIdentity} from 'aws-cdk-lib/aws-cloudfront';
import {CompositePrincipal, ManagedPolicy, PolicyStatement, Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import {Construct} from "constructs";
import {Annotations, Stack, StackProps} from "aws-cdk-lib";
import {createOriginConfig, LambdaMap} from "./origin-configs";
import {CFDomain, CFLambdaProps, CFProps, ElasticProps, Props} from './app-props';
import {
    createGzipRequirement,
    createHttpHeaders, createIpRestriction,
    createWeathercamRedirect,
    LambdaType,
} from "./lambda/lambda-creator";
import {createDistribution} from "./distribution-util";
import {createRealtimeLogging, StreamingConfig} from "./streaming-util";

type ViewerPolicyMap = {
    [key: string]: string,
};

type MutablePolicy = {
    viewerProtocolPolicy: string
}

export class CloudfrontCdkStack extends Stack {
    constructor(scope: Construct, id: string, cloudfrontProps: CFProps, props?: StackProps) {
        super(scope, id, props);

        this.validateDefaultBehaviors(cloudfrontProps.props);

        const lambdaMap = this.createLambdaMap(cloudfrontProps.lambdaProps);
        const writeToESROle = this.createWriteToESRole(this, cloudfrontProps.elasticProps);
        const streamingConfig = createRealtimeLogging(this, writeToESROle, cloudfrontProps.elasticAppName, cloudfrontProps.elasticProps);

        cloudfrontProps.props.forEach(p => this.createDistribution(
            p, writeToESROle, lambdaMap, streamingConfig, cloudfrontProps,
        ));

        //        Aspects.of(this).add(new StackCheckingAspect());
    }

    validateDefaultBehaviors(props: Props[]) {
        props.forEach(distribution => {
            // check default behaviors
            const defaults = distribution.domains.flatMap(d => d.behaviors)
                .filter(b => b.path === "*");

            if (defaults.length === 0) {
                console.error("no defaults for " + distribution.distributionName);
            } else if (defaults.length > 1) {
                console.error("multiple defaults for " + distribution.distributionName);
                console.error(defaults);
            }
        });
    }

    createWriteToESRole(stack: Construct, elasticProps: ElasticProps) {
        const lambdaRole = new Role(stack, `WriteToElasticRole`, {
            assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
            roleName: `WriteToElasticRole`,
        });
        lambdaRole.addToPolicy(new PolicyStatement({
            actions: [
                "es:DescribeElasticsearchDomain",
                "es:DescribeElasticsearchDomains",
                "es:DescribeElasticsearchDomainConfig",
                "es:ESHttpPost",
                "es:ESHttpPut",
                "es:ESHttpGet",
            ],
            resources: [
                elasticProps.elasticArn,
                `${elasticProps.elasticArn}/*`,
            ],
        }));
        lambdaRole.addToPolicy(new PolicyStatement( {
            actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
            ],
            resources: [
                "arn:aws:logs:*:*:*",
            ],
        }));

        return lambdaRole;
    }

    createLambdaMap(lProps: CFLambdaProps | undefined): LambdaMap {
        const lambdaMap: LambdaMap = {};

        if (lProps !== undefined) {
            const edgeLambdaRole = new Role(this, 'edgeLambdaRole', {
                assumedBy: new CompositePrincipal(new ServicePrincipal("lambda.amazonaws.com"),
                    new ServicePrincipal("edgelambda.amazonaws.com")),
                managedPolicies: [
                    ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                ],
            });

            if (lProps.lambdaTypes.includes(LambdaType.WEATHERCAM_REDIRECT)) {
                lambdaMap[LambdaType.WEATHERCAM_REDIRECT] =
                    createWeathercamRedirect(this, edgeLambdaRole, lProps.lambdaParameters!.weathercamDomainName!, lProps.lambdaParameters!.weathercamHostName!);
            }

            if (lProps.lambdaTypes.includes(LambdaType.GZIP_REQUIREMENT)) {
                lambdaMap[LambdaType.GZIP_REQUIREMENT] =
                    createGzipRequirement(this, edgeLambdaRole);
            }

            if (lProps.lambdaTypes.includes(LambdaType.HTTP_HEADERS)) {
                lambdaMap[LambdaType.HTTP_HEADERS] =
                    createHttpHeaders(this, edgeLambdaRole);
            }

            // handle ip restrictions
            if (lProps.lambdaParameters && lProps.lambdaParameters.ipRestrictions) {
                for (const key of Object.keys(lProps.lambdaParameters.ipRestrictions)) {
                    const restriction = lProps.lambdaParameters.ipRestrictions[key];

                    lambdaMap[`IP_${key}`] = createIpRestriction(this, edgeLambdaRole, key, restriction);
                }
            }
        }

        return lambdaMap;
    }

    createDistribution(
        distributionProps: Props, role: Role, lambdaMap: LambdaMap, streamingConfig: StreamingConfig, cloudfrontProps: CFProps,
    ) {
        const oai = distributionProps.originAccessIdentity ? new OriginAccessIdentity(this, `${distributionProps.environmentName}-oai`) : null;
        const originConfigs = distributionProps.domains.map(d => createOriginConfig(this, d, oai, lambdaMap));
        const distribution = createDistribution(
            this, distributionProps, originConfigs, role, cloudfrontProps, streamingConfig,
        );

        // cdk does not support viewerPolicy as it should
        // so collect map of policies and force them into cloudformation
        const viewerPolicies = this.getViewerPolicies(distributionProps.domains);

        if (Object.keys(viewerPolicies).length > 0) {
            const cfnDistribution = distribution.node.defaultChild as CfnDistribution;
            const distributionConfig = cfnDistribution.distributionConfig as CfnDistribution.DistributionConfigProperty;
            const behaviors = distributionConfig?.cacheBehaviors as CfnDistribution.CacheBehaviorProperty[];

            // handle all behaviors
            behaviors?.forEach((cb: CfnDistribution.CacheBehaviorProperty) => {
                this.setViewerPolicy(cb, viewerPolicies, cb.pathPattern);
            });

            // and the default behavior
            this.setViewerPolicy(distributionConfig.defaultCacheBehavior as CfnDistribution.CacheBehaviorProperty, viewerPolicies, '*');
        }

        return distribution;
    }

    setViewerPolicy(behavior: CfnDistribution.CacheBehaviorProperty, viewerPolicyMap: ViewerPolicyMap, pathPattern: string) {
        const viewerProtocolPolicy = viewerPolicyMap[pathPattern];

        if (viewerProtocolPolicy) {
            (behavior as MutablePolicy).viewerProtocolPolicy = viewerProtocolPolicy;
        }
    }

    getViewerPolicies(domains: CFDomain[]): ViewerPolicyMap {
        const policyMap: ViewerPolicyMap = {};

        domains.forEach(d => {
            d.behaviors?.forEach(b => {
                if (b.viewerProtocolPolicy != null) {
                    policyMap[b.path] = b.viewerProtocolPolicy;
                }
            });
        });

        return policyMap;
    }
}
