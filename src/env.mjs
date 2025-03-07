import 'dotenv/config';
import { z } from 'zod';
import { createEnv } from '@t3-oss/env-core';

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        PORT: z.preprocess((val) => parseInt(val), z.number().default(5000)),
        HAS_ENV: z.preprocess((val) => val === 'true', z.boolean().default(false)),
        DATABASE_URL: z.string({message: 'DATABASE_URL is required'}).default('mongodb://127.0.0.1:27017/umidata?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.3.3'),
        AUTH_SECRET: z.string({message: 'AUTH_SECRET is required'}).default('MnlUDm/AqVCeXuX0YmZT07dzoFQEpz2b8TdmhUPr6nU='),
        AT_API_KEY: z.string({message: 'AT_API_KEY is required'}).default('atsk_37dae9cedcf346f20807b8d5b7804795dc79e7b852910861b50b685f041809ecbb36a6ed'),
        NODE_MAILER_HOST: z.string({message: 'NODE_MAILER_HOST is required'}).default('smtp.zoho.com'),
        NODE_MAILER_PORT: z.string({message : 'NODE_MAILER_PORT is required'}).default('465'),
        NODE_MAILER_USERCRED: z.string({message: 'NODE_MAILER_USERCRED is required'}).default('tech.support@nyatimotionpictures.com'),
        NODE_MAILER_PASSCRED: z.string({message: 'NODE_MAILER_PASSCRED is required'}).default('qKix9i$g'),
    },
    runtimeEnv: process.env,
})