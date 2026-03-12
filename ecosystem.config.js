module.exports = {
    apps: [
        {
            name: 'chattutor-api',
            cwd: './packages/client',
            script: '/home/ubuntu/.bun/bin/bun',
            args: 'run src/index.ts --host 0.0.0.0',
            interpreter: 'none',
            env: {
                NODE_ENV: 'production',
                DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/dbname',
                API_BASE_URL: 'http://117.50.196.232:8002',
                VITE_API_BASE_URL: 'http://117.50.196.232:8002',
                CLIENT_BASE_URL: 'http://117.50.196.232:8001',
                CLINET_BASE_URL: 'http://117.50.196.232:8001',
                MODEL_API_KEY: process.env.MODEL_API_KEY || '',
                MODEL_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                AGENT_MODEL: 'qwen3.5-397b-a17b',
                AGENT_MODEL_PROVIDER: 'qwen',
                TITLE_MODEL: 'qwen3.5-397b-a17b',
                TITLE_MODEL_PROVIDER: 'qwen',
                OSS_ENDPOINT: process.env.OSS_ENDPOINT || 'https://oss-cn-beijing.aliyuncs.com',
                OSS_ACCESS_KEY: process.env.OSS_ACCESS_KEY || '',
                OSS_SECRET_KEY: process.env.OSS_SECRET_KEY || '',
                OSS_BUCKET: process.env.OSS_BUCKET || 'your-bucket',
                OSS_REGION: process.env.OSS_REGION || 'oss-cn-beijing',
            },
        },
        {
            name: 'chattutor-web',
            cwd: './packages/web',
            script: 'npm',
            args: 'run preview',
            env: {
                NODE_ENV: 'production',
                API_BASE_URL: 'http://117.50.196.232:8002',
                VITE_API_BASE_URL: 'http://117.50.196.232:8002',
                CLIENT_BASE_URL: 'http://117.50.196.232:8001',
                CLINET_BASE_URL: 'http://117.50.196.232:8001',
            },
        }
    ],
};
