import coreWebVitals from "eslint-config-next/core-web-vitals";

const nextConfig = Array.isArray(coreWebVitals) ? coreWebVitals : [coreWebVitals];

const eslintConfig = [...nextConfig];

export default eslintConfig;
