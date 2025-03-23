import express from "express";
import managementRoutes from './routes/managementRoutes.js'
import facultyRoutes from './routes/facultyRoutes.js'
import { requestLogger } from "./middleware/requestLogger.mjs";

const router = express.Router();

const endpoints = [
    {path: '/management', router: managementRoutes},
    {path: '/faculty', router: facultyRoutes}
];

endpoints.forEach((endpoint)=> router.use(endpoint.path, requestLogger, endpoint.router));

export default router;