import { StackConfiguration } from "@digitraffic/common/dist/aws/infra/stack/stack";

export type NauticalWarningConfiguration = StackConfiguration & {
    secretId: string;
};
