import { z } from "zod";

export const openapiSchema = z
    .object({
        openapi: z.string().regex(new RegExp("^3\\.0\\.\\d(-.+)?$")),
        info: z.object({
            title: z.string(),
            description: z.string().optional(),
        }),
        externalDocs: z.any().optional(),
        servers: z.array(z.any()).optional(),
        security: z.array(z.any()).optional(),
        tags: z.array(z.any()).optional(),
        paths: z.record(z.record(z.record(z.any()))),
        components: z.any().optional(),
    })
    .describe(
        "The description of OpenAPI v3.0.x documents, as defined by https://spec.openapis.org/oas/v3.0.3"
    );

export type OpenApiSchema = z.infer<typeof openapiSchema>;
