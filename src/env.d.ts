
/**
 * 环境变量类型定义
 */
interface ImportMetaEnv {
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error' | 'none';
}

interface ImportMeta {
  env: ImportMetaEnv;
}
