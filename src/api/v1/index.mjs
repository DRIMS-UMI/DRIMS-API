import express from "express";

const router = express.Router();

const endpoints = [
    {path: 'admin', router: adminRoutes}
];

endpoints.forEach((endpoint)=> router.use(endpoint.path, requestLogger, endpoint.router));

export default router;