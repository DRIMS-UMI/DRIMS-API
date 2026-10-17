import express from "express";
import managementRoutes from './routes/managementRoutes.js'
import facultyRoutes from './routes/facultyRoutes.js'
import supervisorRoutes from './routes/supervisorRoutes.js'
import studentRoutes from './routes/studentRoutes.js'
import emailRoutes from './routes/emailRoutes.js'
import directMessageRoutes from './routes/directMessageRoutes.js'
import ticketRoutes from './routes/ticketRoutes.js'
import supervisorAppointmentsRoutes from './routes/supervisorAppointmentsRoutes.js'
import studentAppointmentsRoutes from './routes/studentAppointmentsRoutes.js'
import systemRoutes from './routes/systemRoutes.js'
import { requestLogger } from "./middleware/requestLogger.mjs";
import { registerMountedRouters } from "../../utils/routeRegistry.js";

const router = express.Router();

const endpoints = [
    {path: '/management', router: managementRoutes},
    {path: '/faculty', router: facultyRoutes},
    {path: '/supervisor', router: supervisorRoutes},
    {path: '/student', router: studentRoutes},
    {path: '/email', router: emailRoutes},
    {path: '/messages', router: directMessageRoutes},
    {path: '/tickets', router: ticketRoutes},
    {path: '/supervisor/appointments', router: supervisorAppointmentsRoutes},
    {path: '/student/appointments', router: studentAppointmentsRoutes},
    {path: '/system', router: systemRoutes}
];

endpoints.forEach((endpoint)=> router.use(endpoint.path, requestLogger, endpoint.router));

// Exposed to the system report's RBAC matrix
registerMountedRouters('/api/v1', endpoints);

export default router;