import 'dotenv/config';
import { z } from 'zod';
import { createEnv } from '@t3-oss/env-core';

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        PORT: z.preprocess((val) => parseInt(val), z.number().default(5000)),
        HAS_ENV: z.preprocess((val) => val === 'true', z.boolean().default(false)),
        DATABASE_URL: z.string({message: 'DATABASE_URL is required'}),
        AUTH_SECRET: z.string({message: 'AUTH_SECRET is required'}),
        AT_API_KEY: z.string({message: 'AT_API_KEY is required'}),
        NODE_MAILER_HOST: z.string({message: 'NODE_MAILER_HOST is required'}).default('smtp.zoho.com'),
        NODE_MAILER_PORT: z.string({message : 'NODE_MAILER_PORT is required'}).default('465'),
        NODE_MAILER_USERCRED: z.string({message: 'NODE_MAILER_USERCRED is required'}),
        NODE_MAILER_PASSCRED: z.string({message: 'NODE_MAILER_PASSCRED is required'}),
        STUDENT_CLIENT_URL: z.string().optional().default('https://umistudents.netlify.app'),
        SUPERVISOR_CLIENT_URL: z.string().optional().default('https://umisupervisor.netlify.app'),
        FACULTY_CLIENT_URL: z.string().optional().default('https://umimanagement.netlify.app'),
    },
    runtimeEnv: process.env,
})