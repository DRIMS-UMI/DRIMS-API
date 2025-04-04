import express from "express";
import http from 'http';
import {env} from './env.mjs';
import customizeApp from './app.mjs';
import {setupSocketIO} from './utils/sockets.js';
import {notificationService} from './services/notificationService.js';

const app = express();


app.start = async () => {
    console.log("Starting server...");
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    signals.forEach(signal => {
        process.on(signal, () => {
            console.log(`Received ${signal}, shutting down...`);
            process.exit();
        });
    });

    const port = env.PORT || 5000;
    app.set('port', port);
    customizeApp(app);

    // Initialize notification service
    await notificationService.initializeScheduledNotifications();

    const server = http.createServer(app);

    setupSocketIO(server);

    server.on("error", (error) => { 
        if (error.syscall !== 'listen') {
            throw error;
        }
        console.error('Failed to start server', error);
        process.exit(1);
    });

    server.on("listening", () => {
        const hasEnv = env.HAS_ENV;
        if (!hasEnv) {
            throw new Error('To start the server make sure HAS_ENV is true');
        }
        const addr = server.address();
        const bind =
            typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
        console.log(`Server listening on ${bind}`);
        console.info('Server started ✅');
    });

    if (process.env.NODE_ENV !== 'test') {
        server.listen(port);
    }
}

Promise.resolve(true).then(app.start).catch((err)=>{
    console.error(err);
    setTimeout(()=>{
        process.exit(1);
    }, 1000);   
});

export default app;


